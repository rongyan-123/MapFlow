import { publicHttpErrorMessage } from '../lib/publicErrors';

export interface ApiFailure {
  status: number;
  code: string;
  message: string;
  traceId?: string;
  requestId?: string;
  details?: unknown;
}

/** One browser request boundary. Mutations are never automatically repeated. */
export function request(path: string, options: RequestInit = {}): Promise<Response> {
  let headers: HeadersInit;
  if (options.headers instanceof Headers || Array.isArray(options.headers)) {
    const merged = new Headers(options.headers);
    if (!merged.has('Accept')) merged.set('Accept', 'application/json');
    headers = merged;
  } else {
    headers = { Accept: 'application/json', ...options.headers };
  }
  return fetch(path, { credentials: 'same-origin', ...options, headers });
}

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/** Preserve error identity; never display server or provider diagnostic text. */
export async function readFailure(response: Response, fallbackCode = 'request.failed'): Promise<ApiFailure> {
  let envelope: unknown;
  try { envelope = await response.json(); } catch { envelope = null; }
  const error = record(envelope) && record(envelope.error) ? envelope.error : {};
  const code = typeof error.code === 'string' ? error.code : fallbackCode;
  return {
    status: response.status, code, message: publicHttpErrorMessage(code, response.status),
    ...(typeof error.traceId === 'string' ? { traceId: error.traceId } : {}),
    ...(typeof error.requestId === 'string' ? { requestId: error.requestId } : {}),
    ...(error.details !== undefined ? { details: error.details } : {}),
  };
}
