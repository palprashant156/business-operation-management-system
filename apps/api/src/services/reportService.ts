import mongoose from 'mongoose';
import { AppError } from '../errors/AppError.js';
import { Task } from '../models/Task.js';
import { Project } from '../models/Project.js';
import { Order } from '../models/Order.js';
import type { AuthPrincipal } from '../middleware/auth.js';
import { computeProgress } from './projectService.js';

// All reports are scoped BEFORE aggregation. Never return org-wide metrics to non-admins.

export async function taskSummary(viewer: AuthPrincipal): Promise<unknown> {
  const match = await taskScopeMatch(viewer);
  const groups = await Task.aggregate([
    { $match: match },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);
  const byStatus: Record<string, number> = { TODO: 0, IN_PROGRESS: 0, REVIEW: 0, DONE: 0 };
  for (const g of groups as { _id: string; count: number }[]) byStatus[g._id] = g.count;
  const overdue = await Task.countDocuments({ ...match, dueDate: { $lt: new Date() }, status: { $ne: 'DONE' } });
  return { byStatus, overdue, total: Object.values(byStatus).reduce((a, b) => a + b, 0) };
}

export async function projectProgress(viewer: AuthPrincipal): Promise<unknown> {
  const projectFilter: Record<string, unknown> =
    viewer.role === 'ADMIN' ? {} : { $or: [{ ownerId: new mongoose.Types.ObjectId(viewer.id) }, { memberIds: new mongoose.Types.ObjectId(viewer.id) }] };
  const projects = await Project.find(projectFilter).select('_id name status').lean().limit(50);
  const out = [];
  for (const p of projects) {
    const statuses = await Task.find({ projectId: p._id }).select('status').lean();
    out.push({
      projectId: String(p._id),
      name: p.name,
      status: p.status,
      progress: computeProgress(statuses.map((t) => t.status)),
      taskCount: statuses.length,
    });
  }
  return out;
}

export async function workload(viewer: AuthPrincipal): Promise<unknown> {
  if (viewer.role === 'EMPLOYEE') {
    const mine = await Task.aggregate([
      { $match: { assigneeId: new mongoose.Types.ObjectId(viewer.id), status: { $ne: 'DONE' } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    return [{ userId: viewer.id, counts: mine }];
  }
  // Admin: top 20 by open tasks. Manager: only their project members (MVP: their direct scope = tasks in owned projects).
  let assigneeIds: mongoose.Types.ObjectId[] | undefined;
  if (viewer.role === 'MANAGER') {
    const owned = await Project.find({ ownerId: viewer.id }).select('memberIds').lean();
    const set = new Set<string>();
    for (const o of owned) for (const m of o.memberIds) set.add(String(m));
    assigneeIds = [...set].map((id) => new mongoose.Types.ObjectId(id));
    if (assigneeIds.length === 0) return [];
  }
  const match: Record<string, unknown> = { status: { $ne: 'DONE' } };
  if (assigneeIds) match.assigneeId = { $in: assigneeIds };
  const rows = await Task.aggregate([
    { $match: match },
    { $group: { _id: '$assigneeId', open: { $sum: 1 } } },
    { $sort: { open: -1 } },
    { $limit: 20 },
  ]);
  return rows;
}

export async function orderSummary(viewer: AuthPrincipal): Promise<unknown> {
  if (viewer.role === 'EMPLOYEE') throw AppError.forbidden('Employees cannot view order reports.');
  // Managers see order counts but not revenue unless admin? MVP: managers get counts only.
  const groups = await Order.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 }, revenue: { $sum: '$subtotal' } } },
  ]);
  if (viewer.role === 'MANAGER') {
    return (groups as { _id: string; count: number }[]).map((g) => ({ status: g._id, count: g.count }));
  }
  const totalRevenue = (groups as { revenue: number }[]).reduce((a, g) => a + (g.revenue ?? 0), 0);
  return { byStatus: groups, totalRevenue };
}

async function taskScopeMatch(viewer: AuthPrincipal): Promise<Record<string, unknown>> {
  if (viewer.role === 'ADMIN') return {};
  if (viewer.role === 'EMPLOYEE') return { assigneeId: new mongoose.Types.ObjectId(viewer.id) };
  const owned = await Project.find({ ownerId: viewer.id }).select('_id').lean();
  return { projectId: { $in: owned.map((p) => p._id) } };
}
