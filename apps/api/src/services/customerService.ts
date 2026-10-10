import mongoose from 'mongoose';
import { AppError } from '../errors/AppError.js';
import { Customer } from '../models/Customer.js';
import type { PaginationQuery } from '../utils/pagination.js';

export async function listCustomers(query: PaginationQuery & { status?: string }): Promise<{ items: unknown[]; total: number }> {
  const filter: Record<string, unknown> = {};
  if (query.status) filter.status = query.status;
  if (query.search) {
    const rx = { $regex: query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    filter.$or = [{ name: rx }, { email: rx }, { company: rx }];
  }
  const total = await Customer.countDocuments(filter);
  const items = await Customer.find(filter)
    .sort('-createdAt')
    .skip((query.page - 1) * query.limit)
    .limit(query.limit)
    .lean();
  return { items, total };
}

export async function createCustomer(input: { name: string; email: string; phone?: string; company?: string; status?: 'ACTIVE' | 'INACTIVE' }): Promise<unknown> {
  const dupe = await Customer.findOne({ email: input.email.toLowerCase() }).lean();
  if (dupe) throw AppError.conflict('A customer with this email already exists.');
  return Customer.create({ ...input, email: input.email.toLowerCase() });
}

export async function getCustomer(id: string): Promise<unknown> {
  assertId(id);
  const doc = await Customer.findById(id).lean();
  if (!doc) throw AppError.notFound('Customer not found.');
  return doc;
}

export async function updateCustomer(id: string, patch: Partial<{ name: string; email: string; phone: string; company: string; status: 'ACTIVE' | 'INACTIVE' }>): Promise<unknown> {
  assertId(id);
  if (patch.email) {
    const dupe = await Customer.findOne({ email: patch.email.toLowerCase(), _id: { $ne: id } }).lean();
    if (dupe) throw AppError.conflict('Another customer uses this email.');
    patch.email = patch.email.toLowerCase();
  }
  const doc = await Customer.findByIdAndUpdate(id, { $set: patch }, { new: true, runValidators: true }).lean();
  if (!doc) throw AppError.notFound('Customer not found.');
  return doc;
}

function assertId(id: string): void {
  if (!mongoose.isValidObjectId(id)) throw AppError.badRequest('Invalid id.');
}
