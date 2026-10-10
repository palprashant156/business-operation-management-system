import mongoose, { Schema } from 'mongoose';

export type NotificationType =
  | 'TASK_ASSIGNED'
  | 'TASK_STATUS_CHANGED'
  | 'TASK_DUE_CHANGED'
  | 'PROJECT_MEMBER_ADDED';

export interface NotificationDoc {
  recipientId: mongoose.Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  resourceKind?: string;
  resourceId?: string;
  readAt?: Date | null;
  createdAt: Date;
}

const notificationSchema = new Schema<NotificationDoc>(
  {
    recipientId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, required: true },
    title: { type: String, required: true, maxlength: 160 },
    message: { type: String, required: true, maxlength: 1000 },
    resourceKind: { type: String, maxlength: 40 },
    resourceId: { type: String, maxlength: 60 },
    readAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

notificationSchema.index({ recipientId: 1, readAt: 1, createdAt: -1 });

export const Notification: mongoose.Model<NotificationDoc> =
  (mongoose.models['Notification'] as mongoose.Model<NotificationDoc> | undefined) ??
  mongoose.model<NotificationDoc>('Notification', notificationSchema);
