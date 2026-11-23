import type { AuthTokens, AuthUser } from '@meddexa/shared';
import { cookies } from 'next/headers';

export const API_URL = (process.env.API_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const ACCESS = 'mdx_access';
const REFRESH = 'mdx_refresh';
const USER = 'mdx_user';
export const STAFF_ROLES = ['MODERATOR', 'EDITOR', 'ADMIN'] as const;

const base = () => ({
  httpOnly: true,
  sameSite: 'strict' as const,
  secure: process.env.COOKIE_SECURE === 'true',
  path: '/',
});

/** Tokens live only in httpOnly cookies; the browser never sees them. */
export async function storeSession(t: AuthTokens) {
  const jar = await cookies();
  jar.set(ACCESS, t.accessToken, { ...base(), maxAge: t.expiresIn });
  jar.set(REFRESH, t.refreshToken, { ...base(), maxAge: 60 * 60 * 24 * 7 });
  jar.set(USER, JSON.stringify(t.user), { ...base(), httpOnly: false, maxAge: 60 * 60 * 24 * 7 });
}

export async function clearSession() {
  const jar = await cookies();
  for (const n of [ACCESS, REFRESH, USER]) jar.delete(n);
}

export async function readSession() {
  const jar = await cookies();
  const user = jar.get(USER)?.value;
  return {
    access: jar.get(ACCESS)?.value ?? null,
    refresh: jar.get(REFRESH)?.value ?? null,
    user: user ? (JSON.parse(user) as AuthUser) : null,
  };
}

export async function refreshSession(): Promise<string | null> {
  const { refresh } = await readSession();
  if (!refresh) return null;
  const res = await fetch(`${API_URL}/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: refresh }),
    cache: 'no-store',
  });
  if (!res.ok) {
    await clearSession();
    return null;
  }
  const tokens = (await res.json()) as AuthTokens;
  await storeSession(tokens);
  return tokens.accessToken;
}
