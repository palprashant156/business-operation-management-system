import mongoose from 'mongoose';
import { AppError } from '../errors/AppError.js';
import { Project, type ProjectStatus } from '../models/Project.js';
import { Task } from '../models/Task.js';
import { User } from '../models/User.js';
import type { AuthPrincipal } from '../middleware/auth.js';
import { canManageProject, canViewProject } from '../policies/access.js';
import { notifyProjectMembers } from './notificationService.js';
import type { PaginationQuery } from '../utils/pagination.js';

export async function listProjects(viewer: AuthPrincipal, query: PaginationQuery & { status?: string }): Promise<{ items: unknown[]; total: number }> {
  const filter: Record<string, unknown> = {};
  if (query.status) filter.status = query.status;
  if (query.search) filter.name = { $regex: query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  if (viewer.role !== 'ADMIN') {
    const uid = new mongoose.Types.ObjectId(viewer.id);
    filter.$or = [{ ownerId: uid }, { memberIds: uid }];
  }
  const total = await Project.countDocuments(filter);
  const items = await Project.find(filter)
    .populate('ownerId', 'name email')
    .sort('-createdAt')
    .skip((query.page - 1) * query.limit)
    .limit(query.limit)
    .lean();
  return { items, total };
}

export async function createProject(
  viewer: AuthPrincipal,
  input: { name: string; description?: string; memberIds: string[]; status?: ProjectStatus; startDate?: Date; dueDate?: Date },
): Promise<unknown> {
  if (viewer.role === 'EMPLOYEE') throw AppError.forbidden('Employees cannot create projects.');
  if (input.dueDate && input.startDate && input.dueDate < input.startDate) {
    throw AppError.badRequest('Due date cannot be before start date.');
  }
  // Every member must exist and be active.
  const uniqueMembers = [...new Set(input.memberIds)];
  if (uniqueMembers.length > 0) {
    const count = await User.countDocuments({ _id: { $in: uniqueMembers }, status: 'ACTIVE' });
    if (count !== uniqueMembers.length) throw AppError.badRequest('All project members must be active users.');
  }
  const created = await Project.create({
    name: input.name.trim(),
    description: input.description?.trim(),
    ownerId: viewer.id,
    memberIds: [...new Set([...uniqueMembers, viewer.id])],
    status: input.status ?? 'PLANNED',
    startDate: input.startDate,
    dueDate: input.dueDate,
  });
  await notifyProjectMembers(
    uniqueMembers.filter((m) => m !== viewer.id),
    created.name,
    String(created._id),
  );
  return Project.findById(created._id).populate('ownerId', 'name email').lean();
}

export async function getProject(viewer: AuthPrincipal, id: string): Promise<unknown> {
  assertId(id);
  if (!(await canViewProject(viewer, id))) throw AppError.forbidden('You do not have access to this project.');
  const doc = await Project.findById(id).populate('ownerId', 'name email').populate('memberIds', 'name email role').lean();
  if (!doc) throw AppError.notFound('Project not found.');
  const tasks = await Task.find({ projectId: id }).select('status').lean();
  const progress = computeProgress(tasks.map((t) => t.status));
  return { ...doc, progress, taskCounts: countBy(tasks.map((t) => t.status)) };
}

export async function updateProject(
  viewer: AuthPrincipal,
  id: string,
  patch: { name?: string; description?: string; status?: ProjectStatus; startDate?: Date; dueDate?: Date },
): Promise<unknown> {
  assertId(id);
  if (!(await canManageProject(viewer, id))) throw AppError.forbidden('Only the project owner or an admin can edit this project.');
  const doc = await Project.findByIdAndUpdate(id, { $set: patch }, { new: true, runValidators: true }).lean();
  if (!doc) throw AppError.notFound('Project not found.');
  return doc;
}

export async function addProjectMembers(viewer: AuthPrincipal, id: string, memberIds: string[]): Promise<unknown> {
  assertId(id);
  if (!(await canManageProject(viewer, id))) throw AppError.forbidden('Only the project owner or an admin can add members.');
  const count = await User.countDocuments({ _id: { $in: memberIds }, status: 'ACTIVE' });
  if (count !== [...new Set(memberIds)].length) throw AppError.badRequest('All new members must be active users.');
  const doc = await Project.findByIdAndUpdate(id, { $addToSet: { memberIds: { $each: memberIds } } }, { new: true })
    .populate('memberIds', 'name email role')
    .lean();
  if (!doc) throw AppError.notFound('Project not found.');
  const proj = await Project.findById(id).lean();
  await notifyProjectMembers(memberIds.filter((m) => m !== viewer.id), proj?.name ?? 'project', id);
  return doc;
}

/** Progress = DONE / total. Empty project = 0. Documented, no hardcoded percentages. */
export function computeProgress(statuses: string[]): number {
  if (statuses.length === 0) return 0;
  const done = statuses.filter((s) => s === 'DONE').length;
  return Math.round((done / statuses.length) * 100);
}

function countBy(statuses: string[]): Record<string, number> {
  const out: Record<string, number> = { TODO: 0, IN_PROGRESS: 0, REVIEW: 0, DONE: 0 };
  for (const s of statuses) out[s] = (out[s] ?? 0) + 1;
  return out;
}

function assertId(id: string): void {
  if (!mongoose.isValidObjectId(id)) throw AppError.badRequest('Invalid id.');
}
