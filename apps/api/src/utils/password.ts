import bcrypt from 'bcryptjs';

const ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function isStrongPassword(password: string): boolean {
  // Min 8 chars, at least one letter and one number. Keep rule simple + documented.
  return password.length >= 8 && /[A-Za-z]/.test(password) && /[0-9]/.test(password);
}
