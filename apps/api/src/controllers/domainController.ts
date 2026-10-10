import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { buildMeta, ok, type PaginationQuery } from '../utils/pagination.js';
import * as customers from '../services/customerService.js';
import * as products from '../services/productService.js';
import * as projects from '../services/projectService.js';
import * as tasks from '../services/taskService.js';
import * as orders from '../services/orderService.js';
import * as reports from '../services/reportService.js';
import { Notification } from '../models/Notification.js';
import { AppError } from '../errors/AppError.js';
import mongoose from 'mongoose';

type VQ = { validatedQuery: PaginationQuery & Record<string, string | undefined> };
const qOf = (req: Request): PaginationQuery & Record<string, string | undefined> =>
  (req as unknown as VQ).validatedQuery;

// Customers
export const listCustomers = asyncHandler(async (req, res) => {
  const q = qOf(req);
  const { items, total } = await customers.listCustomers(q);
  res.json(ok(items, buildMeta(q.page, q.limit, total)));
});
export const createCustomer = asyncHandler(async (req, res: Response) => {
  res.status(201).json(ok(await customers.createCustomer(req.body)));
});
export const getCustomer = asyncHandler(async (req, res: Response) => {
  res.json(ok(await customers.getCustomer(req.params.id as string)));
});
export const patchCustomer = asyncHandler(async (req, res: Response) => {
  res.json(ok(await customers.updateCustomer(req.params.id as string, req.body)));
});

// Products
export const listProducts = asyncHandler(async (req, res: Response) => {
  const q = qOf(req);
  const { items, total } = await products.listProducts(q);
  res.json(ok(items, buildMeta(q.page, q.limit, total)));
});
export const createProduct = asyncHandler(async (req, res: Response) => {
  res.status(201).json(ok(await products.createProduct(req.body)));
});
export const getProduct = asyncHandler(async (req, res: Response) => {
  res.json(ok(await products.getProduct(req.params.id as string)));
});
export const patchProduct = asyncHandler(async (req, res: Response) => {
  res.json(ok(await products.updateProduct(req.params.id as string, req.body)));
});

// Projects
export const listProjects = asyncHandler(async (req, res: Response) => {
  const q = qOf(req);
  const { items, total } = await projects.listProjects(req.user!, q);
  res.json(ok(items, buildMeta(q.page, q.limit, total)));
});
export const createProject = asyncHandler(async (req, res: Response) => {
  res.status(201).json(ok(await projects.createProject(req.user!, req.body)));
});
export const getProject = asyncHandler(async (req, res: Response) => {
  res.json(ok(await projects.getProject(req.user!, req.params.id as string)));
});
export const patchProject = asyncHandler(async (req, res: Response) => {
  res.json(ok(await projects.updateProject(req.user!, req.params.id as string, req.body)));
});
export const addMembers = asyncHandler(async (req, res: Response) => {
  res.json(ok(await projects.addProjectMembers(req.user!, req.params.id as string, req.body.memberIds)));
});

// Tasks
export const listTasks = asyncHandler(async (req, res: Response) => {
  const q = qOf(req);
  const { items, total } = await tasks.listTasks(req.user!, q);
  res.json(ok(items, buildMeta(q.page, q.limit, total)));
});
export const createTask = asyncHandler(async (req, res: Response) => {
  res.status(201).json(ok(await tasks.createTask(req.user!, req.body)));
});
export const getTask = asyncHandler(async (req, res: Response) => {
  res.json(ok(await tasks.getTask(req.user!, req.params.id as string)));
});
export const patchTask = asyncHandler(async (req, res: Response) => {
  res.json(ok(await tasks.updateTask(req.user!, req.params.id as string, req.body)));
});
export const patchTaskStatus = asyncHandler(async (req, res: Response) => {
  res.json(ok(await tasks.changeTaskStatus(req.user!, req.params.id as string, req.body.status)));
});
export const patchTaskAssignee = asyncHandler(async (req, res: Response) => {
  res.json(ok(await tasks.assignTask(req.user!, req.params.id as string, req.body.assigneeId ?? null)));
});
export const postTaskComment = asyncHandler(async (req, res: Response) => {
  res.status(201).json(ok(await tasks.addTaskComment(req.user!, req.params.id as string, req.body.body)));
});

// Orders
export const listOrders = asyncHandler(async (req, res: Response) => {
  const q = qOf(req);
  const { items, total } = await orders.listOrders(q);
  res.json(ok(items, buildMeta(q.page, q.limit, total)));
});
export const createOrder = asyncHandler(async (req, res: Response) => {
  res.status(201).json(ok(await orders.createOrder(req.user!, req.body)));
});
export const getOrder = asyncHandler(async (req, res: Response) => {
  res.json(ok(await orders.getOrder(req.params.id as string)));
});
export const patchOrderStatus = asyncHandler(async (req, res: Response) => {
  res.json(ok(await orders.changeOrderStatus(req.user!, req.params.id as string, req.body.status)));
});

// Reports
export const reportTasks = asyncHandler(async (req, res: Response) => {
  res.json(ok(await reports.taskSummary(req.user!)));
});
export const reportProjects = asyncHandler(async (req, res: Response) => {
  res.json(ok(await reports.projectProgress(req.user!)));
});
export const reportWorkload = asyncHandler(async (req, res: Response) => {
  res.json(ok(await reports.workload(req.user!)));
});
export const reportOrders = asyncHandler(async (req, res: Response) => {
  res.json(ok(await reports.orderSummary(req.user!)));
});

// Notifications
export const listNotifications = asyncHandler(async (req: Request, res: Response) => {
  const q = qOf(req);
  const filter: Record<string, unknown> = { recipientId: req.user!.id };
  if (q.status === 'unread') filter.readAt = null;
  const total = await Notification.countDocuments(filter);
  const items = await Notification.find(filter).sort('-createdAt').skip((q.page - 1) * q.limit).limit(q.limit).lean();
  const unread = await Notification.countDocuments({ recipientId: req.user!.id, readAt: null });
  res.json({ success: true, data: items, pagination: buildMeta(q.page, q.limit, total), meta: { unread } });
});
export const markRead = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  if (!mongoose.isValidObjectId(id)) throw AppError.badRequest('Invalid id.');
  const doc = await Notification.findOneAndUpdate(
    { _id: id, recipientId: req.user!.id },
    { $set: { readAt: new Date() } },
    { new: true },
  ).lean();
  if (!doc) throw AppError.notFound('Notification not found.');
  res.json(ok(doc));
});
export const markAllRead = asyncHandler(async (req: Request, res: Response) => {
  await Notification.updateMany({ recipientId: req.user!.id, readAt: null }, { $set: { readAt: new Date() } });
  res.json(ok({ updated: true }));
});
