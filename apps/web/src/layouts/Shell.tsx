import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import { getEnvelope } from '../services/api';
import type { Role } from '../types';
import { Avatar } from '../components/ui';

interface NavItem {
  to: string;
  label: string;
  icon: string;
  roles: Role[];
  tag?: string;
}

const OPERATIONS: NavItem[] = [
  { to: '/', label: 'Overview', icon: '▦', roles: ['ADMIN', 'MANAGER', 'EMPLOYEE'] },
  { to: '/employees', label: 'Employees', icon: '⛉', roles: ['ADMIN', 'MANAGER'] },
  { to: '/projects', label: 'Projects', icon: '🗀', roles: ['ADMIN', 'MANAGER', 'EMPLOYEE'] },
  { to: '/tasks', label: 'Tasks', icon: '✓', roles: ['ADMIN', 'MANAGER', 'EMPLOYEE'], tag: 'Kanban' },
  { to: '/customers', label: 'Customers', icon: '⛁', roles: ['ADMIN', 'MANAGER', 'EMPLOYEE'] },
  { to: '/products', label: 'Products', icon: '▤', roles: ['ADMIN', 'MANAGER', 'EMPLOYEE'] },
  { to: '/orders', label: 'Orders', icon: '🛒', roles: ['ADMIN', 'MANAGER'] },
];

const INSIGHTS: NavItem[] = [
  { to: '/reports', label: 'Reports & Analytics', icon: '📈', roles: ['ADMIN', 'MANAGER', 'EMPLOYEE'] },
  { to: '/notifications', label: 'Notifications', icon: '🔔', roles: ['ADMIN', 'MANAGER', 'EMPLOYEE'] },
  { to: '/users', label: 'Settings & Access', icon: '⚙', roles: ['ADMIN'] },
];

const PAGE_NAMES: Record<string, string> = {
  '/': 'Overview',
  '/employees': 'Employees',
  '/projects': 'Projects',
  '/tasks': 'Tasks',
  '/customers': 'Customers',
  '/products': 'Products',
  '/orders': 'Orders',
  '/reports': 'Reports & Analytics',
  '/notifications': 'Notifications',
  '/users': 'Settings & Access',
};

function roleLabel(role: Role): string {
  return role === 'EMPLOYEE' ? 'STAFF' : role;
}

