'use client';
import { useCallback, useEffect, useState } from 'react';

export class AdminApiError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

export async function api<T>(path: string, init: { method?: string; body?: unknown; query?: Record<string, string | number | undefined | null> } = {}): Promise<T> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(init.query ?? {})) if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  const res = await fetch(`/api/proxy/v1${path}${qs.size ? `?${qs}` : ''}`, {
    method: init.method ?? 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  if (res.status === 401) {
    window.location.href = '/login';
    throw new AdminApiError(401, 'Session expired');
  }
  const text = await res.text();
  const json = text ? JSON.parse(text) : undefined;
  if (!res.ok) {
    const details = json?.details ? ` — ${JSON.stringify(json.details)}` : '';
    throw new AdminApiError(res.status, `${json?.message ?? res.statusText}${details}`, json?.details);
  }
  return json as T;
}

/** Minimal data hook: loading/error/data plus reload, keyed by a dependency string. */
export function useApi<T>(path: string | null, query?: Record<string, string | number | undefined | null>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!path);
  const key = path ? `${path}?${JSON.stringify(query ?? {})}` : null;
  const load = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    setError(null);
    try {
      setData(await api<T>(path, { query }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => {
    void load();
  }, [load]);
  return { data, error, loading, reload: load, setData };
}

export function fmtDate(iso: string | null | undefined, time = false) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-GB', time ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' }).format(new Date(iso));
}

export function money(amount: string | number, currency: string) {
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(Number(amount));
  } catch {
    return `${amount} ${currency}`;
  }
}
