'use client';
import { useState } from 'react';
import { Badge, ErrorBox, Loading, PageHeader, Tabs } from '@/components/ui';
import { api, fmtDate, useApi } from '@/lib/api';

interface Log { id: string; sourceId: string; status: string; trigger: string; startedAt: string; finishedAt: string | null; recordsRead: number; recordsCreated: number; recordsUpdated: number; recordsFailed: number; error: string | null; source?: { name: string } }
interface Source {
  id: string; name: string; kind: string; adapter: string; countryCode: string | null; enabled: boolean; isDemo: boolean; url: string | null; licence: string | null; attribution: string | null; config: Record<string, unknown> | null; lastSyncAt: string | null; lastStatus: string | null;
  syncLogs: Log[]; _count: { medicines: number; pharmacies: number; offers: number };
  readiness: { adapterFound: boolean; onDemandOnly: boolean; missingEnv: string[]; missingConfig: string[] }; adapterRegistered: boolean;
}
interface Coverage { code: string; name: string; medicines: number; realMedicines: number; pharmacies: number; realPharmacies: number; offers: number; enabledSources: number; planned: string | null; isTargetMarket: boolean }

const statusTone = (s: string | null) => (s === 'SUCCESS' ? 'success' : s === 'FAILED' ? 'danger' : s ? 'warning' : undefined);

