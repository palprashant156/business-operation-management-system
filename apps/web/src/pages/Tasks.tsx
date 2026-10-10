import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { get, getEnvelope, patch, post } from '../services/api';
import { usePaged } from '../hooks/usePaged';
import { useAuth } from '../features/auth/AuthContext';
import { Avatar, Badge, Drawer, Empty, KpiCard, Loading, Pager, PageHead } from '../components/ui';

interface Comment {
  authorId: string;
  body: string;
  createdAt: string;
}
interface Row {
  _id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  dueDate?: string;
  comments?: Comment[];
  assigneeId?: { _id?: string; name: string; email: string } | string | null;
  projectId: { _id?: string; name: string; status: string } | string;
}

const createSchema = z.object({
  title: z.string().min(2, 'Title needs at least 2 characters.'),
  projectId: z.string().min(1, 'Project id required.'),
  assigneeId: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
});
type CreateForm = z.infer<typeof createSchema>;

const NEXT: Record<string, string[]> = {
  TODO: ['IN_PROGRESS'],
  IN_PROGRESS: ['REVIEW', 'TODO'],
  REVIEW: ['DONE', 'IN_PROGRESS'],
  DONE: ['REVIEW'],
};

function assigneeName(a: Row['assigneeId']): string {
  return typeof a === 'object' && a !== null ? a.name : 'Unassigned';
}
function assigneeIdOf(a: Row['assigneeId']): string {
  if (typeof a === 'object' && a !== null) return a._id ?? '';
  return typeof a === 'string' ? a : '';
}
function projectName(p: Row['projectId']): string {
  return typeof p === 'object' ? p.name : '—';
}

