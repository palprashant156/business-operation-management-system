import type { ReactNode } from 'react';

export function PageHead({ title, sub, actions, eyebrow }: { title: ReactNode; sub?: string; actions?: ReactNode; eyebrow?: string }): JSX.Element {
  return (
    <div className="page-head">
      <div>
        {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
        <h1>{title}</h1>
        {sub ? <p>{sub}</p> : null}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{actions}</div>
    </div>
  );
}

export function Badge({ value }: { value: string }): JSX.Element {
  return <span className={`badge ${value}`}>{value.replace(/_/g, ' ')}</span>;
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

export function initials(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function Avatar({ name, size }: { name: string; size?: 'lg' }): JSX.Element {
  return <span className={`avatar${size === 'lg' ? ' lg' : ''}`} aria-hidden>{initials(name)}</span>;
}

export function KpiCard({
  label,
  value,
  sub,
  icon,
  alert,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  alert?: boolean;
}): JSX.Element {
  return (
    <div className={`card kpi-card${alert ? ' alert' : ''}`}>
      <div>
        <div className="kpi-label">{label}</div>
        <div className="kpi">{value}</div>
        {sub ? <div className="kpi-sub">{sub}</div> : null}
      </div>
      {icon ? <div className="kpi-ico">{icon}</div> : null}
    </div>
  );
}

export function Drawer({
  title,
  sub,
  onClose,
  children,
  footer,
}: {
  title: ReactNode;
  sub?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}): JSX.Element {
  return (
    <>
      <div className="scrim" onClick={onClose} aria-hidden />
      <div className="drawer" role="dialog" aria-modal="true">
        <div className="drawer-head">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 19 }}>{title}</div>
              {sub ? <div className="muted" style={{ fontSize: 12.5, marginTop: 3 }}>{sub}</div> : null}
            </div>
            <button className="icon-btn" onClick={onClose} aria-label="Close panel">✕</button>
          </div>
        </div>
        <div className="drawer-body">{children}</div>
        {footer ? <div className="drawer-foot">{footer}</div> : null}
      </div>
    </>
  );
}
