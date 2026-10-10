import { z } from 'zod';

const email = z.string().trim().toLowerCase().min(3).max(160).email('Invalid email.');
const password = z.string().min(8, 'Password must be at least 8 characters.').max(128);

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name is required.').max(80),
  email,
  password: password.refine(
    (v) => /[A-Za-z]/.test(v) && /[0-9]/.test(v),
    'Password needs at least one letter and one number.',
  ),
  // role intentionally absent: public registration cannot elevate.
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required.').max(128),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
