'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Badge, Empty, ErrorBox, Loading, PageHeader, Pager, VerificationBadge } from '@/components/ui';
import { fmtDate, useApi } from '@/lib/api';

interface Row { id: string; name: string; street: string; city: string | null; postcode: string | null; countryCode: string; verification: string; isDemo: boolean; phoneVerified: boolean; websiteVerified: boolean; updatedAt: string; source: { name: string } | null }

export default function PharmaciesPage() {
  const [q, setQ] = useState('');
  const [country, setCountry] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const list = useApi<{ items: Row[]; total: number; page: number; pageSize: number }>('/admin/pharmacies', { q, country, status, page });
  return (
    <>
      <PageHeader title="Pharmacies" subtitle="Locations, contact details, opening hours, services and verification status." actions={<Link className="btn" href="/pharmacies/new">New pharmacy</Link>} />
      <div className="card">
        <div className="row" style={{ marginBottom: 12 }}>
          <input className="input" placeholder="Name, city or postcode" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} style={{ flex: 1 }} />
          <input className="input" placeholder="Country" maxLength={2} style={{ width: 90 }} value={country} onChange={(e) => setCountry(e.target.value.toUpperCase())} />
          <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Verification">
            <option value="">Any verification</option>
            <option value="VERIFIED">Verified</option>
            <option value="UNVERIFIED">Unverified</option>
            <option value="OUTDATED">Outdated</option>
          </select>
        </div>
        {list.loading ? <Loading /> : list.error ? <ErrorBox error={list.error} onRetry={list.reload} /> : !list.data?.items.length ? <Empty>No pharmacies.</Empty> : (
          <>
            <table className="table">
              <thead><tr><th>Name</th><th>Address</th><th>Contact</th><th>Source</th><th>Verification</th><th>Updated</th></tr></thead>
              <tbody>
                {list.data.items.map((p) => (
                  <tr key={p.id}>
                    <td><Link href={`/pharmacies/${p.id}`} style={{ fontWeight: 700 }}>{p.name}</Link></td>
                    <td className="small">{p.street}, {p.postcode} {p.city} · {p.countryCode}</td>
                    <td>{p.phoneVerified ? <Badge tone="success">phone</Badge> : null} {p.websiteVerified ? <Badge tone="success">web</Badge> : null}</td>
                    <td className="small muted">{p.source?.name ?? 'manual'}</td>
                    <td><VerificationBadge value={p.verification} demo={p.isDemo} /></td>
                    <td className="small muted">{fmtDate(p.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pager page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onPage={setPage} />
          </>
        )}
      </div>
    </>
  );
}