export function Shell({ children }: { children: ReactNode }): JSX.Element {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [dbHealthy, setDbHealthy] = useState<boolean | null>(null);
  const [search, setSearch] = useState('');

  // Live notification badge + DB health pill. Failures degrade silently to 0/unknown.
  useEffect(() => {
    let alive = true;
    if (!user) return;
    void getEnvelope<unknown[]>('/notifications?status=unread&limit=1')
      .then((env) => {
        if (alive) setUnread(env.pagination?.total ?? 0);
      })
      .catch(() => undefined);
    void getEnvelope<{ status: string }>('/health')
      .then(() => {
        if (alive) setDbHealthy(true);
      })
      .catch(() => {
        if (alive) setDbHealthy(false);
      });
    return () => {
      alive = false;
    };
  }, [user, location.pathname]);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  if (!user) return <>{children}</>;
  const items = (list: NavItem[]): NavItem[] => list.filter((n) => n.roles.includes(user.role));
  const pageName = PAGE_NAMES[location.pathname] ?? (location.pathname.startsWith('/projects/') ? 'Projects' : 'Overview');

  const newLinks = [
    { to: '/projects', label: 'Create Project', roles: ['ADMIN', 'MANAGER'] as Role[] },
    { to: '/tasks', label: 'New Task', roles: ['ADMIN', 'MANAGER'] as Role[] },
    { to: '/customers', label: 'Add Customer', roles: ['ADMIN', 'MANAGER'] as Role[] },
    { to: '/orders', label: 'New Order', roles: ['ADMIN', 'MANAGER'] as Role[] },
    { to: '/products', label: 'Add Product', roles: ['ADMIN'] as Role[] },
  ].filter((l) => l.roles.includes(user.role));

  return (
    <div className="shell">
      <aside className={`sidebar${menuOpen ? ' open' : ''}`} aria-label="Primary">
        <div className="brand">
          <span className="brand-mark">⬡</span>
          <span>
            <span className="brand-name">NexaOps</span>
            <br />
            <span className="brand-sub">Operations OS</span>
          </span>
        </div>

        <div className="org-card">▦ Acme Global Corp <span className="pro-pill">PRO</span></div>
        <div className="role-pills" aria-label="Your role">
          {(['ADMIN', 'MANAGER', 'EMPLOYEE'] as Role[]).map((r) => (
            <span key={r} className={user.role === r ? 'on' : ''}>{roleLabel(r)}</span>
          ))}
        </div>

        <div className="nav-section">Operations</div>
        {items(OPERATIONS).map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => (isActive ? 'navlink active' : 'navlink')}>
            <span className="ico">{n.icon}</span>
            {n.label}
            {n.tag ? <span className="nav-tag">{n.tag}</span> : null}
            {n.to === '/notifications' && unread > 0 ? <span className="nav-badge">{unread}</span> : null}
          </NavLink>
        ))}

        <div className="nav-section">Insights &amp; System</div>
        {items(INSIGHTS).map((n) => (
          <NavLink key={n.to} to={n.to} className={({ isActive }) => (isActive ? 'navlink active' : 'navlink')}>
            <span className="ico">{n.icon}</span>
            {n.label}
            {n.to === '/notifications' && unread > 0 ? <span className="nav-badge">{unread}</span> : null}
          </NavLink>
        ))}

        <div className="user-card">
          <Avatar name={user.name} />
          <span className="who">
            <b>{user.name}</b>
            <span>{user.role === 'ADMIN' ? 'System Admin' : user.role === 'MANAGER' ? 'Manager' : 'Staff'}</span>
          </span>
          <span style={{ marginLeft: 'auto', display: 'flex' }}>
            <button
              className="icon-btn"
              title="Log out"
              aria-label="Log out"
              onClick={() => {
                void logout().then(() => navigate('/login'));
              }}
            >
              ⏻
            </button>
          </span>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button className="icon-btn menu-btn" aria-label="Open menu" onClick={() => setMenuOpen((o) => !o)}>☰</button>
          <span className="crumbs">
            Acme Global <span aria-hidden> › </span> <b>{pageName}</b>
          </span>
          <span className={`health-pill${dbHealthy === false ? ' down' : ''}`} title="Backend /api/health">
            <span className="dot" /> {dbHealthy === false ? 'API: Unreachable' : 'MongoDB Cluster: Healthy'}
          </span>
          <span className="topbar-spacer" />
          <form
            className="search"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              if (search.trim()) navigate(`/tasks?search=${encodeURIComponent(search.trim())}`);
            }}
          >
            <span aria-hidden>⌕</span>
            <input
              placeholder="Search operations, assets…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search tasks"
            />
          </form>
          {newLinks.length > 0 ? (
            <details style={{ position: 'relative' }}>
              <summary className="btn primary" style={{ listStyle: 'none', cursor: 'pointer' }}>+ New ▾</summary>
              <div className="card" style={{ position: 'absolute', right: 0, top: '110%', zIndex: 10, minWidth: 190, padding: 6 }}>
                {newLinks.map((l) => (
                  <NavLink key={l.label} to={l.to} className="navlink" style={{ color: 'var(--ink)' }}>{l.label}</NavLink>
                ))}
              </div>
            </details>
          ) : null}
          <button className="icon-btn bell" aria-label="Notifications" onClick={() => navigate('/notifications')}>
            🔔{unread > 0 ? <span className="ping" /> : null}
          </button>
          <Avatar name={user.name} />
        </header>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
