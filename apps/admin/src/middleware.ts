import { NextResponse, type NextRequest } from 'next/server';

/** Every page except /login requires a staff session cookie. API proxy checks again. */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith('/login') || pathname.startsWith('/api/auth') || pathname.startsWith('/_next') || pathname === '/mark.svg') {
    return NextResponse.next();
  }
  const hasSession = req.cookies.has('mdx_refresh');
  if (!hasSession) {
    if (pathname.startsWith('/api/')) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
