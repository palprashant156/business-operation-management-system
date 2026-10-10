import mongoose from 'mongoose';
import { AppError } from '../errors/AppError.js';
import { Product } from '../models/Product.js';
import type { PaginationQuery } from '../utils/pagination.js';

export async function listProducts(query: PaginationQuery & { status?: string }): Promise<{ items: unknown[]; total: number }> {
  const filter: Record<string, unknown> = {};
  if (query.status) filter.status = query.status;
  if (query.search) {
    const rx = { $regex: query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    filter.$or = [{ name: rx }, { sku: rx }];
  }
  const total = await Product.countDocuments(filter);
  const items = await Product.find(filter)
    .sort('-createdAt')
    .skip((query.page - 1) * query.limit)
    .limit(query.limit)
    .lean();
  return { items, total };
}

export async function createProduct(input: { name: string; sku: string; description?: string; price: number; stockQuantity: number; status?: 'ACTIVE' | 'INACTIVE' }): Promise<unknown> {
  const sku = input.sku.toUpperCase().trim();
  const dupe = await Product.findOne({ sku }).lean();
  if (dupe) throw AppError.conflict('A product with this SKU already exists.');
  return Product.create({ ...input, sku });
}

export async function getProduct(id: string): Promise<unknown> {
  if (!mongoose.isValidObjectId(id)) throw AppError.badRequest('Invalid id.');
  const doc = await Product.findById(id).lean();
  if (!doc) throw AppError.notFound('Product not found.');
  return doc;
}

export async function updateProduct(
  id: string,
  patch: Partial<{ name: string; description: string; price: number; stockQuantity: number; status: 'ACTIVE' | 'INACTIVE' }>,
): Promise<unknown> {
  if (!mongoose.isValidObjectId(id)) throw AppError.badRequest('Invalid id.');
  // SKU is immutable after creation to keep order snapshots + search stable.
  const doc = await Product.findByIdAndUpdate(id, { $set: patch }, { new: true, runValidators: true }).lean();
  if (!doc) throw AppError.notFound('Product not found.');
  return doc;
}
