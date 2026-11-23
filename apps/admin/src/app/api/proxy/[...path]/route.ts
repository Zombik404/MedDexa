import { NextResponse, type NextRequest } from 'next/server';
import { API_URL, readSession, refreshSession } from '@/lib/session';

/**
 * Same-origin proxy to the MedDexa API. Attaches the access token from the httpOnly
 * cookie, refreshes it once on 401, and only forwards /v1/* paths.
 */
async function handle(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  if (path[0] !== 'v1') return NextResponse.json({ message: 'Not found' }, { status: 404 });
  const url = `${API_URL}/${path.map(encodeURIComponent).join('/')}${req.nextUrl.search}`;
  const body = ['GET', 'HEAD'].includes(req.method) ? undefined : await req.text();
  const send = (token: string | null) =>
    fetch(url, {
      method: req.method,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body,
      cache: 'no-store',
    });
  let { access } = await readSession();
  access ??= await refreshSession();
  let res = await send(access);
  if (res.status === 401) {
    const next = await refreshSession();
    if (next) res = await send(next);
  }
  const text = await res.text();
  return new NextResponse(text || null, { status: res.status, headers: { 'Content-Type': res.headers.get('Content-Type') ?? 'application/json' } });
}

export { handle as GET, handle as POST, handle as PATCH, handle as PUT, handle as DELETE };
