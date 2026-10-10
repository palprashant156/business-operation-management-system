import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { connectDatabase, disconnectDatabase } from '../database/connect.js';
import { User } from '../models/User.js';
import { Employee } from '../models/Employee.js';
import { Customer } from '../models/Customer.js';
import { Product } from '../models/Product.js';
import { Project } from '../models/Project.js';
import { Task } from '../models/Task.js';
import { hashPassword } from '../utils/password.js';

// Demo dataset for local dev + interviews. Idempotent via upserts on unique keys.
async function main(): Promise<void> {
  await connectDatabase(env.MONGO_URI);

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@nexaops.local';
  const managerEmail = process.env.SEED_MANAGER_EMAIL ?? 'manager@nexaops.local';
  const employeeEmail = process.env.SEED_EMPLOYEE_EMAIL ?? 'employee@nexaops.local';

  const admin = await upsertUser('Ava Admin', adminEmail, process.env.SEED_ADMIN_PASSWORD ?? 'Admin123!', 'ADMIN');
  const manager = await upsertUser('Miles Manager', managerEmail, process.env.SEED_MANAGER_PASSWORD ?? 'Manager123!', 'MANAGER');
  const employee = await upsertUser('Ellie Employee', employeeEmail, process.env.SEED_EMPLOYEE_PASSWORD ?? 'Employee123!', 'EMPLOYEE');

  await upsertEmployee(admin._id, 'EMP-001', 'Operations', 'Administrator', null);
  await upsertEmployee(manager._id, 'EMP-002', 'Engineering', 'Engineering Manager', null);
  await upsertEmployee(employee._id, 'EMP-003', 'Engineering', 'Software Engineer', manager._id);

  await Customer.updateOne(
    { email: 'acme@example.com' },
    { $setOnInsert: { name: 'Acme Corp', email: 'acme@example.com', company: 'Acme Corp', phone: '+1-555-0100', status: 'ACTIVE' } },
    { upsert: true },
  );

  await Product.updateOne(
    { sku: 'WIDGET-001' },
    { $setOnInsert: { name: 'Starter Widget', sku: 'WIDGET-001', description: 'Demo product', price: 49.99, stockQuantity: 500, status: 'ACTIVE' } },
    { upsert: true },
  );
  await Product.updateOne(
    { sku: 'GADGET-002' },
    { $setOnInsert: { name: 'Pro Gadget', sku: 'GADGET-002', description: 'Demo product', price: 149.0, stockQuantity: 200, status: 'ACTIVE' } },
    { upsert: true },
  );

  const existing = await Project.findOne({ name: 'Website Redesign' }).lean();
  if (!existing) {
    const p = await Project.create({
      name: 'Website Redesign',
      description: 'Seed project for demo walkthrough.',
      ownerId: manager._id,
      memberIds: [manager._id, employee._id],
      status: 'ACTIVE',
      startDate: new Date(),
      dueDate: new Date(Date.now() + 30 * 24 * 3600 * 1000),
    });
    await Task.create([
      { title: 'Draft sitemap', projectId: p._id, assigneeId: employee._id, createdBy: manager._id, status: 'DONE', priority: 'MEDIUM' },
      { title: 'Build landing page', projectId: p._id, assigneeId: employee._id, createdBy: manager._id, status: 'IN_PROGRESS', priority: 'HIGH' },
      { title: 'QA pass', projectId: p._id, assigneeId: manager._id, createdBy: manager._id, status: 'TODO', priority: 'LOW' },
    ]);
  }

  logger.info('seed complete', { admin: adminEmail, manager: managerEmail, employee: employeeEmail });
  await disconnectDatabase();
  await mongoose.disconnect();
}

async function upsertUser(name: string, email: string, password: string, role: 'ADMIN' | 'MANAGER' | 'EMPLOYEE'): Promise<{ _id: mongoose.Types.ObjectId }> {
  const found = await User.findOne({ email: email.toLowerCase() }).lean();
  if (found) return { _id: found._id as mongoose.Types.ObjectId };
  const created = await User.create({ name, email: email.toLowerCase(), passwordHash: await hashPassword(password), role, status: 'ACTIVE' });
  return { _id: created._id as mongoose.Types.ObjectId };
}

async function upsertEmployee(
  userId: mongoose.Types.ObjectId,
  code: string,
  dept: string,
  title: string,
  managerId: mongoose.Types.ObjectId | null,
): Promise<void> {
  await Employee.updateOne(
    { employeeCode: code },
    { $setOnInsert: { userId, employeeCode: code, department: dept, jobTitle: title, managerId, joiningDate: new Date(), status: 'ACTIVE' } },
    { upsert: true },
  );
}

main().catch((err) => {
  logger.error('seed failed', { err: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
