import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { get, post } from '../services/api';
import { PageHead, Badge, Loading } from '../components/ui';

interface Detail {
  _id: string;
  name: string;
  description?: string;
  status: string;
  progress: number;
  taskCounts: Record<string, number>;
  memberIds: { _id: string; name: string; email: string }[];
}

export function ProjectDetail(): JSX.Element {
  const { id } = useParams();
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [memberEmail, setMemberEmail] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    get<Detail>(`/projects/${id}`).then(setData).catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed'));
  }, [id]);

  if (error) return <div className="form-error">{error}</div>;
  if (!data) return <Loading />;

  return (
    <div>
      <PageHead title={data.name} sub={`${data.status} · progress ${data.progress}% (DONE/total)`} actions={<Badge value={data.status} />} />
      {msg ? <div className="card" style={{ marginBottom: 12 }}>{msg}</div> : null}
      <div className="grid cols-2">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Overview</h3>
          <p style={{ color: 'var(--muted)' }}>{data.description || 'No description.'}</p>
          <p style={{ fontSize: 13 }}>Tasks: {Object.entries(data.taskCounts ?? {}).map(([k, v]) => `${k}:${v}`).join(' · ')}</p>
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Members ({data.memberIds.length})</h3>
          <ul style={{ fontSize: 14 }}>
            {data.memberIds.map((m) => <li key={m._id}>{m.name} — {m.email}</li>)}
          </ul>
          <div className="toolbar">
            <input className="input" placeholder="Member user id to add…" value={memberEmail} onChange={(e) => setMemberEmail(e.target.value)} />
            <button
              className="btn"
              onClick={() => {
                if (!memberEmail.trim()) return;
                post(`/projects/${id}/members`, { memberIds: [memberEmail.trim()] })
                  .then(() => {
                    setMsg('Member added; they got a notification.');
                    return get<Detail>(`/projects/${id}`).then(setData);
                  })
                  .catch((e: unknown) => setMsg(e instanceof Error ? e.message : 'Failed.'));
              }}
            >
              Add member
            </button>
          </div>
          <p style={{ fontSize: 12, color: 'var(--muted)' }}>Tip: copy a user id from Users page. Only owner/admin can add.</p>
        </div>
      </div>
    </div>
  );
}
