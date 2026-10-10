import mongoose, { Schema } from 'mongoose';

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface TaskComment {
  authorId: mongoose.Types.ObjectId;
  body: string;
  createdAt: Date;
}

export interface TaskDoc {
  title: string;
  description?: string;
  projectId: mongoose.Types.ObjectId;
  assigneeId?: mongoose.Types.ObjectId | null;
  createdBy: mongoose.Types.ObjectId;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: Date;
  comments: TaskComment[];
  createdAt: Date;
  updatedAt: Date;
}

const commentSchema = new Schema<TaskComment>(
  {
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
    createdAt: { type: Date, default: () => new Date() },
  },
  { _id: false },
);

const taskSchema = new Schema<TaskDoc>(
  {
    title: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, trim: true, maxlength: 3000 },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    assigneeId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'], default: 'TODO', index: true },
    priority: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'], default: 'MEDIUM', index: true },
    dueDate: { type: Date },
    comments: { type: [commentSchema], default: [] },
  },
  { timestamps: true },
);

taskSchema.index({ assigneeId: 1, status: 1 });
taskSchema.index({ projectId: 1, status: 1 });

/** Documented lifecycle: TODO -> IN_PROGRESS -> REVIEW -> DONE. Reopen allowed REVIEW->IN_PROGRESS, DONE->REVIEW by manager/admin. */
export const TASK_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  TODO: ['IN_PROGRESS'],
  IN_PROGRESS: ['REVIEW', 'TODO'],
  REVIEW: ['DONE', 'IN_PROGRESS'],
  DONE: ['REVIEW'],
};

export function isValidTaskTransition(from: TaskStatus, to: TaskStatus): boolean {
  return TASK_TRANSITIONS[from]?.includes(to) ?? false;
}

export const Task: mongoose.Model<TaskDoc> =
  (mongoose.models['Task'] as mongoose.Model<TaskDoc> | undefined) ??
  mongoose.model<TaskDoc>('Task', taskSchema);
