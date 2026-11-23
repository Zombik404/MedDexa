'use client';
import { useState } from 'react';
import { ErrorBox, Field, Loading, PageHeader, Tabs } from '@/components/ui';
import { api, useApi } from '@/lib/api';

export default function ReferencePage() {
  const [tab, setTab] = useState<'manufacturers' | 'forms'>('manufacturers');
  const mfrs = useApi<{ id: string; name: string; countryCode: string | null; website: string | null; _count: { medicines: number } }[]>(tab === 'manufacturers' ? '/admin/manufacturers' : null, { pageSize: 100 });
  const forms = useApi<{ code: string; name: string; group: string | null; edqmCode: string | null; _count: { medicines: number } }[]>(tab === 'forms' ? '/admin/forms' : null);
  const [m, setM] = useState({ name: '', countryCode: '', website: '' });
  const [f, setF] = useState({ code: '', name: '', group: '', edqmCode: '' });
  const [err, setErr] = useState<string | null>(null);
  const run = async (fn: () => Promise<unknown>) => { setErr(null); try { await fn(); } catch (e) { setErr((e as Error).message); } };
  return (
    <>
      <PageHeader title="Manufacturers & forms" subtitle="Reference data shared by every medicine record." />
      <Tabs value={tab} onChange={setTab} options={[{ value: 'manufacturers', label: 'Manufacturers' }, { value: 'forms', label: 'Pharmaceutical forms' }]} />
      {err ? <p className="error">{err}</p> : null}
      {tab === 'manufacturers' ? (
        <div className="card">
          <div className="row" style={{ marginBottom: 12 }}>
            <input className="input" placeholder="Name" value={m.name} onChange={(e) => setM({ ...m, name: e.target.value })} />
            <input className="input" style={{ width: 90 }} placeholder="Country" maxLength={2} value={m.countryCode} onChange={(e) => setM({ ...m, countryCode: e.target.value.toUpperCase() })} />
            <input className="input" placeholder="https://…" value={m.website} onChange={(e) => setM({ ...m, website: e.target.value })} />
            <button className="btn small" onClick={() => run(async () => { await api('/admin/manufacturers', { method: 'POST', body: { name: m.name, countryCode: m.countryCode || null, website: m.website || null } }); setM({ name: '', countryCode: '', website: '' }); mfrs.reload(); })}>Add</button>
          </div>
          {mfrs.loading ? <Loading /> : mfrs.error ? <ErrorBox error={mfrs.error} /> : (
            <table className="table"><thead><tr><th>Name</th><th>Country</th><th>Website</th><th>Medicines</th></tr></thead>
              <tbody>{(mfrs.data ?? []).map((x) => <tr key={x.id}><td>{x.name}</td><td>{x.countryCode ?? '—'}</td><td className="small">{x.website ?? '—'}</td><td>{x._count.medicines}</td></tr>)}</tbody>
            </table>
          )}
        </div>
      ) : (
        <div className="card">
          <p className="muted small" style={{ marginBottom: 10 }}>Forms in the same group (e.g. ORAL_SOLID) are treated as minor variants by the comparison engine; different groups are a major difference.</p>
          <div className="form-grid" style={{ marginBottom: 12 }}>
            <Field label="Code"><input className="input" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} /></Field>
            <Field label="Name"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
            <Field label="Group"><input className="input" value={f.group} onChange={(e) => setF({ ...f, group: e.target.value.toUpperCase() })} /></Field>
            <Field label="EDQM code"><input className="input" value={f.edqmCode} onChange={(e) => setF({ ...f, edqmCode: e.target.value })} /></Field>
          </div>
          <button className="btn small" onClick={() => run(async () => { await api(`/admin/forms/${f.code}`, { method: 'PUT', body: { code: f.code, name: f.name, group: f.group || null, edqmCode: f.edqmCode || null } }); setF({ code: '', name: '', group: '', edqmCode: '' }); forms.reload(); })}>Save form</button>
          {forms.loading ? <Loading /> : (
            <table className="table" style={{ marginTop: 12 }}><thead><tr><th>Code</th><th>Name</th><th>Group</th><th>EDQM</th><th>Medicines</th></tr></thead>
              <tbody>{(forms.data ?? []).map((x) => <tr key={x.code} onClick={() => setF({ code: x.code, name: x.name, group: x.group ?? '', edqmCode: x.edqmCode ?? '' })} style={{ cursor: 'pointer' }}><td className="mono">{x.code}</td><td>{x.name}</td><td>{x.group}</td><td className="mono">{x.edqmCode}</td><td>{x._count.medicines}</td></tr>)}</tbody>
            </table>
          )}
        </div>
      )}
    </>
  );
}
