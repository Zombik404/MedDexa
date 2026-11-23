'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Badge, Empty, ErrorBox, Loading, PageHeader, Pager, Tabs, VerificationBadge } from '@/components/ui';
import { api, fmtDate, useApi } from '@/lib/api';

interface Row {
  id: string;
  name: string;
  brand: string | null;
  countryCode: string | null;
  status: string;
  verification: string;
  isDemo: boolean;
  updatedAt: string;
  manufacturer: { name: string } | null;
  form: { name: string } | null;
  _count: { ingredients: number; packages: number; registrations: number };
}
interface Dup { aId: string; aName: string; bId: string; bName: string; nameSimilarity: number; sameBrand: boolean }

export default function MedicinesPage() {
  const [tab, setTab] = useState<'all' | 'duplicates'>('all');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const list = useApi<{ items: Row[]; total: number; page: number; pageSize: number }>(tab === 'all' ? '/admin/medicines' : null, { q, page, status });
  const dups = useApi<Dup[]>(tab === 'duplicates' ? '/admin/medicines/duplicates' : null);
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <>
      <PageHeader
        title="Medicines"
        subtitle="Central product identities with exact ingredient quantities, packages and country registrations."
        actions={
          <Link className="btn" href="/medicines/new">
            New medicine
          </Link>
        }
      />
      <Tabs value={tab} onChange={setTab} options={[{ value: 'all', label: 'All medicines' }, { value: 'duplicates', label: 'Duplicate candidates' }]} />
      {msg ? <p className="notice" style={{ marginBottom: 12 }}>{msg}</p> : null}
      {tab === 'all' ? (
        <div className="card">
          <div className="row" style={{ marginBottom: 12 }}>
            <input className="input" placeholder="Search name, ingredient, registration…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} style={{ flex: 1 }} />
            <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
              <option value="">Any status</option>
              <option value="ACTIVE">Active</option>
              <option value="DRAFT">Draft</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>
          {list.loading ? <Loading /> : list.error ? <ErrorBox error={list.error} onRetry={list.reload} /> : !list.data?.items.length ? <Empty>No medicines match.</Empty> : (
            <>
              <table className="table">
                <thead>
                  <tr><th>Name</th><th>Manufacturer</th><th>Form</th><th>Country</th><th>Data</th><th>Status</th><th>Updated</th></tr>
                </thead>
                <tbody>
                  {list.data.items.map((m) => (
                    <tr key={m.id}>
                      <td><Link href={`/medicines/${m.id}`} style={{ fontWeight: 700 }}>{m.name}</Link></td>
                      <td className="muted">{m.manufacturer?.name ?? '—'}</td>
                      <td>{m.form?.name ?? <Badge tone="warning">missing</Badge>}</td>
                      <td>{m.countryCode ?? '—'}</td>
                      <td className="small muted">{m._count.ingredients} ingr · {m._count.packages} packs · {m._count.registrations} reg</td>
                      <td><Badge tone={m.status === 'ACTIVE' ? 'success' : undefined}>{m.status.toLowerCase()}</Badge> <VerificationBadge value={m.verification} demo={m.isDemo} /></td>
                      <td className="muted small">{fmtDate(m.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pager page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onPage={setPage} />
            </>
          )}
        </div>
      ) : (
        <div className="card">
          <p className="muted small" style={{ marginBottom: 12 }}>
            Pairs with an identical ingredient signature, form and route plus a similar name or the same brand. Similar names never prove identical medicines — confirm before merging. Merging archives the duplicate and moves its registrations to the kept record.
          </p>
          {dups.loading ? <Loading /> : dups.error ? <ErrorBox error={dups.error} /> : !dups.data?.length ? <Empty>No duplicate candidates.</Empty> : (
            <table className="table">
              <thead><tr><th>Record A</th><th>Record B</th><th>Name similarity</th><th /></tr></thead>
              <tbody>
                {dups.data.map((d) => (
                  <tr key={`${d.aId}-${d.bId}`}>
                    <td><Link href={`/medicines/${d.aId}`}>{d.aName}</Link></td>
                    <td><Link href={`/medicines/${d.bId}`}>{d.bName}</Link></td>
                    <td>{Math.round(d.nameSimilarity * 100)}% {d.sameBrand ? <Badge tone="info">same brand</Badge> : null}</td>
                    <td className="row">
                      <button className="btn secondary small" onClick={async () => { await api(`/admin/medicines/${d.bId}/merge`, { method: 'POST', body: { intoId: d.aId } }); setMsg(`Merged "${d.bName}" into "${d.aName}".`); dups.reload(); }}>Keep A</button>
                      <button className="btn secondary small" onClick={async () => { await api(`/admin/medicines/${d.aId}/merge`, { method: 'POST', body: { intoId: d.bId } }); setMsg(`Merged "${d.aName}" into "${d.bName}".`); dups.reload(); }}>Keep B</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </>
  );
}
