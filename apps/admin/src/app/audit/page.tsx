'use client';
import { Fragment, useState } from 'react';
import { Empty, ErrorBox, Loading, PageHeader } from '@/components/ui';
import { fmtDate, useApi } from '@/lib/api';

interface Log { id: string; action: string; entityType: string; entityId: string | null; before: unknown; after: unknown; ip: string | null; createdAt: string; actor: { email: string } | null }

export default function AuditPage() {
  const [entityType, setEntityType] = useState('');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const logs = useApi<Log[]>('/admin/audit-logs', { entityType, q, pageSize: 100 });
  return (
    <>
      <PageHeader title="Audit log" subtitle="Every administrative change with actor, before/after values and time." />
      <div className="card">
        <div className="row" style={{ marginBottom: 12 }}>
          <select value={entityType} onChange={(e) => setEntityType(e.target.value)} aria-label="Entity">
            <option value="">All entities</option>
            {['Medicine', 'MedicinePackage', 'ProductRegistration', 'ActiveIngredient', 'Pharmacy', 'Price', 'Review', 'ReviewReport', 'User', 'DataSource'].map((e) => <option key={e}>{e}</option>)}
          </select>
          <input className="input" placeholder="Action contains…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {logs.loading ? <Loading /> : logs.error ? <ErrorBox error={logs.error} /> : !logs.data?.length ? <Empty>No entries.</Empty> : (
          <table className="table">
            <thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Entity</th><th /></tr></thead>
            <tbody>
              {logs.data.map((l) => (
                <Fragment key={l.id}>
                  <tr>
                    <td className="small">{fmtDate(l.createdAt, true)}</td>
                    <td className="small">{l.actor?.email ?? 'system'}</td>
                    <td className="mono">{l.action}</td>
                    <td className="small">{l.entityType} <span className="muted mono">{l.entityId?.slice(0, 10)}</span></td>
                    <td><button className="btn secondary small" onClick={() => setOpen(open === l.id ? null : l.id)}>{open === l.id ? 'Hide' : 'Details'}</button></td>
                  </tr>
                  {open === l.id ? (
                    <tr><td colSpan={5}><pre className="mono" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{JSON.stringify({ before: l.before, after: l.after, ip: l.ip }, null, 2)}</pre></td></tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
