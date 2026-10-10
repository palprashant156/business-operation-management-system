import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { startTestDb, stopTestDb, clearDb, app, authHeader } from './helpers.js';
import { User } from '../src/models/User.js';
import { isValidTaskTransition } from '../src/models/Task.js';
import { isValidOrderTransition, computeSubtotal } from '../src/models/Order.js';
import { computeProgress } from '../src/services/projectService.js';

process.env.JWT_ACCESS_SECRET = 'test-access-secret-0123456789abcdef';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-0123456789abcdef';
process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/nexaops_test_unused';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';

const api = app();

describe('unit: business rules', () => {
  it('task lifecycle only allows documented transitions', () => {
    expect(isValidTaskTransition('TODO', 'IN_PROGRESS')).toBe(true);
    expect(isValidTaskTransition('TODO', 'DONE')).toBe(false);
    expect(isValidTaskTransition('REVIEW', 'DONE')).toBe(true);
    expect(isValidTaskTransition('DONE', 'TODO')).toBe(false);
  });

  it('order lifecycle blocks invalid jumps', () => {
    expect(isValidOrderTransition('DRAFT', 'CONFIRMED')).toBe(true);
    expect(isValidOrderTransition('DRAFT', 'COMPLETED')).toBe(false);
    expect(isValidOrderTransition('PROCESSING', 'COMPLETED')).toBe(true);
    expect(isValidOrderTransition('COMPLETED', 'CANCELLED')).toBe(false);
  });

  it('order subtotal is server-computed', () => {
    expect(computeSubtotal([{ unitPrice: 10, quantity: 2 }, { unitPrice: 5, quantity: 3 }])).toBe(35);
  });

  it('project progress = DONE/total, empty = 0', () => {
    expect(computeProgress([])).toBe(0);
    expect(computeProgress(['DONE', 'TODO', 'IN_PROGRESS', 'DONE'])).toBe(50);
  });
});

