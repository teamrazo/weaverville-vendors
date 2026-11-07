// Server-only request guards shared by the API routes.

const MAX_BODY_BYTES = 16 * 1024;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export class RequestError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

// Reject cross-site form posts. Browsers send Origin on fetch POSTs.
// Requests with no Origin (server-to-server, curl) are allowed through
// and still face the field validation below.
export function assertSameOrigin(req: Request) {
  const origin = req.headers.get('origin');
  if (!origin) return;
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  try {
    if (new URL(origin).host !== host) throw new RequestError('Forbidden', 403);
  } catch (err) {
    if (err instanceof RequestError) throw err;
    throw new RequestError('Forbidden', 403);
  }
}

export async function readJsonBody(req: Request): Promise<Record<string, unknown>> {
  const text = await req.text();
  if (!text) throw new RequestError('Empty request body');
  if (text.length > MAX_BODY_BYTES) throw new RequestError('Request too large', 413);
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
    return parsed;
  } catch {
    throw new RequestError('Invalid request body');
  }
}

// Trim, strip control characters, and cap length.
export function clean(value: unknown, max = 200): string {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
}

export function isEmail(value: string): boolean {
  return value.length <= 254 && EMAIL_RE.test(value);
}
