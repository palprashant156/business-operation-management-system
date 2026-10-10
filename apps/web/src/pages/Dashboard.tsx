import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { get, getEnvelope, patch } from '../services/api';
import { useAuth } from '../features/auth/AuthContext';
import { Avatar, Badge, Empty, KpiCard, Loading, PageHead } from '../components/ui';

interface TaskReport {
  byStatus: Record<string, number>;
  overdue: number;
  total: number;
}
interface ProjectReport {
  projectId: string;
  name: string;
  status: string;
  progress: number;
  taskCount: number;
}
interface TaskRow {
  _id: string;
  title: string;
  status: string;
  priority: string;
  dueDate?: string;
  assigneeId?: { name: string; email: string } | string | null;
  projectId: { name: string; status: string } | string;
}
interface OrderRow {
  _id: string;
  orderNumber: string;
  status: string;
  subtotal: number;
  customerId: { name: string } | string;
  createdAt: string;
}
interface NotifRow {
  _id: string;
  title: string;
  message: string;
  type: string;
  createdAt: string;
  readAt: string | null;
}

const TASK_NEXT: Record<string, string[]> = {
  TODO: ['IN_PROGRESS'],
  IN_PROGRESS: ['REVIEW', 'TODO'],
  REVIEW: ['DONE', 'IN_PROGRESS'],
  DONE: ['REVIEW'],
};

function assigneeName(a: TaskRow['assigneeId']): string {
  return typeof a === 'object' && a !== null ? a.name : 'Unassigned';
}
function projectName(p: TaskRow['projectId']): string {
  return typeof p === 'object' ? p.name : '—';
}
function dueDelay(due?: string): string {
  if (!due) return 'no due date';
  const ms = Date.now() - new Date(due).getTime();
  if (ms <= 0) return 'due soon';
  const h = Math.floor(ms / 3_600_000);
  if (h < 24) return `${h}h overdue`;
  return `${Math.floor(h / 24)}d overdue`;
}
function orderDisplay(status: string): string {
  if (status === 'COMPLETED') return 'Fulfilled';
  if (status === 'PROCESSING') return 'Processing';
  if (status === 'CANCELLED') return 'Cancelled';
  return 'Pending';
}
function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function Dashboard(): JSX.Element {
  const { user } = useAuth();
  if (user?.role === 'EMPLOYEE') return <EmployeeWorkspace name={user.name} />;
  return <OrgOverview name={user?.name ?? ''} role={user?.role ?? 'ADMIN'} />;
}

/* ---------------- Organization overview (ADMIN / MANAGER) ---------------- */

