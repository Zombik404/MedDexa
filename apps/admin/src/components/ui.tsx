'use client';
import type { ReactNode } from 'react';

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="header">
      <div>
        <h1>{title}</h1>
        {subtitle ? <p className="muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="row">{actions}</div> : null}
    </div>
  );
}

export function Badge({ children, tone }: { children: ReactNode; tone?: 'success' | 'warning' | 'danger' | 'info' }) {
  return <span className={`badge ${tone ?? ''}`}>{children}</span>;
}

export function VerificationBadge({ value, demo }: { value: string; demo?: boolean }) {
  if (demo) return <Badge tone="warning">Demo</Badge>;
  const tone = value === 'VERIFIED' ? 'success' : value === 'OUTDATED' ? 'warning' : undefined;
  return <Badge tone={tone}>{value.toLowerCase()}</Badge>;
}

export function Loading({ what = 'data' }: { what?: string }) {
  return <p className="muted">Loading {what}…</p>;
}

export function ErrorBox({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <div className="card" role="alert" style={{ borderColor: 'var(--danger)' }}>
      <p className="error">{error}</p>
      {onRetry ? (
        <button className="btn secondary small" style={{ marginTop: 8 }} onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="muted" style={{ padding: '18px 0' }}>{children}</p>;
}

export function Pager({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="pager">
      <span className="muted">
        {total} records · page {page} of {pages}
      </span>
      <button className="btn secondary small" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Previous
      </button>
      <button className="btn secondary small" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Next
      </button>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      {label}
      {children}
    </label>
  );
}

export function Tabs<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="tabs" role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={o.value === value} className={`tab ${o.value === value ? 'active' : ''}`} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
