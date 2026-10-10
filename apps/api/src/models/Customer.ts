import mongoose, { Schema } from 'mongoose';

export interface CustomerDoc {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: Date;
  updatedAt: Date;
}

const customerSchema = new Schema<CustomerDoc>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 160, index: true },
    phone: { type: String, trim: true, maxlength: 30 },
    company: { type: String, trim: true, maxlength: 120 },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE', index: true },
  },
  { timestamps: true },
);

customerSchema.index({ name: 'text', company: 'text' });

export const Customer: mongoose.Model<CustomerDoc> =
  (mongoose.models['Customer'] as mongoose.Model<CustomerDoc> | undefined) ??
  mongoose.model<CustomerDoc>('Customer', customerSchema);
