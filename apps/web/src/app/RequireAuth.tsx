import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import type { Role } from '../types';

export function RequireAuth({ children, roles }: { children: ReactNode; roles?: Role[] }): JSX.Element {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading">Loading workspace…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) {
    return (
      <div className="denied">
        <h3>Access denied</h3>
        <p>Your role ({user.role}) cannot view this section. Backend APIs enforce the same rule.</p>
      </div>
    );
  }
  return <>{children}</>;
}
