import mongoose from 'mongoose';
import { AppError } from '../errors/AppError.js';
import { Task, isValidTaskTransition, type TaskStatus } from '../models/Task.js';
import { Project } from '../models/Project.js';
import { User } from '../models/User.js';
import type { AuthPrincipal } from '../middleware/auth.js';
import { canAssignTask, canViewProject, canViewTask, isAdmin } from '../policies/access.js';
import { notifyTaskAssigned, notifyTaskStatus } from './notificationService.js';
import type { PaginationQuery } from '../utils/pagination.js';

export async function listTasks(
  viewer: AuthPrincipal,
  query: PaginationQuery & { status?: string; priority?: string; projectId?: string; assigneeId?: string },
): Promise<{ items: unknown[]; total: number }> {
  const filter: Record<string, unknown> = {};
  if (query.status) filter.status = query.status;
  if (query.priority) filter.priority = query.priority;
  if (query.projectId) {
    if (!mongoose.isValidObjectId(query.projectId)) throw AppError.badRequest('Invalid projectId.');
    if (!(await canViewProject(viewer, query.projectId))) throw AppError.forbidden('No access to this project.');
    filter.projectId = query.projectId;
  }
  if (query.assigneeId) {
    if (!mongoose.isValidObjectId(query.assigneeId)) throw AppError.badRequest('Invalid assigneeId.');
    filter.assigneeId = query.assigneeId;
  }
  if (viewer.role === 'EMPLOYEE' && !query.projectId) {
    filter.assigneeId = new mongoose.Types.ObjectId(viewer.id);
  }
  if (query.search) filter.title = { $regex: query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };

  const total = await Task.countDocuments(filter);
  const items = await Task.find(filter)
    .populate('projectId', 'name status')
    .populate('assigneeId', 'name email')
    .sort('-createdAt')
    .skip((query.page - 1) * query.limit)
    .limit(query.limit)
    .lean();
  return { items, total };
}

export async function createTask(
  viewer: AuthPrincipal,
  input: { title: string; description?: string; projectId: string; assigneeId?: string | null; priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'; dueDate?: Date },
): Promise<unknown> {
  if (!(await canAssignTask(viewer, input.projectId))) {
    throw AppError.forbidden('Only the project owner, manager-owner, or admin can create tasks here.');
  }
  const project = await Project.findById(input.projectId).lean();
  if (!project) throw AppError.notFound('Project not found.');
  if (input.assigneeId) {
    const members = project.memberIds.map(String);
    if (!members.includes(input.assigneeId)) throw AppError.badRequest('Assignee must be a project member.');
    const u = await User.findById(input.assigneeId).lean();
    if (!u || u.status !== 'ACTIVE') throw AppError.badRequest('Assignee must be an active user.');
  }
  const created = await Task.create({
    title: input.title.trim(),
    description: input.description?.trim(),
    projectId: input.projectId,
    assigneeId: input.assigneeId ?? null,
    createdBy: viewer.id,
    priority: input.priority ?? 'MEDIUM',
    dueDate: input.dueDate,
    status: 'TODO',
  });
  if (input.assigneeId && input.assigneeId !== viewer.id) {
    await notifyTaskAssigned(input.assigneeId, created.title, String(created._id));
  }
  return Task.findById(created._id).populate('assigneeId', 'name email').lean();
}

export async function getTask(viewer: AuthPrincipal, id: string): Promise<unknown> {
  assertId(id);
  if (!(await canViewTask(viewer, id))) throw AppError.forbidden('You do not have access to this task.');
  const doc = await Task.findById(id).populate('assigneeId', 'name email').populate('projectId', 'name status').lean();
  if (!doc) throw AppError.notFound('Task not found.');
  return doc;
}

export async function updateTask(
  viewer: AuthPrincipal,
  id: string,
  patch: { title?: string; description?: string; priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'; dueDate?: Date | null },
): Promise<unknown> {
  assertId(id);
  const existing = await Task.findById(id).lean();
  if (!existing) throw AppError.notFound('Task not found.');
  const canManage = await canAssignTask(viewer, String(existing.projectId));
  const isOwn = existing.assigneeId && String(existing.assigneeId) === viewer.id;
  // Employees may edit title/description/priority/dueDate only on own tasks; reassignment lives in assignTask.
  if (!isAdmin(viewer) && !canManage && !isOwn) throw AppError.forbidden('You cannot edit this task.');
  const doc = await Task.findByIdAndUpdate(id, { $set: patch }, { new: true, runValidators: true }).lean();
  return doc;
}

export async function changeTaskStatus(viewer: AuthPrincipal, id: string, next: TaskStatus): Promise<unknown> {
  assertId(id);
  const existing = await Task.findById(id).lean();
  if (!existing) throw AppError.notFound('Task not found.');
  if (!isValidTaskTransition(existing.status, next)) {
    throw AppError.badRequest(`Cannot move task from ${existing.status} to ${next}.`);
  }
  const canManage = await canAssignTask(viewer, String(existing.projectId));
  const isOwn = existing.assigneeId && String(existing.assigneeId) === viewer.id;
  if (!isAdmin(viewer) && !canManage && !isOwn) throw AppError.forbidden('You cannot change this task status.');
  const doc = await Task.findByIdAndUpdate(id, { $set: { status: next } }, { new: true }).lean();
  if (doc?.assigneeId && String(doc.assigneeId) !== viewer.id) {
    await notifyTaskStatus(String(doc.assigneeId), doc.title, next, id);
  }
  return doc;
}

export async function assignTask(viewer: AuthPrincipal, id: string, assigneeId: string | null): Promise<unknown> {
  assertId(id);
  const existing = await Task.findById(id).lean();
  if (!existing) throw AppError.notFound('Task not found.');
  if (!(await canAssignTask(viewer, String(existing.projectId)))) {
    throw AppError.forbidden('Only the project owner or an admin can reassign tasks.');
  }
  if (assigneeId) {
    if (!mongoose.isValidObjectId(assigneeId)) throw AppError.badRequest('Invalid assigneeId.');
    const project = await Project.findById(existing.projectId).lean();
    if (!project || !project.memberIds.map(String).includes(assigneeId)) {
      throw AppError.badRequest('Assignee must be a project member.');
    }
  }
  const doc = await Task.findByIdAndUpdate(id, { $set: { assigneeId } }, { new: true }).lean();
  if (assigneeId && assigneeId !== viewer.id && doc) {
    await notifyTaskAssigned(assigneeId, doc.title, id);
  }
  return doc;
}

export async function addTaskComment(viewer: AuthPrincipal, id: string, body: string): Promise<unknown> {
  assertId(id);
  if (!(await canViewTask(viewer, id))) throw AppError.forbidden('You cannot comment on this task.');
  const doc = await Task.findByIdAndUpdate(
    id,
    { $push: { comments: { authorId: viewer.id, body, createdAt: new Date() } } },
    { new: true },
  ).lean();
  if (!doc) throw AppError.notFound('Task not found.');
  return doc;
}

function assertId(id: string): void {
  if (!mongoose.isValidObjectId(id)) throw AppError.badRequest('Invalid id.');
}