function SourceCard({ s, onChanged }: { s: Source; onChanged: () => void }) {
  const [config, setConfig] = useState(JSON.stringify(s.config ?? {}, null, 2));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const ready = !s.readiness.missingEnv.length && !s.readiness.missingConfig.length;
  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ marginBottom: 2 }}>{s.name}</h2>
          <div className="small muted">{s.kind.toLowerCase()} · adapter <code>{s.adapter}</code>{s.countryCode ? ` · ${s.countryCode}` : ' · Europe-wide'}</div>
        </div>
        <div className="row">
          {s.isDemo ? <Badge tone="warning">demo</Badge> : null}
          <Badge tone={s.enabled ? 'success' : undefined}>{s.enabled ? 'enabled' : 'disabled'}</Badge>
          {s.lastStatus ? <Badge tone={statusTone(s.lastStatus)}>{s.lastStatus.toLowerCase()}</Badge> : null}
        </div>
      </div>
      <p className="small" style={{ margin: '10px 0' }}>
        <strong>Licence:</strong> {s.licence ?? '—'}<br />
        <strong>Attribution:</strong> {s.attribution ?? '—'}<br />
        <strong>Records:</strong> {s._count.medicines} medicines · {s._count.pharmacies} pharmacies · {s._count.offers} offers · last sync {fmtDate(s.lastSyncAt, true)}
      </p>
      {s.readiness.onDemandOnly ? <p className="notice" style={{ marginBottom: 8 }}>On-demand provider: results are fetched live and never stored (provider terms).</p> : null}
      {!ready ? (
        <p className="notice" style={{ marginBottom: 8, background: 'var(--warning-soft)', color: 'var(--warning)' }}>
          Not ready: {[...s.readiness.missingEnv.map((e) => `set environment variable ${e}`), ...s.readiness.missingConfig.map((c) => `add config "${c}"`)].join('; ')}
        </p>
      ) : null}
      <label className="field">Adapter configuration (JSON, no secrets)
        <textarea className="mono" rows={4} value={config} onChange={(e) => setConfig(e.target.value)} />
      </label>
      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn secondary small" onClick={async () => { try { await api(`/admin/integrations/${s.id}`, { method: 'PATCH', body: { config: JSON.parse(config) } }); setMsg('Configuration saved.'); onChanged(); } catch (e) { setMsg((e as Error).message); } }}>Save config</button>
        <button className="btn secondary small" onClick={async () => { await api(`/admin/integrations/${s.id}`, { method: 'PATCH', body: { enabled: !s.enabled } }); onChanged(); }}>{s.enabled ? 'Disable' : 'Enable'}</button>
        <button className="btn small" disabled={busy || s.readiness.onDemandOnly} onClick={async () => { setBusy(true); setMsg(null); try { const r = await api<{ status: string; error?: string; read?: number; created?: number; updated?: number; failed?: number }>(`/admin/integrations/${s.id}/sync`, { method: 'POST' }); setMsg(r.error ? `${r.status}: ${r.error}` : `${r.status}: read ${r.read}, created ${r.created}, updated ${r.updated}, failed ${r.failed}`); onChanged(); } finally { setBusy(false); } }}>{busy ? 'Syncing…' : 'Run sync now'}</button>
      </div>
      {msg ? <p className="small" style={{ marginTop: 8 }}>{msg}</p> : null}
      {s.syncLogs.length ? (
        <table className="table" style={{ marginTop: 10 }}>
          <tbody>
            {s.syncLogs.map((l) => (
              <tr key={l.id}>
                <td><Badge tone={statusTone(l.status)}>{l.status.toLowerCase()}</Badge></td>
                <td className="small">{fmtDate(l.startedAt, true)} · {l.trigger}</td>
                <td className="small">{l.recordsRead} read / {l.recordsCreated} new / {l.recordsUpdated} upd / {l.recordsFailed} failed</td>
                <td className="small error">{l.error}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}

export default function IntegrationsPage() {
  const [tab, setTab] = useState<'sources' | 'coverage' | 'logs'>('sources');
  const sources = useApi<Source[]>(tab === 'sources' ? '/admin/integrations' : null);
  const coverage = useApi<Coverage[]>(tab === 'coverage' ? '/admin/integrations/coverage' : null);
  const logs = useApi<Log[]>(tab === 'logs' ? '/admin/integrations/logs' : null, { pageSize: 100 });
  return (
    <>
      <PageHeader title="Data integrations" subtitle="Provider adapters, configuration, synchronisation history and country coverage." />
      <Tabs value={tab} onChange={setTab} options={[{ value: 'sources', label: 'Providers' }, { value: 'coverage', label: 'Country coverage' }, { value: 'logs', label: 'Import logs' }]} />
      {tab === 'sources' ? (
        sources.loading ? <Loading /> : sources.error ? <ErrorBox error={sources.error} /> : <div className="grid" style={{ gap: 14 }}>{(sources.data ?? []).map((s) => <SourceCard key={s.id} s={s} onChanged={sources.reload} />)}</div>
      ) : tab === 'coverage' ? (
        coverage.loading ? <Loading /> : coverage.error ? <ErrorBox error={coverage.error} /> : (
          <div className="card">
            <table className="table">
              <thead><tr><th>Country</th><th>Medicines (real / all)</th><th>Pharmacies (real / all)</th><th>Offers</th><th>Enabled sources</th><th>Planned integration</th></tr></thead>
              <tbody>
                {(coverage.data ?? []).map((c) => (
                  <tr key={c.code}>
                    <td><strong>{c.code}</strong> {c.name}</td>
                    <td>{c.realMedicines} / {c.medicines}</td>
                    <td>{c.realPharmacies} / {c.pharmacies}</td>
                    <td>{c.offers}</td>
                    <td>{c.enabledSources ? <Badge tone="success">{c.enabledSources}</Badge> : <Badge tone="warning">none</Badge>}</td>
                    <td className="small muted">{c.planned ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : logs.loading ? <Loading /> : logs.error ? <ErrorBox error={logs.error} /> : (
        <div className="card">
          <table className="table">
            <thead><tr><th>Source</th><th>Status</th><th>Started</th><th>Records</th><th>Error</th></tr></thead>
            <tbody>
              {(logs.data ?? []).map((l) => (
                <tr key={l.id}>
                  <td>{l.source?.name ?? l.sourceId}</td>
                  <td><Badge tone={statusTone(l.status)}>{l.status.toLowerCase()}</Badge></td>
                  <td className="small">{fmtDate(l.startedAt, true)} · {l.trigger}</td>
                  <td className="small">{l.recordsRead}/{l.recordsCreated}/{l.recordsUpdated}/{l.recordsFailed}</td>
                  <td className="small error">{l.error}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
