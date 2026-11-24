// Server-only HighLevel (LeadConnector) client for vendor tracking.
//
// Every call either succeeds or throws GhlError with the HTTP status and response body.
// Callers decide what a failure means (the webhook returns 500 so Stripe retries; the form
// lets the vendor keep going and logs loudly). Nothing here swallows an API error.

const GHL_BASE = 'https://services.leadconnectorhq.com';
const GHL_VERSION = '2021-07-28';

/**
 * Vendor application tags. Names match the location's tag list.
 * HighLevel workflows trigger on `submitted` and `paymentCompleted`.
 */
export const GHL_TAGS = {
  submitted: 'wcoc - vendor-app - submitted',
  paymentPending: 'action - vendor-app - payment-pending',
  paymentCompleted: 'action - vendor-app - payment-completed',
  /** Proposed: not yet in the location's tag list. Added by the API on first use. */
  paymentFailed: 'action - vendor-app - payment-failed',
  /** Proposed: not yet in the location's tag list. Added by the API on first use. */
  paymentCanceled: 'action - vendor-app - payment-canceled',
  /** Set by the board-alert workflow, never by the app. */
  boardNotified: 'wcoc - vendor-app - board-notified',
  /** Legacy. Never existed in the location; no longer written. */
  legacyPaid: 'wcoc - vendor-app - paid',
} as const;

export const campaignTag = (tagSlug: string) => `campaign - ${tagSlug} - vendor`;

export class GhlError extends Error {
  constructor(message: string, public status: number | null, public body: string, public op: string) {
    super(message);
    this.name = 'GhlError';
  }
}

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

export type GhlConfig = { apiKey: string; locationId: string; fetchImpl?: typeof fetch };

export function ghlConfigFromEnv(): GhlConfig {
  return {
    apiKey: process.env.GHL_WCOC_API_KEY || process.env.GHL_API_KEY || '',
    locationId: process.env.GHL_LOCATION_ID || 'ltcv3MxZCgXvlwLhieDR',
  };
}

function splitName(full?: string) {
  const parts = (full || '').trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] || '', lastName: parts.slice(1).join(' ') };
}

/** Logical vendor fields, filled only when a matching custom field already exists in the location. */
export const VENDOR_FIELDS = {
  event: ['vendor event', 'event name', 'vendor event name'],
  boothType: ['booth type', 'vendor booth type', 'vendor booth'],
  feeOption: ['fee option', 'vendor fee option', 'days attending', 'vendor days attending'],
  preferredDays: ['preferred days', 'vendor preferred days'],
  amount: ['vendor fee', 'vendor fee amount', 'fee amount', 'amount paid', 'vendor amount'],
  businessDescription: ['business description', 'vendor business description', 'products services', 'products services description', 'vendor products services'],
  paymentStatus: ['payment status', 'vendor payment status'],
  stripeCustomerId: ['stripe customer id', 'stripe customer'],
  stripePaymentIntentId: ['stripe payment intent id', 'stripe payment intent', 'payment intent id', 'stripe payment id'],
  receiptUrl: ['receipt url', 'stripe receipt url', 'vendor receipt url'],
} as const;
export type VendorField = keyof typeof VENDOR_FIELDS;

const normalize = (s: string) => s.toLowerCase().replace(/^contact\./, '').replace(/[^a-z0-9]+/g, ' ').trim();

type CustomFieldDef = { id: string; name: string; fieldKey?: string; model?: string };

export class GhlClient {
  private fieldMap: Promise<Partial<Record<VendorField, string>>> | null = null;

  constructor(private cfg: GhlConfig) {}

  get configured() {
    return Boolean(this.cfg.apiKey);
  }

