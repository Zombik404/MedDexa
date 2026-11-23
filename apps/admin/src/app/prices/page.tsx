'use client';
import { useState } from 'react';
import { Badge, Empty, ErrorBox, Loading, PageHeader, Pager, Tabs, VerificationBadge } from '@/components/ui';
import { api, fmtDate, money, useApi } from '@/lib/api';

interface PriceRow {
  id: string; offerId: string; amount: string; currency: string; priceType: string; observedAt: string; verification: string; stale: boolean;
  offer: { countryCode: string; isDemo: boolean; package: { quantity: string; unit: string; medicine: { id: string; name: string } }; pharmacy: { name: string; city: string | null } | null; source: { id: string; name: string } };
}
interface AvailRow { id: string; status: string; observedAt: string; offer: { package: { medicine: { name: string } }; pharmacy: { name: string; city: string | null } | null }; source: { name: string } }

function PriceEditor({ row, onSaved }: { row: PriceRow; onSaved: () => void }) {
  const [amount, setAmount] = useState(row.amount);
  const [open, setOpen] = useState(false);
  const [hist, setHist] = useState<{ capturedAt: string; amount: string; currency: string }[] | null>(null);
  if (!open) return <button className="btn secondary small" onClick={() => setOpen(true)}>Update</button>;
  return (
    <div className="grid" style={{ gap: 6 }}>
      <div className="row">
        <input className="input" style={{ width: 100 }} value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" aria-label="New amount" />
        <button className="btn small" onClick={async () => { await api(`/admin/prices/${row.id}`, { method: 'PATCH', body: { amount: Number(amount), currency: row.currency, verification: 'VERIFIED' } }); setOpen(false); onSaved(); }}>Save as verified</button>
        <button className="btn secondary small" onClick={async () => setHist(await api(`/admin/offers/${row.offerId}/history`))}>History</button>
      </div>
      {hist ? <div className="small muted">{hist.map((h) => `${fmtDate(h.capturedAt)}: ${money(h.amount, h.currency)}`).join(' · ') || 'No history'}</div> : null}
    </div>
  );
}

export default function PricesPage() {
  const [tab, setTab] = useState<'prices' | 'availability'>('prices');
  const [stale, setStale] = useState(typeof window !== 'undefined' && window.location.search.includes('stale=true'));
  const [q, setQ] = useState('');
  const [country, setCountry] = useState('');
  const [page, setPage] = useState(1);
  const prices = useApi<{ items: PriceRow[]; total: number; page: number; pageSize: number }>(tab === 'prices' ? '/admin/prices' : null, { q, country, stale: stale ? 'true' : undefined, page });
  const avail = useApi<{ items: AvailRow[]; total: number; page: number; pageSize: number }>(tab === 'availability' ? '/admin/availability' : null, { stale: stale ? 'true' : undefined, page });
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <>
      <PageHeader
        title="Prices & availability"
        subtitle="Every price keeps its source, observation date and verification. Old observations are labelled as possibly outdated in the apps."
        actions={<button className="btn secondary" onClick={async () => { const r = await api<{ updated: number }>('/admin/prices/mark-stale', { method: 'POST' }); setMsg(`${r.updated} verified prices older than the threshold were marked outdated.`); prices.reload(); }}>Mark stale as outdated</button>}
      />
      <Tabs value={tab} onChange={(t) => { setTab(t); setPage(1); }} options={[{ value: 'prices', label: 'Prices' }, { value: 'availability', label: 'Availability records' }]} />
      {msg ? <p className="notice" style={{ marginBottom: 12 }}>{msg}</p> : null}
      <div className="card">
        <div className="row" style={{ marginBottom: 12 }}>
          {tab === 'prices' ? <input className="input" placeholder="Medicine name" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} style={{ flex: 1 }} /> : null}
          {tab === 'prices' ? <input className="input" placeholder="Country" maxLength={2} style={{ width: 90 }} value={country} onChange={(e) => setCountry(e.target.value.toUpperCase())} /> : null}
          <label className="row small"><input type="checkbox" checked={stale} onChange={(e) => { setStale(e.target.checked); setPage(1); }} /> Only stale</label>
        </div>
        {tab === 'prices' ? (
          prices.loading ? <Loading /> : prices.error ? <ErrorBox error={prices.error} /> : !prices.data?.items.length ? <Empty>No price records.</Empty> : (
            <>
              <table className="table">
                <thead><tr><th>Medicine / pack</th><th>Where</th><th>Price</th><th>Observed</th><th>Source</th><th /></tr></thead>
                <tbody>
                  {prices.data.items.map((p) => (
                    <tr key={p.id}>
                      <td><strong>{p.offer.package.medicine.name}</strong><div className="small muted">{Number(p.offer.package.quantity)} {p.offer.package.unit}</div></td>
                      <td className="small">{p.offer.pharmacy ? `${p.offer.pharmacy.name}, ${p.offer.pharmacy.city ?? ''}` : 'National price list'} · {p.offer.countryCode}</td>
                      <td><strong>{money(p.amount, p.currency)}</strong><div className="small muted">{p.priceType.toLowerCase().replace(/_/g, ' ')}</div></td>
                      <td>{fmtDate(p.observedAt)} {p.stale ? <Badge tone="warning">stale</Badge> : null}</td>
                      <td className="small">{p.offer.source.name} <VerificationBadge value={p.verification} demo={p.offer.isDemo} /></td>
                      <td><PriceEditor row={p} onSaved={prices.reload} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pager page={prices.data.page} pageSize={prices.data.pageSize} total={prices.data.total} onPage={setPage} />
            </>
          )
        ) : avail.loading ? <Loading /> : avail.error ? <ErrorBox error={avail.error} /> : !avail.data?.items.length ? <Empty>No availability records.</Empty> : (
          <>
            <table className="table">
              <thead><tr><th>Medicine</th><th>Pharmacy</th><th>Status</th><th>Observed</th><th>Source</th></tr></thead>
              <tbody>
                {avail.data.items.map((a) => (
                  <tr key={a.id}>
                    <td>{a.offer.package.medicine.name}</td>
                    <td className="small">{a.offer.pharmacy?.name ?? '—'} {a.offer.pharmacy?.city ?? ''}</td>
                    <td><Badge tone={a.status === 'IN_STOCK' ? 'success' : a.status === 'OUT_OF_STOCK' ? 'danger' : 'warning'}>{a.status.toLowerCase().replace(/_/g, ' ')}</Badge></td>
                    <td>{fmtDate(a.observedAt, true)}</td>
                    <td className="small muted">{a.source.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pager page={avail.data.page} pageSize={avail.data.pageSize} total={avail.data.total} onPage={setPage} />
          </>
        )}
      </div>
    </>
  );
}
