import mongoose from 'mongoose';
import type { AuthPrincipal } from '../middleware/auth.js';
import { Project } from '../models/Project.js';
import { Task } from '../models/Task.js';

// Centralized authorization. Components/routes call these; no scattered role checks.

export function isAdmin(u: AuthPrincipal): boolean {
  return u.role === 'ADMIN';
}

export function isManager(u: AuthPrincipal): boolean {
  return u.role === 'MANAGER';
}

export async function canViewProject(user: AuthPrincipal, projectId: string): Promise<boolean> {
  if (isAdmin(user)) return true;
  if (!mongoose.isValidObjectId(projectId)) return false;
  const p = await Project.findById(projectId).select('ownerId memberIds').lean();
  if (!p) return false;
  const uid = user.id;
  return String(p.ownerId) === uid || p.memberIds.map(String).includes(uid);
}

export async function canManageProject(user: AuthPrincipal, projectId: string): Promise<boolean> {
  if (isAdmin(user)) return true;
  if (!mongoose.isValidObjectId(projectId)) return false;
  // Manager can manage projects they own. Membership alone is read-only.
  const p = await Project.findById(projectId).select('ownerId').lean();
  if (!p) return false;
  return user.role === 'MANAGER' && String(p.ownerId) === user.id;
}

export async function canViewTask(user: AuthPrincipal, taskId: string): Promise<boolean> {
  if (isAdmin(user)) return true;
  if (!mongoose.isValidObjectId(taskId)) return false;
  const t = await Task.findById(taskId).select('projectId assigneeId createdBy').lean();
  if (!t) return false;
  if (t.assigneeId && String(t.assigneeId) === user.id) return true;
  if (t.createdBy && String(t.createdBy) === user.id) return true;
  return canViewProject(user, String(t.projectId));
}

export async function canAssignTask(user: AuthPrincipal, projectId: string): Promise<boolean> {
  if (isAdmin(user)) return true;
  return canManageProject(user, projectId);
}

export function canReadOrgReports(user: AuthPrincipal): boolean {
  return isAdmin(user);
}

export function canUpdateOwnTaskStatus(user: AuthPrincipal, assigneeId: string | null | undefined): boolean {
  if (isAdmin(user)) return true;
  return !!assigneeId && assigneeId === user.id;
}