describe('integration: auth + authorization boundaries', () => {
  beforeAll(async () => {
    await startTestDb();
  });
  afterAll(async () => {
    await stopTestDb();
  });
  beforeEach(async () => {
    await clearDb();
  });

  async function seedRoles(): Promise<{ admin: string; manager: string; employee: string; employeeB: string }> {
    const mk = async (name: string, email: string) => {
      await request(api).post('/api/auth/register').send({ name, email, password: 'Password123' });
      const login = await request(api).post('/api/auth/login').send({ email, password: 'Password123' });
      return login.body.data.accessToken as string;
    };
    const admin = await mk('Admin', 'admin@t.local');
    const manager = await mk('Manager', 'mgr@t.local');
    const employee = await mk('Emp', 'emp@t.local');
    const employeeB = await mk('EmpB', 'empb@t.local');
    // Promote via direct DB update (simulates admin bootstrap; role endpoint tested separately).
    await User.updateOne({ email: 'admin@t.local' }, { $set: { role: 'ADMIN' } });
    await User.updateOne({ email: 'mgr@t.local' }, { $set: { role: 'MANAGER' } });
    // Re-login to get correct role claims.
    const relog = async (email: string) => {
      const r = await request(api).post('/api/auth/login').send({ email, password: 'Password123' });
      return r.body.data.accessToken as string;
    };
    return {
      admin: await relog('admin@t.local'),
      manager: await relog('mgr@t.local'),
      employee: await relog('emp@t.local'),
      employeeB: await relog('empb@t.local'),
    };
  }

  it('5. unauthenticated user cannot access protected APIs', async () => {
    const r = await request(api).get('/api/projects');
    expect(r.status).toBe(401);
  });

  it('1. employee cannot change own role (mass-assignment + endpoint guard)', async () => {
    const t = await seedRoles();
    // Try to sneak role through generic PATCH.
    const sneak = await request(api)
      .patch('/api/users/000000000000000000000000')
      .set(authHeader(t.employee))
      .send({ role: 'ADMIN' });
    expect([401, 403, 404]).toContain(sneak.status);

    // Resolve own id via /me then attempt role endpoint.
    const me = await request(api).get('/api/auth/me').set(authHeader(t.employee));
    const ownId = me.body.data.user.id as string;
    const r = await request(api)
      .patch(`/api/users/${ownId}/role`)
      .set(authHeader(t.employee))
      .send({ role: 'ADMIN' });
    expect(r.status).toBe(403);
  });

  it('4. manager cannot perform admin-only actions', async () => {
    const t = await seedRoles();
    const r = await request(api).get('/api/users').set(authHeader(t.manager));
    expect(r.status).toBe(403);
  });

  it('3. manager cannot access projects outside scope; 2. employee cannot touch others tasks; 6. protected fields guard', async () => {
    const t = await seedRoles();

    // Admin creates two projects, each owned by admin, with different members.
    const meEmp = await request(api).get('/api/auth/me').set(authHeader(t.employee));
    const meEmpB = await request(api).get('/api/auth/me').set(authHeader(t.employeeB));
    const empId = meEmp.body.data.user.id as string;
    const empBId = meEmpB.body.data.user.id as string;

    const p1 = await request(api)
      .post('/api/projects')
      .set(authHeader(t.admin))
      .send({ name: 'P1', memberIds: [empId] });
    expect(p1.status).toBe(201);
    const p1Id = p1.body.data._id as string;

    const p2 = await request(api)
      .post('/api/projects')
      .set(authHeader(t.admin))
      .send({ name: 'P2', memberIds: [empBId] });
    const p2Id = p2.body.data._id as string;

    // Manager (not owner/member) cannot view P1 -> outside scope.
    const denied = await request(api).get(`/api/projects/${p1Id}`).set(authHeader(t.manager));
    expect(denied.status).toBe(403);

    // Create task in P1 assigned to emp.
    const task = await request(api)
      .post('/api/tasks')
      .set(authHeader(t.admin))
      .send({ title: 'Secret task', projectId: p1Id, assigneeId: empId });
    expect(task.status).toBe(201);
    const taskId = task.body.data._id as string;

    // Employee B tries to edit employee A's task -> forbidden.
    const cross = await request(api)
      .patch(`/api/tasks/${taskId}`)
      .set(authHeader(t.employeeB))
      .send({ title: 'hijacked' });
    expect(cross.status).toBe(403);

    // Mass assignment: employee tries to change owner/project via PATCH.
    const mass = await request(api)
      .patch(`/api/tasks/${taskId}`)
      .set(authHeader(t.employee))
      .send({ title: 'ok edit', ownerId: empBId, projectId: p2Id } as never);
    // Strict zod schema rejects unknown keys -> 400, and even if passed, service allowlists.
    expect([400]).toContain(mass.status);
    void mongoose;
  });

  it('7. employee cannot access org-wide order reports', async () => {
    const t = await seedRoles();
    const r = await request(api).get('/api/reports/orders').set(authHeader(t.employee));
    expect(r.status).toBe(403);
  });

  it('pagination caps limit at 100', async () => {
    const t = await seedRoles();
    const r = await request(api).get('/api/products?limit=500').set(authHeader(t.admin));
    expect(r.status).toBe(400);
  });

  it('invalid task transition rejected', async () => {
    const t = await seedRoles();
    const meEmp = await request(api).get('/api/auth/me').set(authHeader(t.employee));
    const empId = meEmp.body.data.user.id as string;
    const p = await request(api).post('/api/projects').set(authHeader(t.admin)).send({ name: 'PX', memberIds: [empId] });
    const pid = p.body.data._id as string;
    const task = await request(api).post('/api/tasks').set(authHeader(t.admin)).send({ title: 'Seed Task', projectId: pid, assigneeId: empId });
    const tid = task.body.data._id as string;
    const jump = await request(api).patch(`/api/tasks/${tid}/status`).set(authHeader(t.admin)).send({ status: 'DONE' });
    expect(jump.status).toBe(400);
  });
});
