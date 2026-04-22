/**
 * Standalone PHP/MySQL API client.
 * Replaces the Supabase JS client. All requests hit /api/*.php on the
 * same origin. Auth uses a JWT stored in localStorage under 'nouli_token'.
 */

const TOKEN_KEY = 'nouli_token';

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

interface RequestOpts {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  /** Skip JSON encoding (used for FormData uploads). */
  raw?: boolean;
}

function buildUrl(path: string, query?: RequestOpts['query']): string {
  const url = new URL(path, window.location.origin);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') {
        url.searchParams.set(k, String(v));
      }
    }
  }
  // Return path + query (relative) so it works behind any reverse proxy
  return url.pathname + url.search;
}

/**
 * Core request helper. Returns parsed JSON on success, throws ApiError on
 * non-2xx responses. Automatically attaches the bearer token.
 */
export async function api<T = unknown>(path: string, opts: RequestOpts = {}): Promise<T> {
  const { method = 'GET', body, query, raw } = opts;
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload: BodyInit | undefined;
  if (body !== undefined && body !== null) {
    if (raw) {
      payload = body as BodyInit;
    } else {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }
  }

  const res = await fetch(buildUrl(path, query), {
    method,
    headers,
    body: payload,
  });

  let data: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const msg =
      (data && typeof data === 'object' && 'error' in (data as Record<string, unknown>)
        ? String((data as { error?: unknown }).error)
        : null) || `Request failed with status ${res.status}`;
    throw new ApiError(msg, res.status);
  }

  return data as T;
}