import mongoose, { Schema } from 'mongoose';

export interface ProductDoc {
  name: string;
  sku: string;
  description?: string;
  price: number;
  stockQuantity: number;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: Date;
  updatedAt: Date;
}

const productSchema = new Schema<ProductDoc>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    sku: { type: String, required: true, unique: true, uppercase: true, trim: true, maxlength: 40 },
    description: { type: String, trim: true, maxlength: 1000 },
    price: { type: Number, required: true, min: [0, 'Price must be non-negative.'] },
    stockQuantity: { type: Number, required: true, min: [0, 'Stock must be non-negative.'], default: 0 },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE', index: true },
  },
  { timestamps: true },
);

productSchema.index({ name: 'text', sku: 'text' });

export const Product: mongoose.Model<ProductDoc> =
  (mongoose.models['Product'] as mongoose.Model<ProductDoc> | undefined) ??
  mongoose.model<ProductDoc>('Product', productSchema);
