import { useEffect, useState } from 'react';
import { get } from '../services/api';
import { useAuth } from '../features/auth/AuthContext';
import { PageHead } from '../components/ui';

export function Dashboard(): JSX.Element {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<{ byStatus: Record<string, number>; overdue: number; total: number } | null>(null);
  const [projects, setProjects] = useState<{ name: string; progress: number }[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    get<{ byStatus: Record<string, number>; overdue: number; total: number }>('/reports/tasks')
      .then(setTasks)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed'));
    get<{ name: string; progress: number }[]>('/reports/projects')
      .then(setProjects)
      .catch(() => undefined);
  }, []);

  return (
    <div>
      <PageHead title={`Welcome, ${user?.name ?? ''}`} sub={`${user?.role} workspace · scoped to your permissions`} />
      {error ? <div className="form-error">{error}</div> : null}
      <div className="grid cols-3">
        <div className="card">
          <div className="kpi-label">Open tasks</div>
          <div className="kpi">{tasks ? tasks.total - (tasks.byStatus.DONE ?? 0) : '—'}</div>
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>Overdue: {tasks?.overdue ?? '—'}</div>
        </div>
        <div className="card">
          <div className="kpi-label">Done tasks</div>
          <div className="kpi">{tasks?.byStatus.DONE ?? '—'}</div>
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>Total tracked: {tasks?.total ?? '—'}</div>
        </div>
        <div className="card">
          <div className="kpi-label">Projects in scope</div>
          <div className="kpi">{projects.length}</div>
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>
            {projects.slice(0, 2).map((p) => `${p.name} (${p.progress}%)`).join(' · ') || 'No projects yet'}
          </div>
        </div>
      </div>
      <div className="card" style={{ marginTop: 14 }}>
        <h3 style={{ marginTop: 0 }}>How to demo</h3>
        <ol style={{ color: 'var(--muted)', fontSize: 14 }}>
          <li>Admin: manage Users → Employees → Products → Projects → Tasks → Orders.</li>
          <li>Manager: create a project, add members, assign tasks, move TODO → IN_PROGRESS → REVIEW → DONE.</li>
          <li>Employee: open My Tasks, update status, watch notifications arrive.</li>
        </ol>
      </div>
    </div>
  );
}