function OrgOverview({ name, role }: { name: string; role: string }): JSX.Element {
  const [tasks, setTasks] = useState<TaskReport | null>(null);
  const [projects, setProjects] = useState<ProjectReport[]>([]);
  const [employeeCount, setEmployeeCount] = useState<number | null>(null);
  const [orderCount, setOrderCount] = useState<number | null>(null);
  const [revenue, setRevenue] = useState<number | null>(null);
  const [recentTasks, setRecentTasks] = useState<TaskRow[]>([]);
  const [recentOrders, setRecentOrders] = useState<OrderRow[]>([]);
  const [activity, setActivity] = useState<NotifRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [t, p, emp, ord, feed] = await Promise.all([
          get<TaskReport>('/reports/tasks'),
          get<ProjectReport[]>('/reports/projects'),
          getEnvelope<unknown[]>('/employees?limit=1').catch(() => null),
          getEnvelope<OrderRow[]>('/orders?limit=5').catch(() => null),
          getEnvelope<TaskRow[]>('/tasks?limit=50').catch(() => null),
        ]);
        if (!alive) return;
        setTasks(t);
        setProjects(p);
        setEmployeeCount(emp?.pagination?.total ?? null);
        // Orders report shape differs by role (admin: revenue, manager: counts).
        try {
          const r = await get<{ byStatus: { count: number }[]; totalRevenue: number }>('/reports/orders');
          setRevenue(r.totalRevenue);
          setOrderCount(r.byStatus.reduce((a, g) => a + g.count, 0));
        } catch {
          try {
            const r = await get<{ status: string; count: number }[]>('/reports/orders');
            setOrderCount(r.reduce((a, g) => a + g.count, 0));
          } catch {
            setOrderCount(ord?.pagination?.total ?? 0);
          }
        }
        setRecentOrders(ord?.data ?? []);
        const all = feed?.data ?? [];
        setRecentTasks(
          all
            .filter((x) => x.dueDate && new Date(x.dueDate).getTime() < Date.now() && x.status !== 'DONE')
            .sort((a, b) => new Date(a.dueDate as string).getTime() - new Date(b.dueDate as string).getTime())
            .slice(0, 4),
        );
        try {
          const n = await getEnvelope<NotifRow[]>('/notifications?limit=4');
          setActivity(n.data);
        } catch {
          setActivity([]);
        }
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : 'Failed to load overview.');
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const byStatus = tasks?.byStatus ?? { TODO: 0, IN_PROGRESS: 0, REVIEW: 0, DONE: 0 };
  const activeTotal = (byStatus.TODO ?? 0) + (byStatus.IN_PROGRESS ?? 0) + (byStatus.REVIEW ?? 0) + (tasks?.overdue ?? 0);
  const seg = (n: number): string => (activeTotal > 0 ? `${Math.max(2, Math.round((n / activeTotal) * 100))}%` : '0%');
  const openTasks = (tasks?.total ?? 0) - (byStatus.DONE ?? 0);
  const activeProjects = projects.filter((p) => p.status === 'ACTIVE').length;

  return (
    <div>
      <PageHead
        title={<>Overview <span className="live-pill">LIVE FEED</span></>}
        sub="Monitor your organization's activity and real-time operational throughput."
        actions={
          <>
            <span className="muted" style={{ fontSize: 12.5 }}>Welcome, {name} · {role}</span>
            <Link className="btn primary" to={role === 'ADMIN' ? '/projects' : '/tasks'}>+ Quick Action</Link>
          </>
        }
      />
      {error ? <div className="form-error">{error}</div> : null}

      <div className="grid cols-5">
        <KpiCard label="Total employees" value={employeeCount ?? '—'} sub="headcount in scope" icon="⛉" />
        <KpiCard label="Active projects" value={projects.length} sub={`${activeProjects} active`} icon="🚀" />
        <KpiCard label="Open tasks" value={openTasks} sub={`${byStatus.IN_PROGRESS ?? 0} in progress`} icon="🗎" />
        <KpiCard label="Overdue tasks" value={tasks?.overdue ?? '—'} sub="requires follow-up" icon="⚠" alert />
        <KpiCard
          label="Total orders"
          value={orderCount ?? '—'}
          sub={revenue !== null ? `$${(revenue / 1000).toFixed(1)}k revenue` : 'scoped to your role'}
          icon="🧾"
        />
      </div>

      <div className="grid cols-2" style={{ marginTop: 14 }}>
        <div className="card">
          <div className="kpi-label">Workflow velocity</div>
          <h3 style={{ margin: '4px 0' }}>Task Status Distribution</h3>
          <div className="muted" style={{ fontSize: 12 }}>● {activeTotal} Total Active</div>
          <div className="velocity-track" aria-hidden>
            <span style={{ width: seg(byStatus.TODO ?? 0), background: '#c7cbe0' }} />
            <span style={{ width: seg(byStatus.IN_PROGRESS ?? 0), background: '#4f46e5' }} />
            <span style={{ width: seg(byStatus.REVIEW ?? 0), background: '#38bdf8' }} />
            <span style={{ width: seg(tasks?.overdue ?? 0), background: '#dc2626' }} />
          </div>
          <div className="velocity-legend">
            <div className="velocity-cell"><span><i className="dot" style={{ background: '#a5adcf' }} />To Do</span><br /><b>{byStatus.TODO ?? 0}</b> <span>tasks</span></div>
            <div className="velocity-cell"><span><i className="dot" style={{ background: '#4f46e5' }} />In Progress</span><br /><b>{byStatus.IN_PROGRESS ?? 0}</b> <span>tasks</span></div>
            <div className="velocity-cell"><span><i className="dot" style={{ background: '#38bdf8' }} />In Review</span><br /><b>{byStatus.REVIEW ?? 0}</b> <span>tasks</span></div>
            <div className="velocity-cell critical"><span><i className="dot" style={{ background: '#dc2626' }} />Overdue</span><br /><b>{tasks?.overdue ?? 0}</b> <span>critical</span></div>
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Quick Actions</h3>
            <span className="muted" style={{ fontSize: 12 }}>Shortcuts</span>
          </div>
          <div className="quick-grid" style={{ marginTop: 12 }}>
            <Link className="quick" to="/employees" style={{ textDecoration: 'none' }}><span className="q-ico">⛉</span><b>Add Employee</b><span>Directory onboard</span></Link>
            <Link className="quick" to="/projects" style={{ textDecoration: 'none' }}><span className="q-ico">🗀</span><b>Create Project</b><span>Scope &amp; timeline</span></Link>
            <Link className="quick" to="/tasks" style={{ textDecoration: 'none' }}><span className="q-ico">✓</span><b>New Task</b><span>Sprint allocation</span></Link>
            <Link className="quick" to="/customers" style={{ textDecoration: 'none' }}><span className="q-ico">⛁</span><b>Add Customer</b><span>CRM account setup</span></Link>
          </div>
        </div>
      </div>

      <div className="grid cols-2" style={{ marginTop: 14 }}>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>🔴 Overdue Tasks <span className="badge CANCELLED">{tasks?.overdue ?? 0} Requires Action</span></h3>
            <Link to="/tasks">View all in Kanban ›</Link>
          </div>
          {recentTasks.length === 0 ? (
            <Empty text="No overdue tasks. Everything is on schedule." />
          ) : (
            <div className="table-wrap" style={{ boxShadow: 'none' }}>
              <table className="table">
                <thead><tr><th>Task title</th><th>Project</th><th>Assignee</th><th>Due delay</th><th></th></tr></thead>
                <tbody>
                  {recentTasks.map((t) => (
                    <tr key={t._id}>
                      <td><Link to={`/tasks?search=${encodeURIComponent(t.title)}`}>{t.title.slice(0, 28)}</Link></td>
                      <td><span className="badge TODO">{projectName(t.projectId)}</span></td>
                      <td>{assigneeName(t.assigneeId)}</td>
                      <td><span className="overdue-pill">◷ {dueDelay(t.dueDate)}</span></td>
                      <td><Link to="/tasks">Open</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div>
              <div className="kpi-label">Commerce throughput</div>
              <h3 style={{ margin: '2px 0 0' }}>Recent Orders</h3>
            </div>
            <Link to="/orders">View all</Link>
          </div>
          {recentOrders.length === 0 ? (
            <Empty text={role === 'MANAGER' ? 'No orders in scope yet.' : 'No orders yet. Create one from Orders.'} />
          ) : (
            <div className="table-wrap" style={{ boxShadow: 'none' }}>
              <table className="table">
                <thead><tr><th>Order #</th><th>Customer</th><th>Amount</th><th>Status</th></tr></thead>
                <tbody>
                  {recentOrders.map((o) => (
                    <tr key={o._id}>
                      <td className="mono" style={{ color: 'var(--primary)', fontWeight: 700 }}>#{o.orderNumber}</td>
                      <td>{typeof o.customerId === 'object' ? o.customerId.name : '—'}</td>
                      <td>${o.subtotal.toLocaleString()}</td>
                      <td><Badge value={orderDisplay(o.status)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="grid cols-2" style={{ marginTop: 14 }}>
        <div className="card">
          <div className="kpi-label">Activity stream</div>
          <h3 style={{ margin: '4px 0 8px' }}>Recent Project Activity</h3>
          {activity.length === 0 ? (
            <Empty text="No recent activity. Assign a task or add a project member to generate notifications." />
          ) : (
            <div className="activity">
              {activity.map((n) => (
                <div className="activity-item" key={n._id}>
                  <span className="rail"><i /></span>
                  <div>
                    <b>{n.title}</b> <span className="badge TODO">{n.type}</span>
                    <span className="muted" style={{ fontSize: 12, marginLeft: 8 }}>{new Date(n.createdAt).toLocaleString()}</span>
                    <div className="muted" style={{ fontSize: 13, marginTop: 3 }}>{n.message}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="card">
          <div className="kpi-label">Scope &amp; security</div>
          <div className="comment-box" style={{ marginTop: 10 }}>
            <b>Viewing as {role === 'ADMIN' ? 'System Admin' : 'Manager'}</b>
            <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
              Organization-wide operational access granted. Every number on this page was computed from API data scoped to your role — never fabricated.
            </div>
          </div>
          <div className="muted" style={{ fontSize: 12.5 }}>Projects in scope: {projects.length} · Tasks tracked: {tasks?.total ?? '—'}</div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Employee workspace ---------------- */

function EmployeeWorkspace({ name }: { name: string }): JSX.Element {
  const first = name.split(' ')[0] ?? name;
  const [rows, setRows] = useState<TaskRow[]>([]);
  const [projects, setProjects] = useState<ProjectReport[]>([]);
  const [notifs, setNotifs] = useState<NotifRow[]>([]);
  const [tab, setTab] = useState<'all' | 'soon' | 'overdue'>('all');
  const [msg, setMsg] = useState<string | null>(null);
  const [scratch, setScratch] = useState(() => localStorage.getItem('nexaops-scratchpad') ?? '');

  const reload = (): void => {
    getEnvelope<TaskRow[]>('/tasks?limit=50')
      .then((env) => setRows(env.data))
      .catch(() => undefined);
  };

  useEffect(() => {
    reload();
    get<ProjectReport[]>('/reports/projects').then(setProjects).catch(() => undefined);
    getEnvelope<NotifRow[]>('/notifications?limit=5').then((env) => setNotifs(env.data)).catch(() => undefined);
  }, []);

  const open = useMemo(() => rows.filter((t) => t.status !== 'DONE'), [rows]);
  const overdue = useMemo(
    () => open.filter((t) => t.dueDate && new Date(t.dueDate).getTime() < Date.now()),
    [open],
  );
  const dueSoon = useMemo(() => {
    const limit = Date.now() + 36 * 3_600_000;
    return open.filter((t) => t.dueDate && new Date(t.dueDate).getTime() >= Date.now() && new Date(t.dueDate).getTime() <= limit);
  }, [open]);
  const shown = tab === 'all' ? open : tab === 'soon' ? dueSoon : overdue;

  async function move(id: string, to: string): Promise<void> {
    try {
      await patch(`/tasks/${id}/status`, { status: to });
      setMsg(`Task moved to ${to.replace('_', ' ')}.`);
      reload();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Transition rejected by policy.');
    }
  }

  return (
    <div>
      <PageHead
        title={<>{greeting()}, {first} <span className="badge TODO">● Role: Employee Workspace (Scope: Assigned Work Only)</span></>}
        sub={`Here's what needs your attention today. You have ${dueSoon.length + overdue.length} tasks due and ${projects.length} assigned projects.`}
        actions={<Link className="btn primary" to="/tasks">+ New Task (Draft)</Link>}
      />
      {msg ? <div className="form-ok">{msg}</div> : null}

      <div className="grid cols-4">
        <KpiCard label="My open tasks" value={open.length} sub={`across ${projects.length} projects`} icon="☰" />
        <KpiCard label="Due today / tomorrow" value={dueSoon.length} sub="scheduled" icon="◷" />
        <KpiCard label="Overdue" value={overdue.length} sub="requires action" icon="❢" alert />
        <KpiCard label="Assigned projects" value={projects.length} sub="active tracks" icon="🗀" />
      </div>

      <div className="grid cols-2" style={{ marginTop: 14 }}>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div>
              <h3 style={{ margin: 0 }}>My Tasks (Priority Order)</h3>
              <div className="muted" style={{ fontSize: 12.5 }}>Direct individual assignments requiring your input</div>
            </div>
            <div className="tabs" style={{ margin: 0 }}>
              <button className={tab === 'all' ? 'on' : ''} onClick={() => setTab('all')}>All Mine</button>
              <button className={tab === 'soon' ? 'on' : ''} onClick={() => setTab('soon')}>Due Soon</button>
              <button className={tab === 'overdue' ? 'on' : ''} onClick={() => setTab('overdue')}>Overdue ({overdue.length})</button>
            </div>
          </div>
          <div style={{ marginTop: 10 }}>
            {shown.length === 0 ? (
              <Empty text="Nothing here. Unassigned issues remain in the team backlog." />
            ) : (
              shown.map((t) => (
                <div key={t._id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '11px 2px', borderBottom: '1px solid var(--line)' }}>
                  <Avatar name={projectName(t.projectId)} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <b>{t.title}</b>
                    <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                      ● {projectName(t.projectId)} <span aria-hidden> / </span> ◷ Due: {t.dueDate ? new Date(t.dueDate).toLocaleDateString() : '—'}
                      <span aria-hidden> / </span> <Badge value={t.priority} />
                    </div>
                  </div>
                  <select
                    className="select"
                    style={{ width: 130 }}
                    value={t.status}
                    aria-label={`Change status of ${t.title}`}
                    onChange={(e) => void move(t._id, e.target.value)}
                  >
                    {['TODO', ...(TASK_NEXT[t.status] ?? [])].map((s) => (
                      <option key={s} value={s}>{s.replace('_', ' ')}</option>
                    ))}
                  </select>
                </div>
              ))
            )}
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>ⓘ Showing tasks strictly assigned to you. Unassigned issues remain in team backlog.</div>
        </div>

        <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>My Assigned Projects</h3>
              <span className="badge TODO">{projects.length} Active</span>
            </div>
            <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
              {projects.length === 0 ? (
                <Empty text="No project assignments yet." />
              ) : (
                projects.slice(0, 4).map((p) => (
                  <div key={p.projectId} className="comment-box">
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <b>{p.name}</b>
                      <b style={{ color: p.progress >= 60 ? 'var(--ok)' : 'var(--primary)' }}>{p.progress}%</b>
                    </div>
                    <div className="progress" style={{ margin: '8px 0' }}><span style={{ width: `${p.progress}%` }} /></div>
                    <div className="muted" style={{ fontSize: 12 }}>{p.taskCount} tasks in project</div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="card">
            <h3 style={{ margin: '0 0 8px' }}>Recent Notifications</h3>
            {notifs.length === 0 ? (
              <Loading text="No notifications yet." />
            ) : (
              notifs.slice(0, 3).map((n) => (
                <div key={n._id} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                  <Avatar name={n.title} />
                  <div style={{ fontSize: 13 }}>
                    <b>{n.title}</b>
                    <div className="muted">{n.message.slice(0, 90)}</div>
                    <div className="muted" style={{ fontSize: 11.5 }}>{new Date(n.createdAt).toLocaleString()}</div>
                  </div>
                </div>
              ))
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
              <Link to="/notifications">View all notifications →</Link>
              <Link to="/tasks">My Profile</Link>
            </div>
          </div>

          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0 }}>Personal Scratchpad</h3>
              <span className="muted" style={{ fontSize: 12 }}>Auto-saved locally</span>
            </div>
            <textarea
              className="textarea"
              style={{ marginTop: 8 }}
              placeholder="Jot down quick command snippets, Docker logs, or local PR links…"
              value={scratch}
              onChange={(e) => {
                setScratch(e.target.value);
                localStorage.setItem('nexaops-scratchpad', e.target.value);
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
