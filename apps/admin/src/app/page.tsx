'use client';
import Link from 'next/link';
import { Badge, ErrorBox, Loading, PageHeader } from '@/components/ui';
import { fmtDate, useApi } from '@/lib/api';

interface Overview {
  medicines: number;
  pharmacies: number;
  prices: number;
  stalePrices: number;
  pendingReviews: number;
  openReports: number;
  users: number;
  failedSyncs: number;
  sources: { id: string; name: string; enabled: boolean; lastStatus: string | null; lastSyncAt: string | null; isDemo: boolean }[];
}

export default function OverviewPage() {
  const { data, error, loading, reload } = useApi<Overview>('/admin/overview');
  if (loading) return <Loading />;
  if (error || !data) return <ErrorBox error={error ?? 'No data'} onRetry={reload} />;
  const stats: [string, number, string, string?][] = [
    ['Active medicines', data.medicines, '/medicines'],
    ['Pharmacies', data.pharmacies, '/pharmacies'],
    ['Price records', data.prices, '/prices'],
    ['Stale prices', data.stalePrices, '/prices?stale=true', data.stalePrices ? 'warning' : undefined],
    ['Pending reviews', data.pendingReviews, '/reviews', data.pendingReviews ? 'warning' : undefined],
    ['Open reports', data.openReports, '/reviews', data.openReports ? 'danger' : undefined],
    ['Users', data.users, '/users'],
    ['Failed syncs (7 days)', data.failedSyncs, '/integrations', data.failedSyncs ? 'danger' : undefined],
  ];
  return (
    <>
      <PageHeader title="Overview" subtitle="Platform health, data quality and moderation at a glance." />
      <div className="grid grid-4">
        {stats.map(([label, value, href, tone]) => (
          <Link key={label} href={href} className="card stat">
            <div className="label">{label}</div>
            <div className="value" style={{ color: tone ? `var(--${tone})` : undefined }}>
              {value.toLocaleString('en-GB')}
            </div>
          </Link>
        ))}
      </div>
      <div className="card" style={{ marginTop: 18 }}>
        <h2>Data sources</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Source</th>
              <th>Status</th>
              <th>Last sync</th>
            </tr>
          </thead>
          <tbody>
            {data.sources.map((s) => (
              <tr key={s.id}>
                <td>
                  {s.name} {s.isDemo ? <Badge tone="warning">demo</Badge> : null}
                </td>
                <td>
                  <Badge tone={s.enabled ? 'success' : undefined}>{s.enabled ? 'enabled' : 'disabled'}</Badge>{' '}
                  {s.lastStatus ? <Badge tone={s.lastStatus === 'SUCCESS' ? 'success' : s.lastStatus === 'FAILED' ? 'danger' : 'warning'}>{s.lastStatus.toLowerCase()}</Badge> : null}
                </td>
                <td className="muted">{fmtDate(s.lastSyncAt, true)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
