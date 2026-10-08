// Server-only helpers for HighLevel (LeadConnector) contact sync.

const GHL_BASE = 'https://services.leadconnectorhq.com';
const GHL_VERSION = '2021-07-28';

export const GHL_TAGS = {
  submitted: 'wcoc - vendor-app - submitted',
  paymentPending: 'action - vendor-app - payment-pending',
  paid: 'wcoc - vendor-app - paid',
};

export type VendorContact = {
  email?: string;
  phone?: string;
  contactName?: string;
  businessName?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
};

function ghlConfig() {
  const apiKey = process.env.GHL_API_KEY || '';
  const locationId = process.env.GHL_LOCATION_ID || 'ltcv3MxZCgXvlwLhieDR';
  return { apiKey, locationId };
}

function ghlHeaders(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    Version: GHL_VERSION,
    'Content-Type': 'application/json',
  };
}

function splitName(full?: string) {
  const parts = (full || '').trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] || '', lastName: parts.slice(1).join(' ') };
}

export type GhlResult =
  | { ok: true; contactId: string | null }
  | { ok: false; error: string };

/**
 * Create or update the vendor's contact in HighLevel.
 * Never throws. Always reports failure so it shows up in Vercel logs.
 */
export async function upsertGhlContact(
  contact: VendorContact,
  tags: string[] = []
): Promise<GhlResult> {
  const { apiKey, locationId } = ghlConfig();

  if (!apiKey) {
    console.error('[ghl] GHL_API_KEY is not set. Contact was NOT sent to HighLevel.', {
      email: contact.email,
    });
    return { ok: false, error: 'GHL_API_KEY not configured' };
  }

  if (!contact.email && !contact.phone) {
    console.error('[ghl] No email or phone on contact. Skipping HighLevel upsert.');
    return { ok: false, error: 'missing email and phone' };
  }

  const { firstName, lastName } = splitName(contact.contactName);

  const payload: Record<string, unknown> = {
    locationId,
    email: contact.email || undefined,
    phone: contact.phone || undefined,
    firstName: firstName || undefined,
    lastName: lastName || undefined,
    companyName: contact.businessName || undefined,
    address1: contact.address || undefined,
    city: contact.city || undefined,
    state: contact.state || undefined,
    postalCode: contact.zip || undefined,
    source: 'weaverville-vendors',
  };
  if (tags.length) payload.tags = tags;

  try {
    const res = await fetch(`${GHL_BASE}/contacts/upsert`, {
      method: 'POST',
      headers: ghlHeaders(apiKey),
      body: JSON.stringify(payload),
    });
    const text = await res.text();

    if (!res.ok) {
      console.error('[ghl] Upsert failed', { status: res.status, body: text.slice(0, 500), email: contact.email });
      return { ok: false, error: `HighLevel responded ${res.status}` };
    }

    let contactId: string | null = null;
    try {
      contactId = JSON.parse(text)?.contact?.id ?? null;
    } catch {
      /* non-JSON success body; keep going */
    }
    console.log('[ghl] Contact upserted', { contactId, email: contact.email });
    return { ok: true, contactId };
  } catch (err: any) {
    console.error('[ghl] Upsert request error', { message: err?.message, email: contact.email });
    return { ok: false, error: err?.message || 'request failed' };
  }
}

/** Add and remove tags on an existing HighLevel contact. Never throws. */
export async function updateGhlTags(contactId: string, add: string[], remove: string[] = []) {
  const { apiKey } = ghlConfig();
  if (!apiKey || !contactId) return;

  const call = async (method: 'POST' | 'DELETE', tags: string[]) => {
    if (!tags.length) return;
    try {
      const res = await fetch(`${GHL_BASE}/contacts/${contactId}/tags`, {
        method,
        headers: ghlHeaders(apiKey),
        body: JSON.stringify({ tags }),
      });
      if (!res.ok) {
        console.error(`[ghl] Tag ${method} failed`, { status: res.status, contactId, body: (await res.text()).slice(0, 300) });
      }
    } catch (err: any) {
      console.error(`[ghl] Tag ${method} error`, { contactId, message: err?.message });
    }
  };

  await call('POST', add);
  await call('DELETE', remove);
}
