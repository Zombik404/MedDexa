'use client';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { PharmacyForm, type PharmacyFormValue } from '@/components/PharmacyForm';
import { ErrorBox, Loading, PageHeader, VerificationBadge } from '@/components/ui';
import { api, fmtDate, useApi } from '@/lib/api';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
interface Detail extends PharmacyFormValue { id: string; isDemo: boolean; sourceId: string | null; sourceReference: string | null; syncedAt: string | null; openingHours: { day: number; opens: string; closes: string }[]; services: { serviceCode: string }[] }

export default function PharmacyDetail() {
  const { id } = useParams<{ id: string }>();
  const q = useApi<Detail>(`/admin/pharmacies/${id}`);
  const meta = useApi<{ services: { code: string; name: string }[] }>('/meta');
  const [hours, setHours] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  if (q.loading && !q.data) return <Loading />;
  if (q.error || !q.data) return <ErrorBox error={q.error ?? 'Not found'} />;
  const p = q.data;
  const hoursText = hours ?? p.openingHours.sort((a, b) => a.day - b.day).map((h) => `${DAYS[h.day]} ${h.opens}-${h.closes}`).join('\n');
  const parseHours = (text: string) =>
    text.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
      const m = l.match(/^(\w{3})\s+(\d{2}:\d{2})-(\d{2}:\d{2})$/);
      if (!m || DAYS.indexOf(m[1]!) < 0) throw new Error(`Cannot parse line "${l}" (expected e.g. "Mon 08:00-19:00")`);
      return { day: DAYS.indexOf(m[1]!), opens: m[2]!, closes: m[3]! };
    });
  const serviceSet = new Set(p.services.map((s) => s.serviceCode));
  return (
    <>
      <PageHeader title={p.name} subtitle={`Source: ${p.sourceId ?? 'manual'}${p.sourceReference ? ` · ${p.sourceReference}` : ''} · synced ${fmtDate(p.syncedAt)}`} actions={<VerificationBadge value={p.verification} demo={p.isDemo} />} />
      {msg ? <p className="notice" style={{ marginBottom: 12 }}>{msg}</p> : null}
      <div className="grid" style={{ gap: 18 }}>
        <PharmacyForm key={p.id} submitLabel="Save pharmacy" initial={p} onSubmit={async (v) => {
          const { name, street, city, postcode, countryCode, lat, lng, phone, phoneVerified, website, websiteVerified, email, status, verification } = v;
          await api(`/admin/pharmacies/${p.id}`, { method: 'PATCH', body: { name, street, city, postcode, countryCode, lat, lng, phone, phoneVerified, website, websiteVerified, email, status, verification } });
          setMsg('Saved.');
          q.reload();
        }} />
        <div className="grid grid-2">
          <div className="card">
            <h2>Opening hours</h2>
            <p className="muted small" style={{ marginBottom: 8 }}>One span per line, local time: <code>Mon 08:00-19:00</code>. Use 24:00 for midnight. Leave a day out if closed.</p>
            <textarea rows={9} style={{ width: '100%' }} value={hoursText} onChange={(e) => setHours(e.target.value)} className="mono" />
            <button className="btn small" style={{ marginTop: 8 }} onClick={async () => {
              try { await api(`/admin/pharmacies/${p.id}/hours`, { method: 'PUT', body: { hours: parseHours(hoursText) } }); setHours(null); setMsg('Opening hours saved.'); q.reload(); } catch (e) { setMsg((e as Error).message); }
            }}>Save hours</button>
          </div>
          <div className="card">
            <h2>Services</h2>
            <div className="grid" style={{ gap: 6 }}>
              {(meta.data?.services ?? []).map((s) => (
                <label key={s.code} className="row small">
                  <input type="checkbox" checked={serviceSet.has(s.code)} onChange={async (e) => {
                    const next = new Set(serviceSet);
                    if (e.target.checked) next.add(s.code); else next.delete(s.code);
                    await api(`/admin/pharmacies/${p.id}/services`, { method: 'PUT', body: { services: [...next] } });
                    q.reload();
                  }} /> {s.name}
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
