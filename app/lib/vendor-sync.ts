// Keeps the web app, Stripe and HighLevel in step for vendor applications.
//
// Order matters everywhere below: details (note and custom fields) are written BEFORE the tag
// that triggers a HighLevel workflow, so the board alert can include them.
//
//   submit            upsert contact -> note -> fields -> tags: submitted, payment-pending, campaign
//   payment started   Stripe customer + PaymentIntent ids -> fields, or a note if no fields exist
//   payment succeeded note (amount, PaymentIntent, receipt) -> fields -> tag payment-completed,
//                     remove payment-pending / failed / canceled
//   payment failed    note (reason) -> fields -> tag payment-failed (payment-pending stays: they can retry)
//   payment canceled  note -> fields -> tag payment-canceled, remove payment-pending

import type Stripe from 'stripe';
import { campaignTag, GHL_TAGS, GhlClient, type VendorContact, type VendorField } from './ghl';

export const formatUsd = (cents: number) => `$${(cents / 100).toFixed(2)}`;

const line = (label: string, value: string | undefined | null) => (value ? `${label}: ${value}` : '');
const note = (title: string, lines: string[]) => [title, ...lines.filter(Boolean)].join('\n');
const pacific = (d: Date) => d.toLocaleString('en-US', { timeZone: 'America/Los_Angeles', dateStyle: 'medium', timeStyle: 'short' }) + ' PT';

export type VendorApplication = {
  contact: VendorContact;
  eventName: string;
  eventDate: string;
  tagSlug: string;
  boothType: string;
  feeOptionLabel: string;
  preferredDays: string;
  amountCents: number;
  businessDescription: string;
  submittedAt?: Date;
};

/** Records a submitted application in HighLevel. Throws GhlError on any API failure. */
export async function recordApplication(ghl: GhlClient, app: VendorApplication) {
  const contactId = await ghl.upsertContact(app.contact);
  const at = app.submittedAt || new Date();

  await ghl.addNote(contactId, note('Vendor application submitted', [
    line('Event', `${app.eventName} (${app.eventDate})`),
    line('Booth type', app.boothType),
    line('Fee option', app.feeOptionLabel),
    line('Preferred days', app.preferredDays),
    line('Amount due', formatUsd(app.amountCents)),
    line('Business', app.contact.businessName),
    line('Products / services', app.businessDescription),
    line('Submitted', pacific(at)),
    'Payment: pending',
  ]));

  const fields = await ghl.setVendorFields(contactId, {
    event: app.eventName,
    boothType: app.boothType,
    feeOption: app.feeOptionLabel,
    preferredDays: app.preferredDays,
    amount: formatUsd(app.amountCents),
    businessDescription: app.businessDescription,
    paymentStatus: 'Pending payment',
  });

  // Trigger tags last.
  await ghl.addTags(contactId, [GHL_TAGS.submitted, GHL_TAGS.paymentPending, campaignTag(app.tagSlug)]);
  return { contactId, fieldsWritten: fields.written, fieldsMissing: fields.missing };
}

/** Stores the Stripe ids on the HighLevel contact: custom fields when they exist, otherwise a note. */
export async function linkStripeIds(ghl: GhlClient, contactId: string, ids: { customerId: string; paymentIntentId: string }) {
  const fields = await ghl.setVendorFields(contactId, { stripeCustomerId: ids.customerId, stripePaymentIntentId: ids.paymentIntentId });
  const missing = new Set<VendorField>(fields.missing);
  if (missing.has('stripeCustomerId') || missing.has('stripePaymentIntentId')) {
    await ghl.addNote(contactId, note('Payment started', [
      line('Stripe customer', ids.customerId),
      line('Stripe PaymentIntent', ids.paymentIntentId),
    ]));
  }
  return fields;
}

// ───────────────────────── Stripe events ─────────────────────────

export const HANDLED_EVENTS = ['payment_intent.succeeded', 'payment_intent.payment_failed', 'payment_intent.canceled'] as const;
type HandledEvent = (typeof HANDLED_EVENTS)[number];

/** Stripe calls the webhook needs. Narrow so tests can pass a fake. */
export type StripeLike = {
  paymentIntents: {
    retrieve(id: string, params?: Stripe.PaymentIntentRetrieveParams): Promise<Stripe.PaymentIntent>;
    update(id: string, params: Stripe.PaymentIntentUpdateParams): Promise<Stripe.PaymentIntent>;
  };
};

export type Logger = Pick<Console, 'log' | 'warn' | 'error'>;

// Processed Stripe event ids live on the PaymentIntent itself (metadata, 500 chars), so retries
// and duplicate deliveries are skipped without a database.
const PROCESSED_KEY = 'ghl_synced_events';
const processedIds = (pi: Stripe.PaymentIntent) => (pi.metadata?.[PROCESSED_KEY] || '').split(',').filter(Boolean);

async function markProcessed(stripe: StripeLike, pi: Stripe.PaymentIntent, eventId: string, log: Logger) {
  const ids = [...processedIds(pi), eventId].slice(-12);
  let value = ids.join(',');
  while (value.length > 500 && ids.length > 1) { ids.shift(); value = ids.join(','); }
  try {
    await stripe.paymentIntents.update(pi.id, { metadata: { [PROCESSED_KEY]: value } });
  } catch (err: any) {
    // HighLevel is already updated. A missing mark only risks a duplicate note on a retry.
    log.warn('[vendor-sync] Could not record processed event on PaymentIntent', { paymentIntent: pi.id, eventId, message: err?.message });
  }
}

