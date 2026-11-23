'use client';
import { Trash2 } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { MedicineForm } from '@/components/MedicineForm';
import { Badge, ErrorBox, Field, Loading, PageHeader, VerificationBadge } from '@/components/ui';
import { api, fmtDate, useApi } from '@/lib/api';

interface Ingredient { id: string; name: string; moiety: { name: string } | null }
interface Detail {
  id: string;
  name: string;
  brand: string | null;
  manufacturerId: string | null;
  atcCode: string | null;
  formCode: string | null;
  route: string | null;
  release: string;
  prescription: string;
  countryCode: string | null;
  status: string;
  verification: string;
  isDemo: boolean;
  sourceId: string | null;
  sourceReference: string | null;
  syncedAt: string | null;
  duplicateOf: { id: string; name: string } | null;
  ingredients: { ingredientId: string; amount: string | null; unit: string | null; perAmount: string | null; perUnit: string | null; basis: 'SUBSTANCE' | 'MOIETY'; ingredient: Ingredient }[];
  packages: { id: string; quantity: string; unit: string; barcode: string | null; isDefault: boolean; description: string | null }[];
  registrations: { id: string; countryCode: string; authority: string; registrationNumber: string | null; localName: string; status: string; verification: string }[];
  synonyms: { id: string; name: string; language: string | null; countryCode: string | null; kind: string }[];
}

interface IngredientRow { ingredientId: string; name: string; amount: string; unit: string; perAmount: string; perUnit: string; basis: 'SUBSTANCE' | 'MOIETY' }

function IngredientsEditor({ medicine, onSaved }: { medicine: Detail; onSaved: () => void }) {
  const [rows, setRows] = useState<IngredientRow[]>(
    medicine.ingredients.map((i) => ({
      ingredientId: i.ingredientId,
      name: i.ingredient.name + (i.ingredient.moiety ? ` (→ ${i.ingredient.moiety.name})` : ''),
      amount: i.amount ?? '',
      unit: i.unit ?? '',
      perAmount: i.perAmount ?? '',
      perUnit: i.perUnit ?? '',
      basis: i.basis,
    })),
  );
  const [q, setQ] = useState('');
  const search = useApi<Ingredient[]>(q.length >= 2 ? '/admin/ingredients' : null, { q, pageSize: 8 });
  const [msg, setMsg] = useState<string | null>(null);
  const update = (i: number, patch: Partial<IngredientRow>) => setRows(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const num = (s: string) => (s.trim() === '' ? null : Number(s.replace(',', '.')));

  return (
    <div className="card">
      <h2>Active ingredients and exact quantities</h2>
      <p className="muted small" style={{ marginBottom: 10 }}>
        Strength is amount per reference quantity (e.g. 100 mg per 5 ml). Leave the reference empty for “per dose unit”. Unknown values must stay empty — never estimate.
      </p>
      <table className="table">
        <thead><tr><th>Substance</th><th>Amount</th><th>Unit</th><th>Per</th><th>Per unit</th><th>Expressed as</th><th /></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.ingredientId}>
              <td style={{ fontWeight: 600 }}>{r.name}</td>
              <td><input className="input" style={{ width: 90 }} value={r.amount} onChange={(e) => update(i, { amount: e.target.value })} inputMode="decimal" /></td>
              <td><input className="input" style={{ width: 70 }} value={r.unit} onChange={(e) => update(i, { unit: e.target.value })} placeholder="mg" /></td>
              <td><input className="input" style={{ width: 70 }} value={r.perAmount} onChange={(e) => update(i, { perAmount: e.target.value })} inputMode="decimal" /></td>
              <td><input className="input" style={{ width: 70 }} value={r.perUnit} onChange={(e) => update(i, { perUnit: e.target.value })} placeholder="ml" /></td>
              <td>
                <select value={r.basis} onChange={(e) => update(i, { basis: e.target.value as IngredientRow['basis'] })}>
                  <option value="SUBSTANCE">substance (salt)</option>
                  <option value="MOIETY">active moiety</option>
                </select>
              </td>
              <td><button className="btn danger small" aria-label="Remove" onClick={() => setRows(rows.filter((_, idx) => idx !== i))}><Trash2 size={14} /></button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="row" style={{ marginTop: 10 }}>
        <input className="input" placeholder="Add ingredient — type to search (INN or synonym)" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 1 }} />
      </div>
      {(search.data ?? []).filter((s) => !rows.some((r) => r.ingredientId === s.id)).length ? (
        <div className="row" style={{ marginTop: 8 }}>
          {(search.data ?? []).filter((s) => !rows.some((r) => r.ingredientId === s.id)).map((s) => (
            <button key={s.id} className="btn secondary small" onClick={() => { setRows([...rows, { ingredientId: s.id, name: s.name, amount: '', unit: 'mg', perAmount: '', perUnit: '', basis: 'SUBSTANCE' }]); setQ(''); }}>
              + {s.name}{s.moiety ? ` (${s.moiety.name})` : ''}
            </button>
          ))}
        </div>
      ) : null}
      {msg ? <p className="notice" style={{ marginTop: 10 }}>{msg}</p> : null}
      <button
        className="btn"
        style={{ marginTop: 12 }}
        onClick={async () => {
          try {
            await api(`/admin/medicines/${medicine.id}/ingredients`, {
              method: 'PUT',
              body: { ingredients: rows.map((r) => ({ ingredientId: r.ingredientId, amount: num(r.amount), unit: r.unit.trim() || null, perAmount: num(r.perAmount), perUnit: r.perUnit.trim() || null, basis: r.basis })) },
            });
            setMsg('Composition saved.');
            onSaved();
          } catch (e) {
            setMsg((e as Error).message);
          }
        }}
      >
        Save composition
      </button>
    </div>
  );
}

