import type { AuthTokens } from '@meddexa/shared';
import { NextResponse } from 'next/server';
import { API_URL, STAFF_ROLES, storeSession } from '@/lib/session';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const res = await fetch(`${API_URL}/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: body.email, password: body.password }),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return NextResponse.json({ message: data.message ?? 'Login failed' }, { status: res.status });
  const tokens = data as AuthTokens;
  if (!(STAFF_ROLES as readonly string[]).includes(tokens.user.role)) {
    // Revoke the session we just created: regular users have no admin access.
    await fetch(`${API_URL}/v1/auth/logout`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: tokens.refreshToken }) });
    return NextResponse.json({ message: 'This account has no administrative access.' }, { status: 403 });
  }
  await storeSession(tokens);
  return NextResponse.json({ user: tokens.user });
}
