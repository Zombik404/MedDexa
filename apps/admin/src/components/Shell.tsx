'use client';
import type { AuthUser } from '@meddexa/shared';
import { BarChart3, Database, FlaskConical, Gauge, LogOut, MapPin, MessageSquareWarning, Pill, ScrollText, Tags, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';

const NAV = [
  { href: '/', label: 'Overview', icon: Gauge, roles: ['MODERATOR', 'EDITOR', 'ADMIN'] },
  { href: '/medicines', label: 'Medicines', icon: Pill, roles: ['EDITOR', 'ADMIN'] },
  { href: '/ingredients', label: 'Ingredients', icon: FlaskConical, roles: ['EDITOR', 'ADMIN'] },
  { href: '/reference', label: 'Manufacturers & forms', icon: Database, roles: ['EDITOR', 'ADMIN'] },
  { href: '/pharmacies', label: 'Pharmacies', icon: MapPin, roles: ['EDITOR', 'ADMIN'] },
  { href: '/prices', label: 'Prices & availability', icon: Tags, roles: ['EDITOR', 'ADMIN'] },
  { href: '/reviews', label: 'Reviews & reports', icon: MessageSquareWarning, roles: ['MODERATOR', 'ADMIN'] },
  { href: '/integrations', label: 'Data integrations', icon: Database, roles: ['EDITOR', 'ADMIN'] },
  { href: '/analytics', label: 'Analytics', icon: BarChart3, roles: ['EDITOR', 'ADMIN'] },
  { href: '/users', label: 'Users', icon: Users, roles: ['ADMIN'] },
  { href: '/audit', label: 'Audit log', icon: ScrollText, roles: ['ADMIN'] },
];

export function Shell({ user, children }: { user: AuthUser; children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mark.svg" width={30} height={30} alt="" />
          <div>
            Med<span>Dexa</span>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.55)' }}>Administration</div>
          </div>
        </div>
        <nav className="nav">
          {NAV.filter((n) => n.roles.includes(user.role)).map((n) => {
            const active = n.href === '/' ? path === '/' : path.startsWith(n.href);
            return (
              <Link key={n.href} href={n.href} className={active ? 'active' : ''}>
                <n.icon size={17} />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-foot">
          <div style={{ fontWeight: 700, color: '#fff' }}>{user.displayName ?? user.email}</div>
          <div>{user.role.toLowerCase()}</div>
          <button
            className="btn secondary small"
            style={{ marginTop: 10 }}
            onClick={async () => {
              await fetch('/api/auth/logout', { method: 'POST' });
              router.replace('/login');
            }}
          >
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
