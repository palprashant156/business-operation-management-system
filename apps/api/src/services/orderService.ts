import mongoose from 'mongoose';
import { AppError } from '../errors/AppError.js';
import { Order, computeSubtotal, isValidOrderTransition, type OrderStatus } from '../models/Order.js';
import { Product } from '../models/Product.js';
import { Customer } from '../models/Customer.js';
import type { AuthPrincipal } from '../middleware/auth.js';
import type { PaginationQuery } from '../utils/pagination.js';

let orderCounter = 0;

export function buildOrderNumber(): string {
  // Human-readable + unique enough for MVP: ORD-YYYYMMDD-XXXX. Uniqueness enforced by DB index.
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  orderCounter = (orderCounter + 1) % 10000;
  const rand = `${Date.now().toString(36).toUpperCase().slice(-4)}${String(orderCounter).padStart(2, '0')}`;
  return `ORD-${ymd}-${rand}`;
}

export async function listOrders(
  query: PaginationQuery & { status?: string; customerId?: string },
): Promise<{ items: unknown[]; total: number }> {
  const filter: Record<string, unknown> = {};
  if (query.status) filter.status = query.status;
  if (query.customerId) {
    if (!mongoose.isValidObjectId(query.customerId)) throw AppError.badRequest('Invalid customerId.');
    filter.customerId = query.customerId;
  }
  if (query.search) filter.orderNumber = { $regex: query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  const total = await Order.countDocuments(filter);
  const items = await Order.find(filter)
    .populate('customerId', 'name email company')
    .sort('-createdAt')
    .skip((query.page - 1) * query.limit)
    .limit(query.limit)
    .lean();
  return { items, total };
}

export async function createOrder(
  viewer: AuthPrincipal,
  input: { customerId: string; items: { productId: string; quantity: number }[] },
): Promise<unknown> {
  if (viewer.role === 'EMPLOYEE') throw AppError.forbidden('Employees cannot create orders.');
  const customer = await Customer.findById(input.customerId).lean();
  if (!customer || customer.status !== 'ACTIVE') throw AppError.badRequest('Customer must exist and be active.');

  // Server validates products + snapshots name/price. Never trust client totals.
  const productIds = [...new Set(input.items.map((i) => i.productId))];
  const products = await Product.find({ _id: { $in: productIds }, status: 'ACTIVE' }).lean();
  if (products.length !== productIds.length) throw AppError.badRequest('All products must exist and be active.');
  const byId = new Map(products.map((p) => [String(p._id), p]));

  const snapshotItems = input.items.map((i) => {
    const p = byId.get(i.productId);
    if (!p) throw AppError.badRequest('Product not found.');
    if (p.stockQuantity < i.quantity) {
      throw AppError.badRequest(`Insufficient stock for ${p.name} (have ${p.stockQuantity}).`);
    }
    return {
      productId: new mongoose.Types.ObjectId(i.productId),
      productName: p.name,
      unitPrice: p.price,
      quantity: i.quantity,
      lineTotal: p.price * i.quantity,
    };
  });

  const subtotal = computeSubtotal(snapshotItems);
  const created = await Order.create({
    orderNumber: buildOrderNumber(),
    customerId: input.customerId,
    items: snapshotItems,
    subtotal,
    status: 'DRAFT',
    createdBy: viewer.id,
  });

  // MVP consistency: decrement stock after order creation (no distributed transaction claimed).
  // For real inventory correctness this needs a transaction + reservation model (see docs/limitations).
  for (const item of snapshotItems) {
    await Product.updateOne({ _id: item.productId }, { $inc: { stockQuantity: -item.quantity } });
  }

  return Order.findById(created._id).populate('customerId', 'name email').lean();
}

export async function getOrder(id: string): Promise<unknown> {
  if (!mongoose.isValidObjectId(id)) throw AppError.badRequest('Invalid id.');
  const doc = await Order.findById(id).populate('customerId', 'name email company').lean();
  if (!doc) throw AppError.notFound('Order not found.');
  return doc;
}

export async function changeOrderStatus(viewer: AuthPrincipal, id: string, next: OrderStatus): Promise<unknown> {
  if (!mongoose.isValidObjectId(id)) throw AppError.badRequest('Invalid id.');
  if (viewer.role === 'EMPLOYEE') throw AppError.forbidden('Employees cannot change order status.');
  const existing = await Order.findById(id).lean();
  if (!existing) throw AppError.notFound('Order not found.');
  if (!isValidOrderTransition(existing.status, next)) {
    throw AppError.badRequest(`Cannot move order from ${existing.status} to ${next}.`);
  }
  const doc = await Order.findByIdAndUpdate(id, { $set: { status: next } }, { new: true }).lean();
  return doc;
}
