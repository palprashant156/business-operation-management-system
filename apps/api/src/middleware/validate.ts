import type { RequestHandler } from 'express';
import type { ZodSchema } from 'zod';
import { AppError } from '../errors/AppError.js';

// Validate body/query/params with Zod and replace req property with parsed value.
// Rejects unknown Mongo operators by only accepting parsed output.
export function validateBody<T>(schema: ZodSchema<T>): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(AppError.badRequest('Please check the submitted fields.', result.error.flatten()));
      return;
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery<T>(schema: ZodSchema<T>): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      next(AppError.badRequest('Invalid query parameters.', result.error.flatten()));
      return;
    }
    (req as unknown as { validatedQuery: T }).validatedQuery = result.data;
    next();
  };
}
