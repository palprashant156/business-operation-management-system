import mongoose, { Schema } from 'mongoose';

export type EmployeeStatus = 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE';

export interface EmployeeDoc {
  userId: mongoose.Types.ObjectId;
  employeeCode: string;
  department: string;
  jobTitle: string;
  managerId?: mongoose.Types.ObjectId | null;
  joiningDate: Date;
  status: EmployeeStatus;
  createdAt: Date;
  updatedAt: Date;
}

const employeeSchema = new Schema<EmployeeDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    employeeCode: { type: String, required: true, unique: true, trim: true, maxlength: 24 },
    department: { type: String, required: true, trim: true, maxlength: 60, index: true },
    jobTitle: { type: String, required: true, trim: true, maxlength: 80 },
    managerId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    joiningDate: { type: Date, required: true },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE', 'ON_LEAVE'], default: 'ACTIVE', index: true },
  },
  { timestamps: true },
);

export const Employee: mongoose.Model<EmployeeDoc> =
  (mongoose.models['Employee'] as mongoose.Model<EmployeeDoc> | undefined) ??
  mongoose.model<EmployeeDoc>('Employee', employeeSchema);
