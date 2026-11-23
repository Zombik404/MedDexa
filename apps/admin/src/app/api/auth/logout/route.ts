import { NextResponse } from 'next/server';
import { API_URL, clearSession, readSession } from '@/lib/session';

export async function POST() {
  const { refresh } = await readSession();
  if (refresh) {
    await fetch(`${API_URL}/v1/auth/logout`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: refresh }) }).catch(() => undefined);
  }
  await clearSession();
  return NextResponse.json({ ok: true });
}
