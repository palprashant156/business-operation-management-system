import mongoose from 'mongoose';
import { AppError } from '../errors/AppError.js';
import { Employee } from '../models/Employee.js';
import { User } from '../models/User.js';
import type { AuthPrincipal } from '../middleware/auth.js';
import { buildMeta, type PaginationQuery } from '../utils/pagination.js';

export async function listEmployees(
  viewer: AuthPrincipal,
  query: PaginationQuery & { status?: string; department?: string; search?: string },
): Promise<{ employees: unknown[]; total: number }> {
  const filter: Record<string, unknown> = {};
  if (query.status) filter.status = query.status;
  if (query.department) filter.department = query.department;

  // Scope: managers see only their direct reports; employees see only themselves.
  if (viewer.role === 'MANAGER') {
    filter.managerId = new mongoose.Types.ObjectId(viewer.id);
  } else if (viewer.role === 'EMPLOYEE') {
    filter.userId = new mongoose.Types.ObjectId(viewer.id);
  }

  if (query.search) {
    const rx = { $regex: query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    filter.$or = [{ employeeCode: rx }, { department: rx }, { jobTitle: rx }];
  }

  const total = await Employee.countDocuments(filter);
  const docs = await Employee.find(filter)
    .populate('userId', 'name email role status')
    .sort('-createdAt')
    .skip((query.page - 1) * query.limit)
    .limit(query.limit)
    .lean();
  void buildMeta;
  return { employees: docs, total };
}

export async function getEmployee(viewer: AuthPrincipal, id: string): Promise<unknown> {
  if (!mongoose.isValidObjectId(id)) throw AppError.badRequest('Invalid id.');
  const doc = await Employee.findById(id).populate('userId', 'name email role status').lean();
  if (!doc) throw AppError.notFound('Employee not found.');
  enforceEmployeeVisibility(viewer, doc as { userId: { _id: unknown }; managerId: unknown });
  return doc;
}

export async function createEmployee(input: {
  userId: string;
  employeeCode: string;
  department: string;
  jobTitle: string;
  managerId?: string | null;
  joiningDate: Date;
  status?: 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE';
}): Promise<unknown> {
  const user = await User.findById(input.userId).lean();
  if (!user) throw AppError.badRequest('Linked user does not exist.');
  const dupe = await Employee.findOne({ $or: [{ userId: input.userId }, { employeeCode: input.employeeCode }] }).lean();
  if (dupe) throw AppError.conflict('Employee record or code already exists for this user.');
  if (input.managerId) {
    const mgr = await User.findById(input.managerId).lean();
    if (!mgr || (mgr.role !== 'MANAGER' && mgr.role !== 'ADMIN')) {
      throw AppError.badRequest('Manager must be an existing MANAGER or ADMIN user.');
    }
  }
  const created = await Employee.create({
    userId: input.userId,
    employeeCode: input.employeeCode.trim(),
    department: input.department.trim(),
    jobTitle: input.jobTitle.trim(),
    managerId: input.managerId ?? null,
    joiningDate: input.joiningDate,
    status: input.status ?? 'ACTIVE',
  });
  return Employee.findById(created._id).populate('userId', 'name email role status').lean();
}

export async function updateEmployee(
  viewer: AuthPrincipal,
  id: string,
  patch: { department?: string; jobTitle?: string; managerId?: string | null; status?: 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE'; joiningDate?: Date },
): Promise<unknown> {
  if (!mongoose.isValidObjectId(id)) throw AppError.badRequest('Invalid id.');
  // Only ADMIN may change managerId/status; managers/employees cannot self-elevate scope.
  if (viewer.role !== 'ADMIN' && (patch.managerId !== undefined || patch.status !== undefined)) {
    throw AppError.forbidden('Only admins can change manager or employment status.');
  }
  const update: Record<string, unknown> = {};
  if (patch.department !== undefined) update.department = patch.department;
  if (patch.jobTitle !== undefined) update.jobTitle = patch.jobTitle;
  if (patch.joiningDate !== undefined) update.joiningDate = patch.joiningDate;
  if (viewer.role === 'ADMIN') {
    if (patch.managerId !== undefined) update.managerId = patch.managerId;
    if (patch.status !== undefined) update.status = patch.status;
  }
  const doc = await Employee.findByIdAndUpdate(id, { $set: update }, { new: true, runValidators: true })
    .populate('userId', 'name email role status')
    .lean();
  if (!doc) throw AppError.notFound('Employee not found.');
  return doc;
}

function enforceEmployeeVisibility(viewer: AuthPrincipal, doc: { userId: { _id: unknown }; managerId: unknown }): void {
  if (viewer.role === 'ADMIN') return;
  if (viewer.role === 'MANAGER') {
    if (String(doc.managerId ?? '') === viewer.id) return;
    if (String((doc.userId as unknown as { _id: unknown })._id ?? doc.userId) === viewer.id) return;
    throw AppError.forbidden('Employee is outside your managed scope.');
  }
  const uid = String((doc.userId as unknown as { _id?: unknown })._id ?? doc.userId);
  if (uid !== viewer.id) throw AppError.forbidden('You can only view your own employee profile.');
}
