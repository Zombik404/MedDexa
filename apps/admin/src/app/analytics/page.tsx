'use client';
import { useState } from 'react';
import { Empty, ErrorBox, Loading, PageHeader } from '@/components/ui';
import { useApi } from '@/lib/api';

interface A {
  days: number;
  perDay: { day: string; type: string; count: number }[];
  topQueries: { query: string; count: number }[];
  zeroResultQueries: { query: string; count: number }[];
  topMedicines: { id: string; name: string; views: number }[];
  topPharmacyLocations: { city: string; country: string; views: number }[];
  comparisons: number;
  syncHealth: { sourceId: string; status: string; count: number }[];
}

function Bars({ rows }: { rows: { label: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <Empty>No data yet.</Empty>;
  return (
    <div className="grid" style={{ gap: 8 }}>
      {rows.map((r) => (
        <div key={r.label}>
          <div className="row small" style={{ justifyContent: 'space-between' }}><span>{r.label}</span><strong>{r.value}</strong></div>
          <div className="bar"><div style={{ width: `${(r.value / max) * 100}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  const [days, setDays] = useState(30);
  const q = useApi<A>('/admin/analytics', { days });
  const totals = (type: string) => (q.data?.perDay ?? []).filter((d) => d.type === type).reduce((s, d) => s + d.count, 0);
  return (
    <>
      <PageHeader
        title="Analytics"
        subtitle="Anonymous product analytics — no user ids, IP addresses or device identifiers are collected."
        actions={<select value={days} onChange={(e) => setDays(Number(e.target.value))}>{[7, 30, 90, 365].map((d) => <option key={d} value={d}>Last {d} days</option>)}</select>}
      />
      {q.loading ? <Loading /> : q.error || !q.data ? <ErrorBox error={q.error ?? 'No data'} /> : (
        <>
          <div className="grid grid-4" style={{ marginBottom: 14 }}>
            {[['Searches', totals('SEARCH')], ['Medicine views', totals('VIEW_MEDICINE')], ['Pharmacy searches', totals('PHARMACY_SEARCH')], ['Comparisons', q.data.comparisons]].map(([l, v]) => (
              <div className="card stat" key={l as string}><div className="label">{l}</div><div className="value">{v}</div></div>
            ))}
          </div>
          <div className="grid grid-2">
            <div className="card"><h2>Top searches</h2><Bars rows={q.data.topQueries.map((x) => ({ label: x.query, value: x.count }))} /></div>
            <div className="card"><h2>Searches without results</h2><p className="small muted" style={{ marginBottom: 8 }}>Data coverage gaps worth closing.</p><Bars rows={q.data.zeroResultQueries.map((x) => ({ label: x.query, value: x.count }))} /></div>
            <div className="card"><h2>Popular medicines</h2><Bars rows={q.data.topMedicines.map((x) => ({ label: x.name, value: x.views }))} /></div>
            <div className="card"><h2>Popular pharmacy locations</h2><Bars rows={q.data.topPharmacyLocations.map((x) => ({ label: `${x.city}, ${x.country}`, value: x.views }))} /></div>
            <div className="card"><h2>Integration health</h2><Bars rows={q.data.syncHealth.map((x) => ({ label: `${x.sourceId} · ${x.status.toLowerCase()}`, value: x.count }))} /></div>
          </div>
        </>
      )}
    </>
  );
}
