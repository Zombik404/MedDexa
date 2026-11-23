'use client';
import { useState } from 'react';
import { Field } from '@/components/ui';
import { useApi } from '@/lib/api';

export interface MedicineFormValue {
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
}

const ROUTES = ['ORAL', 'CUTANEOUS', 'TRANSDERMAL', 'INTRAVENOUS', 'INTRAMUSCULAR', 'SUBCUTANEOUS', 'OCULAR', 'NASAL', 'RECTAL', 'INHALATION', 'SUBLINGUAL'];

export function MedicineForm({ initial, onSubmit, submitLabel }: { initial: MedicineFormValue; onSubmit: (v: MedicineFormValue) => Promise<void>; submitLabel: string }) {
  const [v, setV] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const forms = useApi<{ code: string; name: string }[]>('/admin/forms');
  const mfrs = useApi<{ id: string; name: string }[]>('/admin/manufacturers', { pageSize: 100 });
  const set = (patch: Partial<MedicineFormValue>) => setV({ ...v, ...patch });
  const nul = (s: string) => (s.trim() ? s.trim() : null);
  return (
    <form
      className="card"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          // Demo records keep their DEMO label; it cannot be changed from the dashboard.
          await onSubmit(v.verification === 'DEMO' ? (({ verification: _v, ...rest }) => rest as MedicineFormValue)(v) : v);
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="form-grid">
        <Field label="Name *"><input className="input" required minLength={2} value={v.name} onChange={(e) => set({ name: e.target.value })} /></Field>
        <Field label="Brand"><input className="input" value={v.brand ?? ''} onChange={(e) => set({ brand: nul(e.target.value) })} /></Field>
        <Field label="Manufacturer">
          <select value={v.manufacturerId ?? ''} onChange={(e) => set({ manufacturerId: nul(e.target.value) })}>
            <option value="">—</option>
            {(mfrs.data ?? []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </Field>
        <Field label="ATC code"><input className="input" value={v.atcCode ?? ''} onChange={(e) => set({ atcCode: nul(e.target.value.toUpperCase()) })} maxLength={7} /></Field>
        <Field label="Pharmaceutical form">
          <select value={v.formCode ?? ''} onChange={(e) => set({ formCode: nul(e.target.value) })}>
            <option value="">— unknown —</option>
            {(forms.data ?? []).map((f) => <option key={f.code} value={f.code}>{f.name}</option>)}
          </select>
        </Field>
        <Field label="Route">
          <select value={v.route ?? ''} onChange={(e) => set({ route: nul(e.target.value) })}>
            <option value="">— unknown —</option>
            {ROUTES.map((r) => <option key={r}>{r}</option>)}
          </select>
        </Field>
        <Field label="Release mechanism">
          <select value={v.release} onChange={(e) => set({ release: e.target.value })}>
            {['IMMEDIATE', 'MODIFIED', 'PROLONGED', 'DELAYED', 'GASTRO_RESISTANT', 'UNKNOWN'].map((r) => <option key={r}>{r}</option>)}
          </select>
        </Field>
        <Field label="Prescription status">
          <select value={v.prescription} onChange={(e) => set({ prescription: e.target.value })}>
            {['RX', 'OTC', 'PHARMACY_ONLY', 'UNKNOWN'].map((r) => <option key={r}>{r}</option>)}
          </select>
        </Field>
        <Field label="Primary market"><input className="input" value={v.countryCode ?? ''} maxLength={2} onChange={(e) => set({ countryCode: nul(e.target.value.toUpperCase()) })} /></Field>
        <Field label="Status">
          <select value={v.status} onChange={(e) => set({ status: e.target.value })}>
            {['ACTIVE', 'DRAFT', 'ARCHIVED'].map((r) => <option key={r}>{r}</option>)}
          </select>
        </Field>
        <Field label="Verification">
          <select value={v.verification} onChange={(e) => set({ verification: e.target.value })}>
            {v.verification === 'DEMO' ? <option value="DEMO" disabled>DEMO (fixed)</option> : null}
            {['VERIFIED', 'UNVERIFIED', 'OUTDATED'].map((r) => <option key={r} disabled={v.verification === 'DEMO'}>{r}</option>)}
          </select>
        </Field>
      </div>
      {error ? <p className="error" style={{ marginTop: 10 }}>{error}</p> : null}
      <div className="row" style={{ marginTop: 14 }}>
        <button className="btn" disabled={busy} type="submit">{busy ? 'Saving…' : submitLabel}</button>
      </div>
    </form>
  );
}
