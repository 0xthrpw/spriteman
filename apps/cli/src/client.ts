import { defaultApiUrl, readSession, writeSession, type Session } from './config.js';

export class AuthError extends Error {}
export class ConflictError extends Error {
  constructor(
    message: string,
    public serverVersion?: number,
  ) {
    super(message);
  }
}

type RequestInitExt = RequestInit & { ifMatch?: number };

const extractSessionCookie = (setCookie: string | null): string | null => {
  if (!setCookie) return null;
  // Set-Cookie may include multiple cookies joined; grab the first spriteman_sid=...
  const match = setCookie.match(/spriteman_sid=[^;]+/);
  return match ? match[0] : null;
};

const baseUrl = (override?: string) => override ?? defaultApiUrl();

export type Client = ReturnType<typeof createClient>;

export const createClient = (opts: { apiUrl?: string } = {}) => {
  const session: Session | null = readSession();
  const url = baseUrl(opts.apiUrl);

  const headers = (extra?: Record<string, string>): Record<string, string> => {
    const h: Record<string, string> = { 'content-type': 'application/json', ...extra };
    if (session?.cookie) h['cookie'] = session.cookie;
    return h;
  };

  const request = async <T>(
    method: string,
    path: string,
    body?: unknown,
    init: RequestInitExt = {},
  ): Promise<{ data: T; etag: string | null; setCookie: string | null }> => {
    const extra: Record<string, string> = {};
    if (init.ifMatch != null) extra['if-match'] = String(init.ifMatch);
    const res = await fetch(`${url}${path}`, {
      method,
      headers: headers(extra),
      body: body == null ? undefined : JSON.stringify(body),
    });
    if (res.status === 401) throw new AuthError('not logged in — run `spriteman login`');
    if (res.status === 409) {
      let serverVersion: number | undefined;
      try {
        const j = (await res.json()) as { message?: string };
        const m = j.message?.match(/version (\d+)/);
        if (m) serverVersion = Number(m[1]);
      } catch {
        // ignore
      }
      const etag = res.headers.get('etag');
      if (etag && serverVersion == null) serverVersion = Number(etag);
      throw new ConflictError('version_mismatch', serverVersion);
    }
    if (!res.ok) {
      let msg = `${res.status} ${res.statusText}`;
      try {
        const j = await res.json();
        msg += ` — ${JSON.stringify(j)}`;
      } catch {
        // ignore
      }
      throw new Error(msg);
    }
    const setCookie = res.headers.get('set-cookie');
    const etag = res.headers.get('etag');
    if (res.status === 204 || res.headers.get('content-length') === '0') {
      return { data: undefined as unknown as T, etag, setCookie };
    }
    const data = (await res.json()) as T;
    return { data, etag, setCookie };
  };

  return {
    apiUrl: url,
    session,
    get: <T>(path: string) => request<T>('GET', path),
    post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
    put: <T>(path: string, body: unknown, ifMatch?: number) =>
      request<T>('PUT', path, body, ifMatch == null ? {} : { ifMatch }),
    del: <T>(path: string) => request<T>('DELETE', path),
    /**
     * Log in + persist session cookie. Needed because the default client loads
     * the cookie from disk at construction — during login there is no cookie yet.
     */
    login: async (email: string, password: string): Promise<void> => {
      const res = await fetch(`${url}/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (res.status === 401) throw new AuthError('invalid_credentials');
      if (!res.ok) throw new Error(`login failed: ${res.status} ${res.statusText}`);
      const cookie = extractSessionCookie(res.headers.get('set-cookie'));
      if (!cookie) throw new Error('login response did not include a session cookie');
      writeSession({
        cookie,
        apiUrl: url,
        email,
        savedAt: new Date().toISOString(),
      });
    },
  };
};