  private async call<T = any>(op: string, method: string, path: string, body?: unknown): Promise<T> {
    if (!this.cfg.apiKey) throw new GhlError('GHL_WCOC_API_KEY is not set', null, '', op);
    const doFetch = this.cfg.fetchImpl || fetch;
    let res: Response;
    try {
      res = await doFetch(`${GHL_BASE}${path}`, {
        method,
        headers: { Authorization: `Bearer ${this.cfg.apiKey}`, Version: GHL_VERSION, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (err: any) {
      throw new GhlError(`${op}: request failed (${err?.message || 'network error'})`, null, '', op);
    }
    const text = await res.text();
    if (!res.ok) throw new GhlError(`${op}: HighLevel responded ${res.status}`, res.status, text.slice(0, 800), op);
    if (!text) return {} as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      return {} as T;
    }
  }

  /** Create or update the contact by email/phone. Returns the contact id. Tags are added separately. */
  async upsertContact(contact: VendorContact): Promise<string> {
    if (!contact.email && !contact.phone) throw new GhlError('upsert: no email or phone', null, '', 'upsert');
    const { firstName, lastName } = splitName(contact.contactName);
    const data = await this.call<{ contact?: { id?: string } }>('upsert', 'POST', '/contacts/upsert', {
      locationId: this.cfg.locationId,
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
    });
    const id = data?.contact?.id;
    if (!id) throw new GhlError('upsert: no contact id in response', 200, JSON.stringify(data).slice(0, 300), 'upsert');
    return id;
  }

  /** Finds a contact by email. Null when none. */
  async findContactByEmail(email: string): Promise<string | null> {
    const q = new URLSearchParams({ locationId: this.cfg.locationId, email });
    const data = await this.call<{ contact?: { id?: string } | null }>('find-duplicate', 'GET', `/contacts/search/duplicate?${q}`);
    return data?.contact?.id || null;
  }

  async getContactTags(contactId: string): Promise<string[]> {
    const data = await this.call<{ contact?: { tags?: string[] } }>('get-contact', 'GET', `/contacts/${contactId}`);
    return (data?.contact?.tags || []).map((t) => t.toLowerCase());
  }

  async addTags(contactId: string, tags: string[]) {
    const list = tags.filter(Boolean);
    if (list.length) await this.call('add-tags', 'POST', `/contacts/${contactId}/tags`, { tags: list });
  }

  async removeTags(contactId: string, tags: string[]) {
    const list = tags.filter(Boolean);
    if (list.length) await this.call('remove-tags', 'DELETE', `/contacts/${contactId}/tags`, { tags: list });
  }

  async addNote(contactId: string, body: string) {
    await this.call('add-note', 'POST', `/contacts/${contactId}/notes`, { body });
  }

  /**
   * The location's contact custom fields that match vendor fields, by name or key.
   * Looked up once per client. Fields are never created here.
   */
  async vendorFieldIds(): Promise<Partial<Record<VendorField, string>>> {
    if (!this.fieldMap) {
      this.fieldMap = this.call<{ customFields?: CustomFieldDef[] }>('custom-fields', 'GET', `/locations/${this.cfg.locationId}/customFields?model=contact`).then((data) => {
        const defs = data?.customFields || [];
        const map: Partial<Record<VendorField, string>> = {};
        for (const [field, names] of Object.entries(VENDOR_FIELDS) as Array<[VendorField, readonly string[]]>) {
          const wanted = new Set(names.map(normalize));
          const hit = defs.find((d) => wanted.has(normalize(d.name || '')) || (d.fieldKey && wanted.has(normalize(d.fieldKey))));
          if (hit) map[field] = hit.id;
        }
        return map;
      });
      this.fieldMap.catch(() => { this.fieldMap = null; });
    }
    return this.fieldMap;
  }

  /**
   * Writes vendor values into whichever matching custom fields exist.
   * Returns the logical fields written and those with no custom field in the location.
   */
  async setVendorFields(contactId: string, values: Partial<Record<VendorField, string>>) {
    const ids = await this.vendorFieldIds();
    const customFields: Array<{ id: string; field_value: string }> = [];
    const written: VendorField[] = [];
    const missing: VendorField[] = [];
    for (const [field, value] of Object.entries(values) as Array<[VendorField, string | undefined]>) {
      if (value === undefined || value === '') continue;
      const id = ids[field];
      if (id) { customFields.push({ id, field_value: value }); written.push(field); } else missing.push(field);
    }
    if (customFields.length) await this.call('update-fields', 'PUT', `/contacts/${contactId}`, { customFields });
    return { written, missing };
  }
}