export default function MedicineDetailPage() {
  const { id } = useParams<{ id: string }>();
  const q = useApi<Detail>(`/admin/medicines/${id}`);
  const [pack, setPack] = useState({ quantity: '', unit: 'tablet', barcode: '' });
  const [reg, setReg] = useState({ countryCode: '', authority: '', registrationNumber: '', localName: '', status: 'AUTHORISED' });
  const [syn, setSyn] = useState({ name: '', language: '', countryCode: '', kind: 'LOCAL_NAME' });
  const [err, setErr] = useState<string | null>(null);
  if (q.loading && !q.data) return <Loading what="medicine" />;
  if (q.error || !q.data) return <ErrorBox error={q.error ?? 'Not found'} onRetry={q.reload} />;
  const m = q.data;
  const run = async (fn: () => Promise<unknown>) => {
    setErr(null);
    try {
      await fn();
      await q.reload();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <>
      <PageHeader
        title={m.name}
        subtitle={`Source: ${m.sourceId ?? 'manual'}${m.sourceReference ? ` · ${m.sourceReference}` : ''} · synced ${fmtDate(m.syncedAt)}`}
        actions={<><VerificationBadge value={m.verification} demo={m.isDemo} />{m.duplicateOf ? <Badge tone="warning">duplicate of {m.duplicateOf.name}</Badge> : null}</>}
      />
      {err ? <p className="error" style={{ marginBottom: 12 }}>{err}</p> : null}
      <div className="grid" style={{ gap: 18 }}>
        <MedicineForm
          key={m.id + m.name}
          submitLabel="Save details"
          initial={{ name: m.name, brand: m.brand, manufacturerId: m.manufacturerId, atcCode: m.atcCode, formCode: m.formCode, route: m.route, release: m.release, prescription: m.prescription, countryCode: m.countryCode, status: m.status, verification: m.verification }}
          onSubmit={async (v) => run(() => api(`/admin/medicines/${m.id}`, { method: 'PATCH', body: v }))}
        />
        <IngredientsEditor key={JSON.stringify(m.ingredients)} medicine={m} onSaved={q.reload} />

        <div className="grid grid-2">
          <div className="card">
            <h2>Packages</h2>
            <table className="table">
              <tbody>
                {m.packages.map((p) => (
                  <tr key={p.id}>
                    <td>{Number(p.quantity)} {p.unit} {p.isDefault ? <Badge tone="info">default</Badge> : null}</td>
                    <td className="mono">{p.barcode ?? '—'}</td>
                    <td><button className="btn danger small" onClick={() => run(() => api(`/admin/packages/${p.id}`, { method: 'DELETE' }))}>Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="row" style={{ marginTop: 10 }}>
              <input className="input" style={{ width: 80 }} placeholder="Qty" value={pack.quantity} onChange={(e) => setPack({ ...pack, quantity: e.target.value })} />
              <input className="input" style={{ width: 90 }} placeholder="Unit" value={pack.unit} onChange={(e) => setPack({ ...pack, unit: e.target.value })} />
              <input className="input" style={{ width: 150 }} placeholder="Barcode (GTIN)" value={pack.barcode} onChange={(e) => setPack({ ...pack, barcode: e.target.value })} />
              <button className="btn small" onClick={() => run(async () => { await api(`/admin/medicines/${m.id}/packages`, { method: 'POST', body: { quantity: Number(pack.quantity), unit: pack.unit, barcode: pack.barcode || null, isDefault: m.packages.length === 0 } }); setPack({ quantity: '', unit: 'tablet', barcode: '' }); })}>Add</button>
            </div>
          </div>

          <div className="card">
            <h2>Country registrations</h2>
            <table className="table">
              <tbody>
                {m.registrations.map((r) => (
                  <tr key={r.id}>
                    <td><strong>{r.countryCode}</strong> {r.localName}<div className="muted small">{r.authority} · {r.registrationNumber ?? '—'}</div></td>
                    <td><Badge tone={r.status === 'AUTHORISED' ? 'success' : 'warning'}>{r.status.toLowerCase()}</Badge></td>
                    <td><button className="btn danger small" onClick={() => run(() => api(`/admin/registrations/${r.id}`, { method: 'DELETE' }))}>Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="form-grid" style={{ marginTop: 10 }}>
              <Field label="Country"><input className="input" maxLength={2} value={reg.countryCode} onChange={(e) => setReg({ ...reg, countryCode: e.target.value.toUpperCase() })} /></Field>
              <Field label="Authority"><input className="input" value={reg.authority} onChange={(e) => setReg({ ...reg, authority: e.target.value })} /></Field>
              <Field label="Number"><input className="input" value={reg.registrationNumber} onChange={(e) => setReg({ ...reg, registrationNumber: e.target.value })} /></Field>
              <Field label="Local name"><input className="input" value={reg.localName} onChange={(e) => setReg({ ...reg, localName: e.target.value })} /></Field>
            </div>
            <button className="btn small" style={{ marginTop: 10 }} onClick={() => run(async () => { await api(`/admin/medicines/${m.id}/registrations`, { method: 'POST', body: { ...reg, registrationNumber: reg.registrationNumber || null } }); setReg({ countryCode: '', authority: '', registrationNumber: '', localName: '', status: 'AUTHORISED' }); })}>Add registration</button>
          </div>
        </div>

        <div className="card">
          <h2>Synonyms and localized names</h2>
          <div className="row" style={{ marginBottom: 10 }}>
            {m.synonyms.map((s) => <Badge key={s.id}>{s.name}{s.countryCode ? ` · ${s.countryCode}` : ''}{s.language ? ` · ${s.language}` : ''}</Badge>)}
          </div>
          <div className="row">
            <input className="input" placeholder="Name" value={syn.name} onChange={(e) => setSyn({ ...syn, name: e.target.value })} />
            <input className="input" style={{ width: 80 }} placeholder="Lang" value={syn.language} onChange={(e) => setSyn({ ...syn, language: e.target.value })} />
            <input className="input" style={{ width: 80 }} placeholder="Country" maxLength={2} value={syn.countryCode} onChange={(e) => setSyn({ ...syn, countryCode: e.target.value.toUpperCase() })} />
            <select value={syn.kind} onChange={(e) => setSyn({ ...syn, kind: e.target.value })}>{['LOCAL_NAME', 'BRAND', 'INN', 'SPELLING', 'OTHER'].map((k) => <option key={k}>{k}</option>)}</select>
            <button className="btn small" onClick={() => run(async () => { await api(`/admin/medicines/${m.id}/synonyms`, { method: 'POST', body: { name: syn.name, language: syn.language || null, countryCode: syn.countryCode || null, kind: syn.kind } }); setSyn({ name: '', language: '', countryCode: '', kind: 'LOCAL_NAME' }); })}>Add synonym</button>
          </div>
        </div>
      </div>
    </>
  );
}
