import type { DataAdapter, SyncContext, SyncResult } from '../adapter';

/** Development-only source. "Syncing" it only reports what demo data exists. */
export const demoAdapter: DataAdapter = {
  key: 'demo',
  async sync(ctx: SyncContext): Promise<SyncResult> {
    if (ctx.env.NODE_ENV === 'production') throw new Error('Demo source cannot run in production');
    const [medicines, pharmacies] = await Promise.all([
      ctx.prisma.medicine.count({ where: { isDemo: true } }),
      ctx.prisma.pharmacy.count({ where: { isDemo: true } }),
    ]);
    return { read: medicines + pharmacies, created: 0, updated: 0, failed: 0, details: { medicines, pharmacies, note: 'Run the seed with SEED_DEMO=true to (re)create demo data.' } };
  },
};
