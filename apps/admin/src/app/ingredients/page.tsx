'use client';
import { useState } from 'react';
import { Badge, Empty, ErrorBox, Field, Loading, PageHeader } from '@/components/ui';
import { api, useApi } from '@/lib/api';

interface Ing { id: string; name: string; casNumber: string | null; moietyId: string | null; moiety: { id: string; name: string } | null; synonyms: { name: string; language: string | null }[]; _count: { quantities: number } }

export default function IngredientsPage() {
  const [q, setQ] = useState('');
  const list = useApi<Ing[]>('/admin/ingredients', { q, pageSize: 100 });
  const all = useApi<Ing[]>('/admin/ingredients', { pageSize: 100 });
  const [form, setForm] = useState({ name: '', moietyId: '', casNumber: '', synonyms: '' });
  const [msg, setMsg] = useState<string | null>(null);
  const parseSyn = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean).map((x) => { const [name, language] = x.split(':'); return { name: name!.trim(), language: language?.trim() || null }; });

  return (
    <>
      <PageHeader title="Active ingredients" subtitle="Substances, their active moieties (salt → moiety) and multilingual synonyms used by search and comparison." />
      <div className="card" style={{ marginBottom: 18 }}>
        <h2>Add ingredient</h2>
        <div className="form-grid">
          <Field label="INN / name"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Active moiety (for salts)">
            <select value={form.moietyId} onChange={(e) => setForm({ ...form, moietyId: e.target.value })}>
              <option value="">— none (is a moiety) —</option>
              {(all.data ?? []).filter((i) => !i.moietyId).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </Field>
          <Field label="CAS number"><input className="input" value={form.casNumber} onChange={(e) => setForm({ ...form, casNumber: e.target.value })} /></Field>
          <Field label="Synonyms (name:lang, …)"><input className="input" placeholder="paracétamol:fr, APAP" value={form.synonyms} onChange={(e) => setForm({ ...form, synonyms: e.target.value })} /></Field>
        </div>
        {msg ? <p className="notice" style={{ marginTop: 10 }}>{msg}</p> : null}
        <button className="btn" style={{ marginTop: 12 }} onClick={async () => {
          try {
            await api('/admin/ingredients', { method: 'POST', body: { name: form.name, moietyId: form.moietyId || null, casNumber: form.casNumber || null, synonyms: parseSyn(form.synonyms) } });
            setForm({ name: '', moietyId: '', casNumber: '', synonyms: '' });
            setMsg('Ingredient created.');
            list.reload(); all.reload();
          } catch (e) { setMsg((e as Error).message); }
        }}>Create</button>
      </div>
      <div className="card">
        <input className="input" placeholder="Search ingredients or synonyms" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: '100%', marginBottom: 12 }} />
        {list.loading ? <Loading /> : list.error ? <ErrorBox error={list.error} /> : !list.data?.length ? <Empty>No ingredients.</Empty> : (
          <table className="table">
            <thead><tr><th>Substance</th><th>Moiety</th><th>Synonyms</th><th>Used by</th><th>Edit synonyms</th></tr></thead>
            <tbody>
              {list.data.map((i) => (
                <tr key={i.id}>
                  <td style={{ fontWeight: 700 }}>{i.name}{i.casNumber ? <div className="muted small mono">CAS {i.casNumber}</div> : null}</td>
                  <td>{i.moiety ? <Badge tone="info">{i.moiety.name}</Badge> : <span className="muted">—</span>}</td>
                  <td className="small">{i.synonyms.map((s) => `${s.name}${s.language ? ` (${s.language})` : ''}`).join(', ') || '—'}</td>
                  <td>{i._count.quantities}</td>
                  <td>
                    <SynonymEditor ingredient={i} onSaved={() => list.reload()} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function SynonymEditor({ ingredient, onSaved }: { ingredient: Ing; onSaved: () => void }) {
  const [value, setValue] = useState(ingredient.synonyms.map((s) => (s.language ? `${s.name}:${s.language}` : s.name)).join(', '));
  return (
    <div className="row">
      <input className="input" value={value} onChange={(e) => setValue(e.target.value)} style={{ minWidth: 220 }} />
      <button className="btn secondary small" onClick={async () => {
        const synonyms = value.split(',').map((x) => x.trim()).filter(Boolean).map((x) => { const [name, language] = x.split(':'); return { name: name!.trim(), language: language?.trim() || null }; });
        await api(`/admin/ingredients/${ingredient.id}`, { method: 'PATCH', body: { synonyms } });
        onSaved();
      }}>Save</button>
    </div>
  );
}
