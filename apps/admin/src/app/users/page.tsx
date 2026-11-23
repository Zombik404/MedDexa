'use client';
import { useState } from 'react';
import { Badge, Empty, ErrorBox, Loading, PageHeader, Pager } from '@/components/ui';
import { api, fmtDate, useApi } from '@/lib/api';

interface U { id: string; email: string; displayName: string | null; role: string; status: string; createdAt: string; lastLoginAt: string | null; _count: { reviews: number; reports: number } }
interface Log { id: string; action: string; entityType: string; createdAt: string }

export default function UsersPage() {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const list = useApi<{ items: U[]; total: number; page: number; pageSize: number }>('/admin/users', { q, page });
  const [activity, setActivity] = useState<{ email: string; logs: Log[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const update = async (id: string, body: object) => {
    setErr(null);
    try { await api(`/admin/users/${id}`, { method: 'PATCH', body }); list.reload(); } catch (e) { setErr((e as Error).message); }
  };
  return (
    <>
      <PageHeader title="Users" subtitle="Roles and account status. Browsing history and favourites are personal data and are not shown here." />
      {err ? <p className="error" style={{ marginBottom: 10 }}>{err}</p> : null}
      <div className="card">
        <input className="input" placeholder="Search email or name" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} style={{ width: '100%', marginBottom: 12 }} />
        {list.loading ? <Loading /> : list.error ? <ErrorBox error={list.error} /> : !list.data?.items.length ? <Empty>No users.</Empty> : (
          <>
            <table className="table">
              <thead><tr><th>User</th><th>Role</th><th>Status</th><th>Joined / last login</th><th>Reviews</th><th /></tr></thead>
              <tbody>
                {list.data.items.map((u) => (
                  <tr key={u.id}>
                    <td><strong>{u.displayName ?? '—'}</strong><div className="small muted">{u.email}</div></td>
                    <td>
                      <select value={u.role} onChange={(e) => update(u.id, { role: e.target.value })} aria-label="Role">
                        {['USER', 'MODERATOR', 'EDITOR', 'ADMIN'].map((r) => <option key={r}>{r}</option>)}
                      </select>
                    </td>
                    <td><Badge tone={u.status === 'ACTIVE' ? 'success' : 'danger'}>{u.status.toLowerCase()}</Badge></td>
                    <td className="small">{fmtDate(u.createdAt)}<div className="muted">{fmtDate(u.lastLoginAt, true)}</div></td>
                    <td>{u._count.reviews}</td>
                    <td className="row">
                      {u.status === 'ACTIVE' ? <button className="btn danger small" onClick={() => update(u.id, { status: 'SUSPENDED' })}>Suspend</button> : <button className="btn secondary small" onClick={() => update(u.id, { status: 'ACTIVE' })}>Reactivate</button>}
                      <button className="btn secondary small" onClick={async () => setActivity({ email: u.email, logs: await api(`/admin/users/${u.id}/activity`) })}>Activity</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pager page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onPage={setPage} />
          </>
        )}
      </div>
      {activity ? (
        <div className="card" style={{ marginTop: 18 }}>
          <h2>Administrative activity — {activity.email}</h2>
          {activity.logs.length ? (
            <table className="table"><tbody>{activity.logs.map((l) => <tr key={l.id}><td className="mono">{l.action}</td><td>{l.entityType}</td><td className="muted">{fmtDate(l.createdAt, true)}</td></tr>)}</tbody></table>
          ) : <Empty>No administrative activity recorded.</Empty>}
        </div>
      ) : null}
    </>
  );
}
