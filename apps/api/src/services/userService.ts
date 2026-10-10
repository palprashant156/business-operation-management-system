import mongoose from 'mongoose';
import { AppError } from '../errors/AppError.js';
import { User, toSafeUser } from '../models/User.js';
import { buildMeta, type PaginationQuery } from '../utils/pagination.js';

export async function listUsers(query: PaginationQuery & { status?: string; role?: string; search?: string }): Promise<{
  users: ReturnType<typeof toSafeUser>[];
  total: number;
}> {
  const filter: Record<string, unknown> = {};
  if (query.status) filter.status = query.status;
  if (query.role) filter.role = query.role;
  if (query.search) {
    filter.$or = [
      { name: { $regex: escapeRegex(query.search), $options: 'i' } },
      { email: { $regex: escapeRegex(query.search), $options: 'i' } },
    ];
  }
  const total = await User.countDocuments(filter);
  const docs = await User.find(filter)
    .sort(query.sort ?? '-createdAt')
    .skip((query.page - 1) * query.limit)
    .limit(query.limit)
    .lean();
  return { users: docs.map((d) => toSafeUser(d as never)), total };
}

export async function getUserById(id: string): Promise<ReturnType<typeof toSafeUser>> {
  assertId(id);
  const doc = await User.findById(id).lean();
  if (!doc) throw AppError.notFound('User not found.');
  return toSafeUser(doc as never);
}

export async function updateUser(id: string, patch: { name?: string; status?: 'ACTIVE' | 'INACTIVE' }): Promise<ReturnType<typeof toSafeUser>> {
  assertId(id);
  // Allowlist only: role cannot change here (separate endpoint), email immutable.
  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.status !== undefined) update.status = patch.status;
  const doc = await User.findByIdAndUpdate(id, { $set: update }, { new: true, runValidators: true }).lean();
  if (!doc) throw AppError.notFound('User not found.');
  return toSafeUser(doc as never);
}

export async function changeUserRole(id: string, role: 'ADMIN' | 'MANAGER' | 'EMPLOYEE', actorId: string): Promise<ReturnType<typeof toSafeUser>> {
  assertId(id);
  if (id === actorId) throw AppError.forbidden('You cannot change your own role.');
  const doc = await User.findByIdAndUpdate(id, { $set: { role } }, { new: true }).lean();
  if (!doc) throw AppError.notFound('User not found.');
  return toSafeUser(doc as never);
}

export function assertId(id: string): void {
  if (!mongoose.isValidObjectId(id)) throw AppError.badRequest('Invalid id.');
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export { buildMeta };
