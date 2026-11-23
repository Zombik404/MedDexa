'use client';
import { useState } from 'react';
import { Badge, Empty, ErrorBox, Loading, PageHeader, Pager, Tabs } from '@/components/ui';
import { api, fmtDate, useApi } from '@/lib/api';

interface Review { id: string; target: string; rating: number; title: string | null; body: string; language: string; status: string; moderationNote: string | null; createdAt: string; author: { email: string; displayName: string | null }; medicine: { name: string } | null; pharmacy: { name: string } | null; _count: { reports: number } }
interface Report { id: string; reason: string; details: string | null; createdAt: string; review: { id: string; body: string; status: string }; reporter: { email: string } }

export default function ReviewsPage() {
  const [tab, setTab] = useState<'queue' | 'reports'>('queue');
  const [status, setStatus] = useState('PENDING');
  const [page, setPage] = useState(1);
  const reviews = useApi<{ items: Review[]; total: number; page: number; pageSize: number }>(tab === 'queue' ? '/admin/reviews' : null, { status, page });
  const reports = useApi<Report[]>(tab === 'reports' ? '/admin/reports' : null);
  const moderate = async (id: string, next: string) => {
    await api(`/admin/reviews/${id}`, { method: 'PATCH', body: { status: next } });
    reviews.reload();
  };
  return (
    <>
      <PageHeader title="Reviews & reports" subtitle="Reviews held by automatic pre-moderation (links, personal data, medical claims, abuse) and user reports." />
      <Tabs value={tab} onChange={setTab} options={[{ value: 'queue', label: 'Moderation queue' }, { value: 'reports', label: 'Open reports' }]} />
      <div className="card">
        {tab === 'queue' ? (
          <>
            <div className="row" style={{ marginBottom: 12 }}>
              {['PENDING', 'PUBLISHED', 'REJECTED', 'REMOVED'].map((s) => <button key={s} className={`tab ${s === status ? 'active' : ''}`} onClick={() => { setStatus(s); setPage(1); }}>{s.toLowerCase()}</button>)}
            </div>
            {reviews.loading ? <Loading /> : reviews.error ? <ErrorBox error={reviews.error} /> : !reviews.data?.items.length ? <Empty>Nothing to moderate.</Empty> : (
              <>
                <table className="table">
                  <thead><tr><th>Review</th><th>About</th><th>Author</th><th>Flags</th><th>Actions</th></tr></thead>
                  <tbody>
                    {reviews.data.items.map((r) => (
                      <tr key={r.id}>
                        <td style={{ maxWidth: 420 }}>{'★'.repeat(r.rating)}{r.title ? <div><strong>{r.title}</strong></div> : null}<div className="small">{r.body}</div><div className="small muted">{fmtDate(r.createdAt, true)} · {r.language}</div></td>
                        <td className="small">{r.medicine?.name ?? r.pharmacy?.name}<div className="muted">{r.target.toLowerCase()}</div></td>
                        <td className="small">{r.author.displayName ?? '—'}<div className="muted">{r.author.email}</div></td>
                        <td className="small">{r.moderationNote ? <Badge tone="warning">{r.moderationNote}</Badge> : null} {r._count.reports ? <Badge tone="danger">{r._count.reports} reports</Badge> : null}</td>
                        <td>
                          <div className="row">
                            {r.status !== 'PUBLISHED' ? <button className="btn small" onClick={() => moderate(r.id, 'PUBLISHED')}>Publish</button> : null}
                            {r.status !== 'REJECTED' ? <button className="btn secondary small" onClick={() => moderate(r.id, 'REJECTED')}>Reject</button> : null}
                            {r.status !== 'REMOVED' ? <button className="btn danger small" onClick={() => moderate(r.id, 'REMOVED')}>Remove</button> : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <Pager page={reviews.data.page} pageSize={reviews.data.pageSize} total={reviews.data.total} onPage={setPage} />
              </>
            )}
          </>
        ) : reports.loading ? <Loading /> : reports.error ? <ErrorBox error={reports.error} /> : !reports.data?.length ? <Empty>No open reports.</Empty> : (
          <table className="table">
            <thead><tr><th>Reason</th><th>Review</th><th>Reporter</th><th>Actions</th></tr></thead>
            <tbody>
              {reports.data.map((r) => (
                <tr key={r.id}>
                  <td><Badge tone="danger">{r.reason.toLowerCase().replace(/_/g, ' ')}</Badge><div className="small muted">{r.details}</div></td>
                  <td className="small" style={{ maxWidth: 420 }}>{r.review.body}<div className="muted">status: {r.review.status.toLowerCase()}</div></td>
                  <td className="small">{r.reporter.email}<div className="muted">{fmtDate(r.createdAt)}</div></td>
                  <td className="row">
                    <button className="btn danger small" onClick={async () => { await api(`/admin/reports/${r.id}`, { method: 'PATCH', body: { status: 'RESOLVED', removeReview: true } }); reports.reload(); }}>Remove review</button>
                    <button className="btn secondary small" onClick={async () => { await api(`/admin/reports/${r.id}`, { method: 'PATCH', body: { status: 'DISMISSED' } }); reports.reload(); }}>Dismiss</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
