import { z } from 'zod';
import { paginationQuerySchema } from '../utils/pagination.js';

export const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id.');

export const listQuerySchema = paginationQuerySchema.extend({
  status: z.string().max(30).optional(),
  department: z.string().max(60).optional(),
  role: z.enum(['ADMIN', 'MANAGER', 'EMPLOYEE']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  projectId: z.string().max(40).optional(),
  assigneeId: z.string().max(40).optional(),
  customerId: z.string().max(40).optional(),
});

export const updateUserSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  // role/managerId/ownerId/createdBy/passwordHash forbidden here -> mass-assignment guard.
}).strict();

export const changeRoleSchema = z.object({
  role: z.enum(['ADMIN', 'MANAGER', 'EMPLOYEE']),
}).strict();

export const createEmployeeSchema = z.object({
  userId: objectId,
  employeeCode: z.string().trim().min(2).max(24),
  department: z.string().trim().min(2).max(60),
  jobTitle: z.string().trim().min(2).max(80),
  managerId: objectId.nullable().optional(),
  joiningDate: z.coerce.date(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ON_LEAVE']).optional(),
}).strict();

export const updateEmployeeSchema = z.object({
  department: z.string().trim().min(2).max(60).optional(),
  jobTitle: z.string().trim().min(2).max(80).optional(),
  managerId: objectId.nullable().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ON_LEAVE']).optional(),
  joiningDate: z.coerce.date().optional(),
}).strict();

export const createCustomerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email('Invalid email.').max(160),
  phone: z.string().trim().max(30).optional(),
  company: z.string().trim().max(120).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
}).strict();

export const updateCustomerSchema = createCustomerSchema.partial().strict();

export const createProductSchema = z.object({
  name: z.string().trim().min(2).max(120),
  sku: z.string().trim().min(2).max(40),
  description: z.string().trim().max(1000).optional(),
  price: z.number().min(0, 'Price must be non-negative.').max(1_000_000),
  stockQuantity: z.number().int().min(0, 'Stock must be non-negative.').max(1_000_000),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
}).strict();

export const updateProductSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(1000).optional(),
  price: z.number().min(0).max(1_000_000).optional(),
  stockQuantity: z.number().int().min(0).max(1_000_000).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
}).strict();

export const createProjectSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).optional(),
  memberIds: z.array(objectId).max(50).default([]),
  status: z.enum(['PLANNED', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED']).optional(),
  startDate: z.coerce.date().optional(),
  dueDate: z.coerce.date().optional(),
}).strict();

export const updateProjectSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(2000).optional(),
  status: z.enum(['PLANNED', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED']).optional(),
  startDate: z.coerce.date().optional(),
  dueDate: z.coerce.date().optional(),
}).strict();

export const addMembersSchema = z.object({
  memberIds: z.array(objectId).min(1).max(50),
}).strict();

export const createTaskSchema = z.object({
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(3000).optional(),
  projectId: objectId,
  assigneeId: objectId.nullable().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  dueDate: z.coerce.date().optional(),
  status: z.enum(['TODO']).optional(),
}).strict();

export const updateTaskSchema = z.object({
  title: z.string().trim().min(2).max(160).optional(),
  description: z.string().trim().max(3000).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  dueDate: z.coerce.date().nullable().optional(),
}).strict();

export const changeTaskStatusSchema = z.object({
  status: z.enum(['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE']),
}).strict();

export const addCommentSchema = z.object({
  body: z.string().trim().min(1).max(2000),
}).strict();

export const createOrderSchema = z.object({
  customerId: objectId,
  items: z
    .array(
      z.object({
        productId: objectId,
        quantity: z.number().int().min(1, 'Quantity must be at least 1.').max(1000),
      }).strict(),
    )
    .min(1)
    .max(50),
}).strict();

export const changeOrderStatusSchema = z.object({
  status: z.enum(['DRAFT', 'CONFIRMED', 'PROCESSING', 'COMPLETED', 'CANCELLED']),
}).strict();
