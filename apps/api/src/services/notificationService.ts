import mongoose from 'mongoose';
import { Notification, type NotificationType } from '../models/Notification.js';

interface CreateNotificationInput {
  recipientId: string;
  type: NotificationType;
  title: string;
  message: string;
  resourceKind?: string;
  resourceId?: string;
}

export async function createNotification(input: CreateNotificationInput): Promise<void> {
  if (!mongoose.isValidObjectId(input.recipientId)) return;
  await Notification.create({
    recipientId: input.recipientId,
    type: input.type,
    title: input.title,
    message: input.message,
    resourceKind: input.resourceKind,
    resourceId: input.resourceId,
  });
}

export async function notifyTaskAssigned(recipientId: string, taskTitle: string, taskId: string): Promise<void> {
  await createNotification({
    recipientId,
    type: 'TASK_ASSIGNED',
    title: 'New task assigned',
    message: `You were assigned: ${taskTitle}`,
    resourceKind: 'task',
    resourceId: taskId,
  });
}

export async function notifyTaskStatus(
  recipientId: string,
  taskTitle: string,
  status: string,
  taskId: string,
): Promise<void> {
  await createNotification({
    recipientId,
    type: 'TASK_STATUS_CHANGED',
    title: 'Task status updated',
    message: `${taskTitle} is now ${status}`,
    resourceKind: 'task',
    resourceId: taskId,
  });
}

export async function notifyProjectMembers(
  memberIds: string[],
  projectName: string,
  projectId: string,
): Promise<void> {
  if (memberIds.length === 0) return;
  const docs = memberIds
    .filter((id) => mongoose.isValidObjectId(id))
    .map((recipientId) => ({
      recipientId: new mongoose.Types.ObjectId(recipientId),
      type: 'PROJECT_MEMBER_ADDED' as NotificationType,
      title: 'Added to project',
      message: `You were added to project: ${projectName}`,
      resourceKind: 'project',
      resourceId: projectId,
    }));
  if (docs.length === 0) return;
  await Notification.insertMany(docs);
}
