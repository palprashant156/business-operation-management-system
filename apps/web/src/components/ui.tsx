import type { ReactNode } from 'react';

export function PageHead({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }): JSX.Element {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {sub ? <p>{sub}</p> : null}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>{actions}</div>
    </div>
  );
}

export function Badge({ value }: { value: string }): JSX.Element {
  return <span className={`badge ${value}`}>{value.replace('_', ' ')}</span>;
}

export function Empty({ text }: { text: string }): JSX.Element {
  return <div className="empty">{text}</div>;
}

export function Loading({ text = 'Loading…' }: { text?: string }): JSX.Element {
  return <div className="loading">{text}</div>;
}

export function Pager({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (p: number) => void }): JSX.Element {
  return (
    <div className="pager">
      <button className="btn small" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Prev
      </button>
      <span>
        Page {page} of {totalPages}
      </span>
      <button className="btn small" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
        Next
      </button>
    </div>
  );
}
