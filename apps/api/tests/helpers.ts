import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { createApp } from '../src/app.js';

let mongod: MongoMemoryServer;

export async function startTestDb(): Promise<string> {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri('nexaops_test');
  await mongoose.connect(uri);
  return uri;
}

export async function stopTestDb(): Promise<void> {
  await mongoose.disconnect();
  await mongod?.stop();
}

export async function clearDb(): Promise<void> {
  const cols = mongoose.connection.collections;
  for (const c of Object.values(cols)) await c.deleteMany({});
}

export function app(): ReturnType<typeof createApp> {
  process.env.CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173';
  return createApp();
}

export async function registerAndLogin(
  agent: ReturnType<typeof request.agent>,
  name: string,
  email: string,
  password = 'Password123',
): Promise<{ accessToken: string }> {
  await agent.post('/api/auth/register').send({ name, email, password });
  const res = await agent.post('/api/auth/login').send({ email, password });
  return { accessToken: res.body.data.accessToken as string };
}

export function authHeader(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}
