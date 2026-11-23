import type { AuthTokens, AuthUser } from '@meddexa/shared';
import { create } from 'zustand';
import { secure } from '@/lib/storage';

const REFRESH_KEY = 'meddexa.refreshToken';
const USER_KEY = 'meddexa.user';

interface SessionState {
  ready: boolean;
  user: AuthUser | null;
  accessToken: string | null;
  accessExpiresAt: number;
  refreshToken: string | null;
  hydrate: () => Promise<void>;
  setTokens: (t: AuthTokens) => Promise<void>;
  setUser: (u: AuthUser) => void;
  clear: () => Promise<void>;
}

export const useSession = create<SessionState>()((set) => ({
  ready: false,
  user: null,
  accessToken: null,
  accessExpiresAt: 0,
  refreshToken: null,
  hydrate: async () => {
    const [refreshToken, user] = await Promise.all([secure.get(REFRESH_KEY), secure.get(USER_KEY)]);
    set({ refreshToken, user: user ? (JSON.parse(user) as AuthUser) : null, ready: true });
  },
  setTokens: async (t) => {
    await Promise.all([secure.set(REFRESH_KEY, t.refreshToken), secure.set(USER_KEY, JSON.stringify(t.user))]);
    set({ accessToken: t.accessToken, accessExpiresAt: Date.now() + (t.expiresIn - 30) * 1000, refreshToken: t.refreshToken, user: t.user });
  },
  setUser: (user) => {
    void secure.set(USER_KEY, JSON.stringify(user));
    set({ user });
  },
  clear: async () => {
    await Promise.all([secure.remove(REFRESH_KEY), secure.remove(USER_KEY)]);
    set({ accessToken: null, accessExpiresAt: 0, refreshToken: null, user: null });
  },
}));
