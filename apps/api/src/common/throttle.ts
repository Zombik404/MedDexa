/**
 * Per-route limits scale with THROTTLE_MULTIPLIER (default 1) so load and e2e tests can
 * raise them without code changes. Read at module load time.
 */
const multiplier = Math.max(1, Number(process.env.THROTTLE_MULTIPLIER ?? 1));
export const limit = (perMinute: number) => ({ default: { limit: perMinute * multiplier, ttl: 60_000 } });
