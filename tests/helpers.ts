import { GhlClient } from '../app/lib/ghl';

export type Call = { method: string; path: string; body: any };

/**
 * A fake HighLevel API. Records every call in order. Custom fields in the location can be set,
 * and any path can be made to fail.
 */
export function fakeGhl(opts: { customFields?: Array<{ id: string; name: string; fieldKey?: string }>; failOn?: (c: Call) => number | null; existingContact?: string | null; tags?: string[] } = {}) {
  const calls: Call[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    const u = new URL(url);
    const call: Call = { method: init.method || 'GET', path: u.pathname + u.search, body: init.body ? JSON.parse(String(init.body)) : undefined };
    calls.push(call);
    const status = opts.failOn?.(call);
    if (status) return new Response('{"message":"boom"}', { status });
    if (u.pathname === '/contacts/upsert') return Response.json({ contact: { id: 'ghl_contact_1' } });
    if (u.pathname.startsWith('/contacts/search/duplicate')) return Response.json({ contact: opts.existingContact ? { id: opts.existingContact } : null });
    if (/\/locations\/.+\/customFields/.test(u.pathname)) return Response.json({ customFields: opts.customFields || [] });
    if (/^\/contacts\/[^/]+$/.test(u.pathname) && call.method === 'GET') return Response.json({ contact: { tags: opts.tags || [] } });
    return Response.json({ succeeded: true });
  }) as unknown as typeof fetch;
  const client = new GhlClient({ apiKey: 'test-key', locationId: 'loc_test', fetchImpl });
  return { client, calls };
}

export const indexOf = (calls: Call[], pred: (c: Call) => boolean) => calls.findIndex(pred);
export const isTagAdd = (tag: string) => (c: Call) => c.method === 'POST' && c.path.endsWith('/tags') && c.body?.tags?.includes(tag);
export const isTagRemove = (tag: string) => (c: Call) => c.method === 'DELETE' && c.path.endsWith('/tags') && c.body?.tags?.includes(tag);
export const isNote = (c: Call) => c.method === 'POST' && c.path.endsWith('/notes');
export const isFieldUpdate = (c: Call) => c.method === 'PUT' && /^\/contacts\/[^/]+$/.test(c.path);
export const silent = { log() {}, warn() {}, error() {} };
