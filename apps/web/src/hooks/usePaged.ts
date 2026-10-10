import { useCallback, useEffect, useState } from 'react';
import { get } from '../services/api';

interface PagedResponse<T> {
  success: boolean;
  data: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export function usePaged<T>(path: string, deps: string): { rows: T[]; page: number; setPage: (p: number) => void; totalPages: number; total: number; loading: boolean; error: string | null; reload: () => void } {
  const [rows, setRows] = useState<T[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    get<PagedResponse<T> | T[]>(`${path}${path.includes('?') ? '&' : '?'}page=${page}`).then(
      (body) => {
        if (!alive) return;
        if (Array.isArray(body)) {
          setRows(body as T[]);
          setTotal((body as T[]).length);
          setTotalPages(1);
        } else {
          const b = body as PagedResponse<T>;
          setRows(b.data);
          setTotal(b.pagination.total);
          setTotalPages(b.pagination.totalPages);
        }
        setLoading(false);
      },
    ).catch((e: unknown) => {
      if (!alive) return;
      setError(e instanceof Error ? e.message : 'Failed to load.');
      setLoading(false);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, page, deps, nonce]);

  return { rows, page, setPage, totalPages, total, loading, error, reload };
}
