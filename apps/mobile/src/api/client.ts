import type { ApiErrorBody, AuthTokens } from '@meddexa/shared';
import { Platform } from 'react-native';
import { useSession } from '@/store/session';

const fallbackUrl = Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? fallbackUrl).replace(/\/$/, '');

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string | undefined,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
  get isNetwork() {
    return this.status === 0;
  }
}

type Query = Record<string, string | number | boolean | string[] | null | undefined>;

function buildUrl(path: string, query?: Query) {
  const url = `${API_URL}/v1${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === '') continue;
    params.set(k, Array.isArray(v) ? v.join(',') : String(v));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

let refreshing: Promise<string | null> | null = null;

/** Exchanges the stored refresh token for a new access token (single flight). */
async function refreshAccessToken(): Promise<string | null> {
  const { refreshToken, setTokens, clear } = useSession.getState();
  if (!refreshToken) return null;
  refreshing ??= (async () => {
    try {
      const res = await fetch(buildUrl('/auth/refresh'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) {
        if (res.status === 401) await clear();
        return null;
      }
      const tokens = (await res.json()) as AuthTokens;
      await setTokens(tokens);
      return tokens.accessToken;
    } catch {
      return null;
    } finally {
      setTimeout(() => (refreshing = null), 0);
    }
  })();
  return refreshing;
}

async function accessToken(): Promise<string | null> {
  const s = useSession.getState();
  if (s.accessToken && s.accessExpiresAt > Date.now()) return s.accessToken;
  if (s.refreshToken) return refreshAccessToken();
  return null;
}

export async function api<T>(
  path: string,
  opts: { method?: string; query?: Query; body?: unknown; auth?: boolean; signal?: AbortSignal } = {},
): Promise<T> {
  const doFetch = async (token: string | null) => {
    try {
      return await fetch(buildUrl(path, opts.query), {
        method: opts.method ?? 'GET',
        signal: opts.signal,
        headers: {
          Accept: 'application/json',
          ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      });
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw e;
      throw new ApiError(0, 'NETWORK', 'Network request failed');
    }
  };
  // Public endpoints send a token when one exists, so signed-in users get personalisation.
  let token = await accessToken();
  if (opts.auth && !token) throw new ApiError(401, 'AUTH_REQUIRED', 'Sign in required');
  let res = await doFetch(token);
  if (res.status === 401 && token) {
    token = await refreshAccessToken();
    if (token) res = await doFetch(token);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const json = text ? JSON.parse(text) : undefined;
  if (!res.ok) {
    const body = (json ?? {}) as Partial<ApiErrorBody>;
    throw new ApiError(res.status, body.code, body.message ?? res.statusText, body.details);
  }
  return json as T;
}

/**
 * Multipart upload of a local image (photo search). On native, React Native's FormData
 * streams the file from its URI; on web the URI is a blob/data URL that is read first.
 */
export async function apiUploadImage<T>(path: string, image: { uri: string; mimeType?: string | null }, query?: Query): Promise<T> {
  const form = new FormData();
  const type = image.mimeType ?? 'image/jpeg';
  if (Platform.OS === 'web') {
    const blob = await (await fetch(image.uri)).blob();
    form.append('image', blob, 'box.jpg');
  } else {
    form.append('image', { uri: image.uri, name: 'box.jpg', type } as unknown as Blob);
  }
  const token = await accessToken();
  let res: Response;
  try {
    res = await fetch(buildUrl(path, query), {
      method: 'POST',
      headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: form,
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Network request failed');
  }
  const text = await res.text();
  const json = text ? JSON.parse(text) : undefined;
  if (!res.ok) {
    const body = (json ?? {}) as Partial<ApiErrorBody>;
    throw new ApiError(res.status, body.code, body.message ?? res.statusText, body.details);
  }
  return json as T;
}