/** The HighLevel contact for a payment: the id saved at submit, else by email, else created from metadata. */
async function contactFor(ghl: GhlClient, pi: Stripe.PaymentIntent) {
  const m = pi.metadata || {};
  if (m.ghlContactId) return m.ghlContactId;
  const email = m.email || pi.receipt_email || '';
  if (email) {
    const found = await ghl.findContactByEmail(email);
    if (found) return found;
  }
  return ghl.upsertContact({
    email: email || undefined, phone: m.phone, contactName: m.contactName, businessName: m.businessName,
    address: m.address, city: m.city, state: m.state, zip: m.zip,
  });
}

function receiptUrl(pi: Stripe.PaymentIntent) {
  const charge = pi.latest_charge;
  return charge && typeof charge === 'object' ? charge.receipt_url || '' : '';
}

const customerId = (pi: Stripe.PaymentIntent) => (typeof pi.customer === 'string' ? pi.customer : pi.customer?.id || '');

/** Applies one payment outcome to HighLevel. Shared by the webhook and the reconcile script. */
export async function applyPaymentOutcome(ghl: GhlClient, pi: Stripe.PaymentIntent, outcome: 'succeeded' | 'failed' | 'canceled') {
  const m = pi.metadata || {};
  const contactId = await contactFor(ghl, pi);
  const details = [
    line('Event', m.eventName && `${m.eventName}${m.eventDate ? ` (${m.eventDate})` : ''}`),
    line('Fee option', m.feeOptionLabel),
    line('Booth type', m.boothType),
    line('Preferred days', m.preferredDays),
    line('Stripe PaymentIntent', pi.id),
    line('Stripe customer', customerId(pi)),
  ];

  if (outcome === 'succeeded') {
    const url = receiptUrl(pi);
    await ghl.addNote(contactId, note('Vendor payment received', [
      line('Amount paid', formatUsd(pi.amount_received || pi.amount)),
      ...details,
      line('Receipt', url),
      line('Paid', pacific(new Date(((typeof pi.latest_charge === 'object' && pi.latest_charge?.created) || Date.now() / 1000) * 1000))),
    ]));
    await ghl.setVendorFields(contactId, {
      paymentStatus: 'Paid', amount: formatUsd(pi.amount_received || pi.amount),
      stripePaymentIntentId: pi.id, stripeCustomerId: customerId(pi), receiptUrl: url,
    });
    await ghl.addTags(contactId, [GHL_TAGS.paymentCompleted, m.tagSlug ? campaignTag(m.tagSlug) : '']);
    await ghl.removeTags(contactId, [GHL_TAGS.paymentPending, GHL_TAGS.paymentFailed, GHL_TAGS.paymentCanceled]);
  } else if (outcome === 'failed') {
    const err = pi.last_payment_error;
    await ghl.addNote(contactId, note('Vendor payment failed', [
      line('Amount', formatUsd(pi.amount)),
      line('Reason', err?.message || 'Not given'),
      line('Code', err?.decline_code || err?.code),
      ...details,
      'The vendor can try again from the payment page. Payment is still pending.',
    ]));
    await ghl.setVendorFields(contactId, { paymentStatus: 'Payment failed', stripePaymentIntentId: pi.id });
    await ghl.addTags(contactId, [GHL_TAGS.paymentFailed]);
  } else {
    await ghl.addNote(contactId, note('Vendor payment canceled', [
      line('Amount', formatUsd(pi.amount)),
      line('Reason', pi.cancellation_reason || 'Not given'),
      ...details,
    ]));
    await ghl.setVendorFields(contactId, { paymentStatus: 'Canceled', stripePaymentIntentId: pi.id });
    await ghl.addTags(contactId, [GHL_TAGS.paymentCanceled]);
    await ghl.removeTags(contactId, [GHL_TAGS.paymentPending]);
  }
  return contactId;
}

export type HandleResult =
  | { status: 'processed'; contactId: string; paymentIntent: string }
  | { status: 'duplicate'; paymentIntent: string }
  | { status: 'ignored'; reason: string };

/**
 * Handles one verified Stripe event. Throws on any HighLevel or Stripe API failure, so the
 * webhook answers 500 and Stripe retries the event.
 */
export async function handleStripeEvent(deps: { ghl: GhlClient; stripe: StripeLike; log?: Logger }, event: Stripe.Event): Promise<HandleResult> {
  const log = deps.log || console;
  if (!(HANDLED_EVENTS as readonly string[]).includes(event.type)) return { status: 'ignored', reason: `event ${event.type}` };
  const sent = event.data.object as Stripe.PaymentIntent;
  if (sent.metadata?.source !== 'weaverville-vendors') return { status: 'ignored', reason: 'not a vendor payment' };

  // Re-read the PaymentIntent: current metadata (processed events) and the receipt URL.
  const pi = await deps.stripe.paymentIntents.retrieve(sent.id, { expand: ['latest_charge'] });
  if (processedIds(pi).includes(event.id)) {
    log.log('[vendor-sync] Duplicate event skipped', { eventId: event.id, type: event.type, paymentIntent: pi.id });
    return { status: 'duplicate', paymentIntent: pi.id };
  }

  const outcome = ({ 'payment_intent.succeeded': 'succeeded', 'payment_intent.payment_failed': 'failed', 'payment_intent.canceled': 'canceled' } as const)[event.type as HandledEvent];
  const contactId = await applyPaymentOutcome(deps.ghl, pi, outcome);
  await markProcessed(deps.stripe, pi, event.id, log);
  log.log('[vendor-sync] Payment synced to HighLevel', { eventId: event.id, type: event.type, paymentIntent: pi.id, contactId, outcome });
  return { status: 'processed', contactId, paymentIntent: pi.id };
}
