export type Role = 'ADMIN' | 'MANAGER' | 'EMPLOYEE';

export interface SafeUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: string;
}

export interface Paged<T> {
  success: boolean;
  data: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface ApiError {
  success: false;
  error: { code: string; message: string; details: unknown };
}
