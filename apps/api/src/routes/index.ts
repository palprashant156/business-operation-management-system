import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { registerSchema, loginSchema } from '../validators/auth.js';
import {
  updateUserSchema,
  changeRoleSchema,
  createEmployeeSchema,
  updateEmployeeSchema,
  createCustomerSchema,
  updateCustomerSchema,
  createProductSchema,
  updateProductSchema,
  createProjectSchema,
  updateProjectSchema,
  addMembersSchema,
  createTaskSchema,
  updateTaskSchema,
  changeTaskStatusSchema,
  addCommentSchema,
  createOrderSchema,
  changeOrderStatusSchema,
  listQuerySchema,
} from '../validators/domain.js';
import * as auth from '../controllers/authController.js';
import * as u from '../controllers/userController.js';
import * as d from '../controllers/domainController.js';
import { z } from 'zod';

export const router = Router();

// Health (public)
router.get('/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', time: new Date().toISOString() } });
});

// Auth
router.post('/auth/register', validateBody(registerSchema), auth.register);
router.post('/auth/login', validateBody(loginSchema), auth.login);
router.post('/auth/refresh', auth.refresh);
router.post('/auth/logout', auth.logout);
router.get('/auth/me', requireAuth, auth.me);

// Users (admin only, except self-read handled by policy: admin lists; users read own via /auth/me)
router.get('/users', requireAuth, requireRole('ADMIN'), validateQuery(listQuerySchema), u.listUsers);
router.get('/users/:id', requireAuth, requireRole('ADMIN'), u.getUser);
router.patch('/users/:id', requireAuth, requireRole('ADMIN'), validateBody(updateUserSchema), u.patchUser);
router.patch('/users/:id/role', requireAuth, requireRole('ADMIN'), validateBody(changeRoleSchema), u.patchRole);

// Employees
router.get('/employees', requireAuth, validateQuery(listQuerySchema), u.listEmployees);
router.post('/employees', requireAuth, requireRole('ADMIN'), validateBody(createEmployeeSchema), u.createEmployee);
router.get('/employees/:id', requireAuth, u.getEmployee);
router.patch('/employees/:id', requireAuth, validateBody(updateEmployeeSchema), u.patchEmployee);

// Customers: admin + manager read/write; employee read-only scoped (MVP: read allowed, write denied)
router.get('/customers', requireAuth, validateQuery(listQuerySchema), d.listCustomers);
router.post(
  '/customers',
  requireAuth,
  requireRole('ADMIN', 'MANAGER'),
  validateBody(createCustomerSchema),
  d.createCustomer,
);
router.get('/customers/:id', requireAuth, d.getCustomer);
router.patch(
  '/customers/:id',
  requireAuth,
  requireRole('ADMIN', 'MANAGER'),
  validateBody(updateCustomerSchema),
  d.patchCustomer,
);

// Products
router.get('/products', requireAuth, validateQuery(listQuerySchema), d.listProducts);
router.post('/products', requireAuth, requireRole('ADMIN'), validateBody(createProductSchema), d.createProduct);
router.get('/products/:id', requireAuth, d.getProduct);
router.patch('/products/:id', requireAuth, requireRole('ADMIN'), validateBody(updateProductSchema), d.patchProduct);

// Projects
router.get('/projects', requireAuth, validateQuery(listQuerySchema), d.listProjects);
router.post('/projects', requireAuth, requireRole('ADMIN', 'MANAGER'), validateBody(createProjectSchema), d.createProject);
router.get('/projects/:id', requireAuth, d.getProject);
router.patch('/projects/:id', requireAuth, validateBody(updateProjectSchema), d.patchProject);
router.post('/projects/:id/members', requireAuth, validateBody(addMembersSchema), d.addMembers);

// Tasks
router.get('/tasks', requireAuth, validateQuery(listQuerySchema), d.listTasks);
router.post('/tasks', requireAuth, requireRole('ADMIN', 'MANAGER'), validateBody(createTaskSchema), d.createTask);
router.get('/tasks/:id', requireAuth, d.getTask);
router.patch('/tasks/:id', requireAuth, validateBody(updateTaskSchema), d.patchTask);
router.patch('/tasks/:id/status', requireAuth, validateBody(changeTaskStatusSchema), d.patchTaskStatus);
router.patch(
  '/tasks/:id/assignee',
  requireAuth,
  validateBody(z.object({ assigneeId: z.string().regex(/^[0-9a-fA-F]{24}$/).nullable() }).strict()),
  d.patchTaskAssignee,
);
router.post('/tasks/:id/comments', requireAuth, validateBody(addCommentSchema), d.postTaskComment);

// Orders: employees blocked at service layer too (defense in depth)
router.get('/orders', requireAuth, requireRole('ADMIN', 'MANAGER'), validateQuery(listQuerySchema), d.listOrders);
router.post(
  '/orders',
  requireAuth,
  requireRole('ADMIN', 'MANAGER'),
  validateBody(createOrderSchema),
  d.createOrder,
);
router.get('/orders/:id', requireAuth, requireRole('ADMIN', 'MANAGER'), d.getOrder);
router.patch(
  '/orders/:id/status',
  requireAuth,
  requireRole('ADMIN', 'MANAGER'),
  validateBody(changeOrderStatusSchema),
  d.patchOrderStatus,
);

// Reports
router.get('/reports/tasks', requireAuth, d.reportTasks);
router.get('/reports/projects', requireAuth, d.reportProjects);
router.get('/reports/workload', requireAuth, d.reportWorkload);
router.get('/reports/orders', requireAuth, d.reportOrders);

// Notifications
router.get('/notifications', requireAuth, validateQuery(listQuerySchema), d.listNotifications);
router.patch('/notifications/read-all', requireAuth, d.markAllRead);
router.patch('/notifications/:id/read', requireAuth, d.markRead);
