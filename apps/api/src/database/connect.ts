import mongoose from 'mongoose';
import { logger } from '../config/logger.js';

export async function connectDatabase(uri: string): Promise<void> {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri);
  logger.info('mongodb connected', { uri: redact(uri) });
}

function redact(uri: string): string {
  // Avoid logging credentials if URI contains them.
  return uri.replace(/\/\/([^@]+)@/, '//***@');
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