export function Tasks(): JSX.Element {
  const { user } = useAuth();
  const canCreate = user?.role !== 'EMPLOYEE';
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? '';
  const priority = params.get('priority') ?? '';
  const projectId = params.get('projectId') ?? '';
  const search = params.get('search') ?? '';
  const [stats, setStats] = useState<{ total: number; overdue: number; review: number } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const path = `/tasks?${status ? `status=${status}&` : ''}${projectId ? `projectId=${projectId}&` : ''}${search ? `search=${encodeURIComponent(search)}&` : ''}limit=15`;
  const { rows, page, setPage, totalPages, total, loading, error, reload } = usePaged<Row>(path, `${status}|${projectId}|${search}|${priority}`);

  // Stat strip from a bounded sample; priority filter applies client-side to loaded rows.
  useEffect(() => {
    let alive = true;
    void getEnvelope<Row[]>('/tasks?limit=100')
      .then((env) => {
        if (!alive) return;
        const all = env.data;
        setStats({
          total: env.pagination?.total ?? all.length,
          overdue: all.filter((t) => t.dueDate && new Date(t.dueDate).getTime() < Date.now() && t.status !== 'DONE').length,
          review: all.filter((t) => t.status === 'REVIEW').length,
        });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const visible = priority ? rows.filter((r) => r.priority === priority) : rows;
  const [msg, setMsg] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, reset, formState } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { projectId },
  });

  function setParam(key: string, value: string): void {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  }

  return (
    <div>
      <PageHead
        eyebrow="Sprint 42 · Q4 Core Deliverables"
        title={<>Tasks <span className="badge TODO">{total} items</span></>}
        sub="Track assignments, deadlines, and cross-functional ownership across teams."
      />
      {msg ? <div className="form-ok">{msg}</div> : null}
      {formError ? <div className="form-error">{formError}</div> : null}

      <div className="grid cols-3">
        <KpiCard label="Active sprint" value={`${visible.length} / ${stats?.total ?? total}`} sub="tasks in view" icon="✓" />
        <KpiCard label="Attention needed" value={`${stats?.overdue ?? '—'} Overdue`} sub="past due date" icon="🔔" alert />
        <KpiCard label="In review" value={stats?.review ?? '—'} sub="pending sign-off" icon="◷" />
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <select className="select" value={status} onChange={(e) => setParam('status', e.target.value)} aria-label="Status filter">
            <option value="">Status: All</option>
            <option value="TODO">To Do</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="REVIEW">In Review</option>
            <option value="DONE">Done</option>
          </select>
          <select className="select" value={priority} onChange={(e) => setParam('priority', e.target.value)} aria-label="Priority filter">
            <option value="">Priority: All</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>
          <input
            className="input"
            placeholder="Filter tasks by key, title…"
            value={search}
            onChange={(e) => setParam('search', e.target.value)}
            aria-label="Search tasks"
          />
        </div>
      </div>

      <div className="grid cols-2" style={{ marginTop: 14 }}>
        <div>
          <div className="card" style={{ marginBottom: 10 }}>
            <b>Execution Backlog</b> <span className="badge TODO">Sorted by Due Date ASC</span>
          </div>
          {loading ? <Loading /> : error ? <div className="form-error">{error}</div> : visible.length === 0 ? <Empty text="No tasks match these filters." /> : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Key &amp; title</th><th>Project</th><th>Assignee</th><th>Status</th></tr></thead>
                <tbody>
                  {visible.map((r) => (
                    <tr key={r._id} onClick={() => setSelectedId(r._id)} style={{ cursor: 'pointer' }}>
                      <td>
                        <span className="mono" style={{ color: 'var(--primary)', fontWeight: 700 }}>{r._id.slice(-6).toUpperCase()}</span>
                        <br />{r.title}
                      </td>
                      <td><span className="badge TODO">● {projectName(r.projectId)}</span></td>
                      <td>
                        <span style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
                          <Avatar name={assigneeName(r.assigneeId)} />
                          {assigneeName(r.assigneeId)}
                        </span>
                      </td>
                      <td><Badge value={r.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>Showing {visible.length} of {total} tasks</div>
          <Pager page={page} totalPages={totalPages} onPage={setPage} />
        </div>

        {canCreate ? (
          <div className="card" style={{ alignSelf: 'start' }}>
            <h3 style={{ marginTop: 0 }}>New task</h3>
            <form onSubmit={handleSubmit(async (v) => {
              setFormError(null);
              try {
                await post('/tasks', { title: v.title, projectId: v.projectId, assigneeId: v.assigneeId || null, priority: v.priority ?? 'MEDIUM' });
                setMsg('Task created; assignee notified.');
                reset();
                reload();
              } catch (e) {
                setFormError(e instanceof Error ? e.message : 'Create failed.');
              }
            })}>
              <div className="field"><label>Title</label><input className="input" {...register('title')} />{formState.errors.title ? <span className="err">{formState.errors.title.message}</span> : null}</div>
              <div className="field"><label>Project id</label><input className="input" {...register('projectId')} />{formState.errors.projectId ? <span className="err">{formState.errors.projectId.message}</span> : null}</div>
              <div className="field"><label>Assignee user id (must be a project member)</label><input className="input" {...register('assigneeId')} /></div>
              <div className="field"><label>Priority</label>
                <select className="select" {...register('priority')}>
                  <option value="MEDIUM">Medium</option><option value="LOW">Low</option>
                  <option value="HIGH">High</option><option value="URGENT">Urgent</option>
                </select>
              </div>
              <button className="btn primary" disabled={formState.isSubmitting}>Create</button>
            </form>
          </div>
        ) : (
          <div className="card" style={{ alignSelf: 'start' }}>
            <h3 style={{ marginTop: 0 }}>How status works</h3>
            <p className="muted" style={{ fontSize: 13 }}>
              Move tasks along <b>TODO → In Progress → Review → Done</b> from your dashboard or the detail panel.
              Only transitions allowed by policy are offered, and every change notifies the assignee.
            </p>
          </div>
        )}
      </div>

      {selectedId ? (
        <TaskDrawer
          id={selectedId}
          canAssign={canCreate}
          onClose={() => setSelectedId(null)}
          onChanged={() => reload()}
        />
      ) : null}
    </div>
  );
}

function TaskDrawer({ id, canAssign, onClose, onChanged }: { id: string; canAssign: boolean; onClose: () => void; onChanged: () => void }): JSX.Element {
  const [task, setTask] = useState<Row | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('TODO');
  const [priority, setPriority] = useState('MEDIUM');
  const [dueDate, setDueDate] = useState('');
  const [assignee, setAssignee] = useState('');
  const [comment, setComment] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    get<Row>(`/tasks/${id}`)
      .then((t) => {
        if (!alive) return;
        setTask(t);
        setTitle(t.title);
        setDescription(t.description ?? '');
        setStatus(t.status);
        setPriority(t.priority);
        setDueDate(t.dueDate ? t.dueDate.slice(0, 10) : '');
        setAssignee(assigneeIdOf(t.assigneeId));
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof Error ? e.message : 'Failed to load task.');
      });
    return () => {
      alive = false;
    };
  }, [id]);

  async function save(): Promise<void> {
    if (!task) return;
    setSaving(true);
    setMsg(null);
    try {
      // Status travels through the lifecycle endpoint so illegal jumps are rejected.
      if (status !== task.status) {
        await patch(`/tasks/${id}/status`, { status });
      }
      await patch(`/tasks/${id}`, {
        title,
        description: description || undefined,
        priority,
        dueDate: dueDate || null,
      });
      // Reassignment is a separate privileged operation (owner/admin only).
      if (canAssign && assignee !== assigneeIdOf(task.assigneeId)) {
        await patch(`/tasks/${id}/assignee`, { assigneeId: assignee.trim() || null });
      }
      const fresh = await get<Row>(`/tasks/${id}`);
      setTask(fresh);
      setMsg({ ok: true, text: 'Saved. Assignee notified of status changes.' });
      onChanged();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Save rejected by policy.' });
    } finally {
      setSaving(false);
    }
  }

  async function sendComment(): Promise<void> {
    if (!comment.trim()) return;
    try {
      const updated = await post<Row>(`/tasks/${id}/comments`, { body: comment.trim() });
      setTask(updated);
      setComment('');
      onChanged();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Comment failed.' });
    }
  }

  return (
    <Drawer
      title={task ? task.title : <Loading text="Loading task…" />}
      sub={task ? <><span className="mono" style={{ color: 'var(--primary)', fontWeight: 700 }}>NX-{id.slice(-6).toUpperCase()}</span> · {projectName(task.projectId)} / Task detail</> : undefined}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Close</button>
          <button className="btn primary" disabled={saving || !task} onClick={() => void save()}>Save Changes</button>
        </>
      }
    >
      {error ? <div className="form-error">{error}</div> : null}
      {msg ? <div className={msg.ok ? 'form-ok' : 'form-error'}>{msg.text}</div> : null}
      {!task ? <Loading /> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="field">
              <label>Status</label>
              <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
                {[task.status, ...(NEXT[task.status] ?? [])].map((s) => (
                  <option key={s} value={s}>{s.replace('_', ' ')}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Priority</label>
              <select className="select" value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="LOW">Low</option><option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option><option value="URGENT">Urgent (P0)</option>
              </select>
            </div>
            <div className="field">
              <label>Assignee {canAssign ? '(user id, must be member)' : '(read-only)'}</label>
              <input className="input" value={assignee} disabled={!canAssign} onChange={(e) => setAssignee(e.target.value)} placeholder="24-hex user id" />
              <span className="muted" style={{ fontSize: 12 }}>Current: {assigneeName(task.assigneeId)}</span>
            </div>
            <div className="field">
              <label>Due Date</label>
              <input className="input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>

          <div className="field">
            <label>Task title</label>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="field">
            <label>Description</label>
            <textarea className="textarea" rows={5} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <h4 style={{ margin: '14px 0 8px' }}>Activity &amp; Comments ({task.comments?.length ?? 0})</h4>
          {(task.comments ?? []).map((c, i) => (
            <div className="comment-box" key={i}>
              <div className="meta"><b>{c.authorId.slice(-6)}</b><span>{new Date(c.createdAt).toLocaleString()}</span></div>
              <div style={{ fontSize: 13.5 }}>{c.body}</div>
            </div>
          ))}
          <div className="field">
            <textarea
              className="textarea"
              placeholder="Write a comment or type @ to mention…"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>
          <button className="btn small" disabled={!comment.trim()} onClick={() => void sendComment()}>Comment</button>
        </>
      )}
    </Drawer>
  );
}
