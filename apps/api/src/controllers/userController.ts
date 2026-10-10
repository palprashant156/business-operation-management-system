import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { buildMeta, ok, type PaginationQuery } from '../utils/pagination.js';
import * as users from '../services/userService.js';
import * as employees from '../services/employeeService.js';

type Validated = { validatedQuery: PaginationQuery & Record<string, string | undefined> };

export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  const q = (req as unknown as Validated).validatedQuery;
  const { users: rows, total } = await users.listUsers(q);
  res.json(ok(rows, buildMeta(q.page, q.limit, total)));
});

export const getUser = asyncHandler(async (req: Request, res: Response) => {
  res.json(ok(await users.getUserById(req.params.id as string)));
});

export const patchUser = asyncHandler(async (req: Request, res: Response) => {
  res.json(ok(await users.updateUser(req.params.id as string, req.body)));
});

export const patchRole = asyncHandler(async (req: Request, res: Response) => {
  res.json(ok(await users.changeUserRole(req.params.id as string, req.body.role, req.user!.id)));
});

export const listEmployees = asyncHandler(async (req: Request, res: Response) => {
  const q = (req as unknown as Validated).validatedQuery;
  const { employees: rows, total } = await employees.listEmployees(req.user!, q);
  res.json(ok(rows, buildMeta(q.page, q.limit, total)));
});

export const getEmployee = asyncHandler(async (req: Request, res: Response) => {
  res.json(ok(await employees.getEmployee(req.user!, req.params.id as string)));
});

export const createEmployee = asyncHandler(async (req: Request, res: Response) => {
  const doc = await employees.createEmployee(req.body);
  res.status(201).json(ok(doc));
});

export const patchEmployee = asyncHandler(async (req: Request, res: Response) => {
  res.json(ok(await employees.updateEmployee(req.user!, req.params.id as string, req.body)));
});
