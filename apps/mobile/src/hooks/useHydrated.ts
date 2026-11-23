import { useEffect, useState } from 'react';
import { useCompare } from '@/store/compare';
import { useLocal } from '@/store/local';
import { usePreferences } from '@/store/preferences';

const stores = [usePreferences, useCompare, useLocal];

/** True once every persisted store has been read from device storage. */
export function useHydrated() {
  const [done, setDone] = useState(() => stores.every((s) => s.persist.hasHydrated()));
  useEffect(() => {
    if (done) return;
    const check = () => setDone(stores.every((s) => s.persist.hasHydrated()));
    const unsubs = stores.map((s) => s.persist.onFinishHydration(check));
    check();
    return () => unsubs.forEach((u) => u());
  }, [done]);
  return done;
}
