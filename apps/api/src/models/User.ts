import mongoose, { Schema } from 'mongoose';

export type UserRole = 'ADMIN' | 'MANAGER' | 'EMPLOYEE';
export type UserStatus = 'ACTIVE' | 'INACTIVE';

export interface UserDoc {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserDoc>(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 160,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email address.'],
    },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['ADMIN', 'MANAGER', 'EMPLOYEE'], default: 'EMPLOYEE', index: true },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE', index: true },
  },
  { timestamps: true },
);

export type UserModel = mongoose.HydratedDocument<UserDoc> & { _id: mongoose.Types.ObjectId };
export const User: mongoose.Model<UserDoc> =
  (mongoose.models['User'] as mongoose.Model<UserDoc> | undefined) ??
  mongoose.model<UserDoc>('User', userSchema);

export function toSafeUser(u: { _id: unknown; name: string; email: string; role: UserRole; status: UserStatus; createdAt: Date; updatedAt: Date }): {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
} {
  return {
    id: String(u._id),
    name: u.name,
    email: u.email,
    role: u.role,
    status: u.status,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
}
