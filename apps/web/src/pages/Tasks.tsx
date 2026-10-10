import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { post, patch } from '../services/api';
import { usePaged } from '../hooks/usePaged';
import { useAuth } from '../features/auth/AuthContext';
import { PageHead, Badge, Empty, Loading, Pager } from '../components/ui';

interface Row { _id: string; title: string; status: string; priority: string; dueDate?: string; assigneeId?: { name: string } | string | null; projectId: { name: string } | string; }

const schema = z.object({
  title: z.string().min(2),
  projectId: z.string().min(1, 'Project id required.'),
  assigneeId: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
});
type Form = z.infer<typeof schema>;

const NEXT: Record<string, string[]> = {
  TODO: ['IN_PROGRESS'],
  IN_PROGRESS: ['REVIEW', 'TODO'],
  REVIEW: ['DONE', 'IN_PROGRESS'],
  DONE: ['REVIEW'],
};

export function Tasks(): JSX.Element {
  const { user } = useAuth();
  const canCreate = user?.role !== 'EMPLOYEE';
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? '';
  const projectId = params.get('projectId') ?? '';
  const path = `/tasks?${status ? `status=${status}&` : ''}${projectId ? `projectId=${projectId}&` : ''}limit=15`;
  const { rows, page, setPage, totalPages, loading, error, reload } = usePaged<Row>(path, `${status}|${projectId}`);
  const [msg, setMsg] = useState<string | null>(null);
  const { register, handleSubmit, reset, formState } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { projectId } });

  async function move(id: string, to: string): Promise<void> {
    try { await patch(`/tasks/${id}/status`, { status: to }); setMsg(`Moved to ${to}.`); reload(); }
    catch (e) { setMsg(e instanceof Error ? e.message : 'Transition rejected.'); }
  }

  return (
    <div>
      <PageHead title={user?.role === 'EMPLOYEE' ? 'My Tasks' : 'Tasks'} sub="Lifecycle: TODO → IN_PROGRESS → REVIEW → DONE. Assignee must be a project member." />
      {msg ? <div className="card" style={{ marginBottom: 12 }}>{msg}</div> : null}
      <div className="toolbar">
        <select className="select" value={status} onChange={(e) => { const v = e.target.value; setParams(v ? { status: v } : {}); }} aria-label="Filter by status">
          <option value="">All statuses</option>
          <option value="TODO">TODO</option>
          <option value="IN_PROGRESS">IN_PROGRESS</option>
          <option value="REVIEW">REVIEW</option>
          <option value="DONE">DONE</option>
        </select>
      </div>
      <div className="grid cols-2">
        <div>
          {loading ? <Loading /> : error ? <div className="form-error">{error}</div> : rows.length === 0 ? <Empty text="No tasks in scope." /> : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Title</th><th>Project</th><th>Status</th><th>Priority</th><th>Next</th></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r._id}>
                      <td>{r.title}</td>
                      <td>{typeof r.projectId === 'object' ? r.projectId.name : ''}</td>
                      <td><Badge value={r.status} /></td>
                      <td><Badge value={r.priority} /></td>
                      <td>
                        {(NEXT[r.status] ?? []).map((n) => (
                          <button key={n} className="btn small" style={{ marginRight: 6 }} onClick={() => void move(r._id, n)}>{n}</button>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pager page={page} totalPages={totalPages} onPage={setPage} />
        </div>
        {canCreate ? (
          <div className="card">
            <h3 style={{ marginTop: 0 }}>New task</h3>
            <form onSubmit={handleSubmit(async (v) => {
              try {
                await post('/tasks', { title: v.title, projectId: v.projectId, assigneeId: v.assigneeId || null, priority: v.priority });
                setMsg('Task created; assignee notified.'); reset(); reload();
              } catch (e) { setMsg(e instanceof Error ? e.message : 'Failed.'); }
            })}>
              <div className="field"><label>Title</label><input className="input" {...register('title')} />{formState.errors.title ? <span className="err">{formState.errors.title.message}</span> : null}</div>
              <div className="field"><label>Project id</label><input className="input" {...register('projectId')} />{formState.errors.projectId ? <span className="err">{formState.errors.projectId.message}</span> : null}</div>
              <div className="field"><label>Assignee user id (must be member)</label><input className="input" {...register('assigneeId')} /></div>
              <div className="field"><label>Priority</label>
                <select className="select" {...register('priority')}><option value="MEDIUM">MEDIUM</option><option value="LOW">LOW</option><option value="HIGH">HIGH</option><option value="URGENT">URGENT</option></select>
              </div>
              <button className="btn primary" disabled={formState.isSubmitting}>Create</button>
            </form>
          </div>
        ) : null}
      </div>
    </div>
  );
}
