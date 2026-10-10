import mongoose, { Schema } from 'mongoose';

export type OrderStatus = 'DRAFT' | 'CONFIRMED' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED';

export interface OrderItem {
  productId: mongoose.Types.ObjectId;
  productName: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface OrderDoc {
  orderNumber: string;
  customerId: mongoose.Types.ObjectId;
  items: OrderItem[];
  subtotal: number;
  status: OrderStatus;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const itemSchema = new Schema<OrderItem>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: { type: String, required: true, maxlength: 120 },
    unitPrice: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1, max: 1000 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const orderSchema = new Schema<OrderDoc>(
  {
    orderNumber: { type: String, required: true, unique: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    items: { type: [itemSchema], required: true, validate: [(v: OrderItem[]) => v.length > 0, 'Order needs at least one item.'] },
    subtotal: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['DRAFT', 'CONFIRMED', 'PROCESSING', 'COMPLETED', 'CANCELLED'],
      default: 'DRAFT',
      index: true,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

orderSchema.index({ customerId: 1, status: 1 });

/** DRAFT -> CONFIRMED -> PROCESSING -> COMPLETED; CANCELLED from DRAFT/CONFIRMED. */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  DRAFT: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
};

export function isValidOrderTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from]?.includes(to) ?? false;
}

export function computeSubtotal(items: Pick<OrderItem, 'unitPrice' | 'quantity'>[]): number {
  return items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
}

export const Order: mongoose.Model<OrderDoc> =
  (mongoose.models['Order'] as mongoose.Model<OrderDoc> | undefined) ??
  mongoose.model<OrderDoc>('Order', orderSchema);
