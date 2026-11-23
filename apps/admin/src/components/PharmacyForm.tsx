'use client';
import { useState } from 'react';
import { Field } from '@/components/ui';

export interface PharmacyFormValue {
  name: string;
  street: string;
  city: string | null;
  postcode: string | null;
  countryCode: string;
  lat: number;
  lng: number;
  phone: string | null;
  phoneVerified: boolean;
  website: string | null;
  websiteVerified: boolean;
  email: string | null;
  status: string;
  verification: string;
}

export function PharmacyForm({ initial, onSubmit, submitLabel }: { initial: PharmacyFormValue; onSubmit: (v: PharmacyFormValue) => Promise<void>; submitLabel: string }) {
  const [v, setV] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const set = (p: Partial<PharmacyFormValue>) => setV({ ...v, ...p });
  const nul = (s: string) => (s.trim() ? s.trim() : null);
  return (
    <form className="card" onSubmit={async (e) => { e.preventDefault(); setError(null); try { await onSubmit(v.verification === 'DEMO' ? (({ verification: _v, ...rest }) => rest as PharmacyFormValue)(v) : v); } catch (err) { setError((err as Error).message); } }}>
      <div className="form-grid">
        <Field label="Name *"><input className="input" required value={v.name} onChange={(e) => set({ name: e.target.value })} /></Field>
        <Field label="Street *"><input className="input" required value={v.street} onChange={(e) => set({ street: e.target.value })} /></Field>
        <Field label="Postcode"><input className="input" value={v.postcode ?? ''} onChange={(e) => set({ postcode: nul(e.target.value) })} /></Field>
        <Field label="City"><input className="input" value={v.city ?? ''} onChange={(e) => set({ city: nul(e.target.value) })} /></Field>
        <Field label="Country *"><input className="input" required maxLength={2} value={v.countryCode} onChange={(e) => set({ countryCode: e.target.value.toUpperCase() })} /></Field>
        <Field label="Latitude *"><input className="input" required type="number" step="any" value={v.lat} onChange={(e) => set({ lat: Number(e.target.value) })} /></Field>
        <Field label="Longitude *"><input className="input" required type="number" step="any" value={v.lng} onChange={(e) => set({ lng: Number(e.target.value) })} /></Field>
        <Field label="Phone"><input className="input" value={v.phone ?? ''} onChange={(e) => set({ phone: nul(e.target.value) })} /></Field>
        <Field label="Website"><input className="input" type="url" value={v.website ?? ''} onChange={(e) => set({ website: nul(e.target.value) })} /></Field>
        <Field label="Email"><input className="input" type="email" value={v.email ?? ''} onChange={(e) => set({ email: nul(e.target.value) })} /></Field>
        <Field label="Status"><select value={v.status} onChange={(e) => set({ status: e.target.value })}>{['ACTIVE', 'DRAFT', 'ARCHIVED'].map((s) => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Verification"><select value={v.verification} onChange={(e) => set({ verification: e.target.value })}>{v.verification === 'DEMO' ? <option value="DEMO" disabled>DEMO (fixed)</option> : null}{['VERIFIED', 'UNVERIFIED', 'OUTDATED'].map((s) => <option key={s} disabled={v.verification === 'DEMO'}>{s}</option>)}</select></Field>
      </div>
      <div className="row" style={{ marginTop: 12 }}>
        <label className="row small"><input type="checkbox" checked={v.phoneVerified} onChange={(e) => set({ phoneVerified: e.target.checked })} /> Phone verified (enables “Call” in the app)</label>
        <label className="row small"><input type="checkbox" checked={v.websiteVerified} onChange={(e) => set({ websiteVerified: e.target.checked })} /> Website verified (enables “Website”)</label>
      </div>
      {error ? <p className="error" style={{ marginTop: 10 }}>{error}</p> : null}
      <button className="btn" type="submit" style={{ marginTop: 12 }}>{submitLabel}</button>
    </form>
  );
}
