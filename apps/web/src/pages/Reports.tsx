import { useEffect, useState } from 'react';
import { get } from '../services/api';
import { PageHead } from '../components/ui';

export function Reports(): JSX.Element {
  const [tasks, setTasks] = useState<unknown>(null);
  const [projects, setProjects] = useState<unknown>(null);
  const [workload, setWorkload] = useState<unknown>(null);
  const [orders, setOrders] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setTasks(await get('/reports/tasks'));
        setProjects(await get('/reports/projects'));
        setWorkload(await get('/reports/workload'));
        try {
          setOrders(await get('/reports/orders'));
        } catch {
          setOrders({ note: 'No permission (employees blocked by design).' });
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load reports.');
      }
    })();
  }, []);

  return (
    <div>
      <PageHead title="Reports" sub="All queries scoped to your role before aggregation. No fake analytics." />
      {error ? <div className="form-error">{error}</div> : null}
      <div className="grid cols-2">
        <div className="card"><h3>Task summary</h3><pre style={{ fontSize: 12, overflow: 'auto' }}>{JSON.stringify(tasks, null, 2)}</pre></div>
        <div className="card"><h3>Project progress (DONE/total)</h3><pre style={{ fontSize: 12, overflow: 'auto' }}>{JSON.stringify(projects, null, 2)}</pre></div>
        <div className="card"><h3>Workload (open tasks)</h3><pre style={{ fontSize: 12, overflow: 'auto' }}>{JSON.stringify(workload, null, 2)}</pre></div>
        <div className="card"><h3>Orders (admin revenue; manager counts)</h3><pre style={{ fontSize: 12, overflow: 'auto' }}>{JSON.stringify(orders, null, 2)}</pre></div>
      </div>
    </div>
  );
}
