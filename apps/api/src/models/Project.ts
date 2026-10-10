import mongoose, { Schema } from 'mongoose';

export type ProjectStatus = 'PLANNED' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';

export interface ProjectDoc {
  name: string;
  description?: string;
  ownerId: mongoose.Types.ObjectId;
  memberIds: mongoose.Types.ObjectId[];
  status: ProjectStatus;
  startDate?: Date;
  dueDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const projectSchema = new Schema<ProjectDoc>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 2000 },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    memberIds: [{ type: Schema.Types.ObjectId, ref: 'User', index: true }],
    status: {
      type: String,
      enum: ['PLANNED', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'],
      default: 'PLANNED',
      index: true,
    },
    startDate: { type: Date },
    dueDate: { type: Date },
  },
  { timestamps: true },
);

projectSchema.index({ ownerId: 1, status: 1 });

export const Project: mongoose.Model<ProjectDoc> =
  (mongoose.models['Project'] as mongoose.Model<ProjectDoc> | undefined) ??
  mongoose.model<ProjectDoc>('Project', projectSchema);
