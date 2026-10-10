import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import type { Role } from '../types';

const NAV: { to: string; label: string; roles: Role[] }[] = [
  { to: '/', label: 'Dashboard', roles: ['ADMIN', 'MANAGER', 'EMPLOYEE'] },
  { to: '/tasks', label: 'Tasks', roles: ['ADMIN', 'MANAGER', 'EMPLOYEE'] },
  { to: '/projects', label: 'Projects', roles: ['ADMIN', 'MANAGER', 'EMPLOYEE'] },
  { to: '/employees', label: 'Employees', roles: ['ADMIN', 'MANAGER'] },
  { to: '/users', label: 'Users', roles: ['ADMIN'] },
  { to: '/customers', label: 'Customers', roles: ['ADMIN', 'MANAGER', 'EMPLOYEE'] },
  { to: '/products', label: 'Products', roles: ['ADMIN', 'MANAGER', 'EMPLOYEE'] },
  { to: '/orders', label: 'Orders', roles: ['ADMIN', 'MANAGER'] },
  { to: '/reports', label: 'Reports', roles: ['ADMIN', 'MANAGER', 'EMPLOYEE'] },
  { to: '/notifications', label: 'Notifications', roles: ['ADMIN', 'MANAGER', 'EMPLOYEE'] },
];

export function Shell({ children }: { children: ReactNode }): JSX.Element {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const items = NAV.filter((n) => user && n.roles.includes(user.role));

  return (
    <div className="shell">
      <aside className="sidebar" aria-label="Primary">
        <div className="brand">
          Nexa<span>Ops</span>
        </div>
        <div className="nav-section">{user?.role ?? ''} workspace</div>
        {items.map((n) => (
          <NavLink key={n.to} to={n.to} className={({ isActive }) => (isActive ? 'navlink active' : 'navlink')}>
            {n.label}
          </NavLink>
        ))}
        <div style={{ flex: 1 }} />
        <div className="nav-section">{user?.email}</div>
        <button
          className="btn small"
          onClick={() => {
            void logout().then(() => navigate('/login'));
          }}
        >
          Log out
        </button>
      </aside>
      <div className="main">
        <header className="topbar">
          <strong>NexaOps — Business Operations</strong>
          <span style={{ color: 'var(--muted)', fontSize: 13 }}>{user?.name} · {user?.role}</span>
        </header>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
