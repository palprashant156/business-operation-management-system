const base = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';

let memoryToken: string | null = null;
export function setAccessToken(t: string | null): void {
  memoryToken = t;
}
export function getAccessToken(): string | null {
  return memoryToken;
}

async function raw(path: string, init: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (memoryToken) headers.Authorization = `Bearer ${memoryToken}`;
  return fetch(`${base}${path}`, {
    ...init,
    headers: { ...headers, ...(init.headers as Record<string, string> | undefined) },
    credentials: 'include',
  });
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res = await raw(path, init);
  // Single refresh attempt on 401 (cookie-based refresh).
  if (res.status === 401 && !path.startsWith('/auth/')) {
    const r = await raw('/auth/refresh', { method: 'POST' });
    if (r.ok) {
      const body = (await r.json()) as { data: { accessToken: string } };
      setAccessToken(body.data.accessToken);
      res = await raw(path, init);
    }
  }
  const body = (await res.json().catch(() => ({}))) as { success: boolean; data: T; error?: { message: string } };
  if (!res.ok || body.success === false) {
    throw new Error(body.error?.message ?? `Request failed (${res.status})`);
  }
  return body.data as T;
}

export const get = <T>(path: string): Promise<T> => api<T>(path);
export const post = <T>(path: string, data: unknown): Promise<T> =>
  api<T>(path, { method: 'POST', body: JSON.stringify(data) });
export const patch = <T>(path: string, data: unknown): Promise<T> =>
  api<T>(path, { method: 'PATCH', body: JSON.stringify(data) });

export interface Envelope<T> {
  success: boolean;
  data: T;
  pagination?: { page: number; limit: number; total: number; totalPages: number };
  meta?: Record<string, unknown>;
}

/** Full envelope (pagination/meta) for cases like the notifications unread count. */
export async function getEnvelope<T>(path: string): Promise<Envelope<T>> {
  let res = await raw(path);
  if (res.status === 401 && !path.startsWith('/auth/')) {
    const r = await raw('/auth/refresh', { method: 'POST' });
    if (r.ok) {
      const body = (await r.json()) as { data: { accessToken: string } };
      setAccessToken(body.data.accessToken);
      res = await raw(path);
    }
  }
  const body = (await res.json().catch(() => ({}))) as Envelope<T> & { error?: { message: string } };
  if (!res.ok || (body as { success?: boolean }).success === false) {
    throw new Error((body as { error?: { message: string } }).error?.message ?? `Request failed (${res.status})`);
  }
  return body;
}
