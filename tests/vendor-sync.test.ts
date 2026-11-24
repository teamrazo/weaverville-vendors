import { test } from 'node:test';
import assert from 'node:assert/strict';
import type Stripe from 'stripe';
import { GHL_TAGS, GhlError } from '../app/lib/ghl';
import { handleStripeEvent, linkStripeIds, recordApplication } from '../app/lib/vendor-sync';
import { reconcileVendors } from '../scripts/reconcile-vendors';
import { fakeGhl, indexOf, isFieldUpdate, isNote, isTagAdd, isTagRemove, silent } from './helpers';

const application = {
  contact: { email: 'vendor@example.com', contactName: 'Pat Vendor', businessName: 'Pat Crafts', phone: '530-555-0100' },
  eventName: '46th Annual Mountain Magic Christmas',
  eventDate: 'Fri Nov 27 and Sat Dec 5, 12 & 19, 2026',
  tagSlug: 'mountain-magic-2026',
  boothType: 'Indoor Hall Space',
  feeOptionLabel: '2 Days',
  preferredDays: 'Sat Dec 5 and Sat Dec 12',
  amountCents: 5000,
  businessDescription: 'Hand-poured candles',
  submittedAt: new Date('2026-11-24T20:00:00Z'),
};

const FIELDS = [
  { id: 'cf_event', name: 'Vendor Event' },
  { id: 'cf_booth', name: 'Booth Type' },
  { id: 'cf_status', name: 'Vendor Payment Status', fieldKey: 'contact.vendor_payment_status' },
];

test('submit: note and fields are written before the trigger tags', async () => {
  const { client, calls } = fakeGhl({ customFields: FIELDS });
  const r = await recordApplication(client, application);
  assert.equal(r.contactId, 'ghl_contact_1');

  const note = indexOf(calls, isNote);
  const fields = indexOf(calls, isFieldUpdate);
  const tags = indexOf(calls, isTagAdd(GHL_TAGS.submitted));
  assert.ok(note > 0 && fields > 0 && tags > 0, 'note, fields and tags all written');
  assert.ok(note < tags && fields < tags, 'details come before the trigger tag');

  const body: string = calls[note].body.body;
  for (const s of ['46th Annual Mountain Magic Christmas', 'Indoor Hall Space', '2 Days', 'Sat Dec 5 and Sat Dec 12', '$50.00', 'Hand-poured candles', 'Submitted:']) {
    assert.ok(body.includes(s), `note includes ${s}`);
  }
  assert.deepEqual(calls[tags].body.tags, [GHL_TAGS.submitted, GHL_TAGS.paymentPending, 'campaign - mountain-magic-2026 - vendor']);
  // Upsert itself carries no tags, so no workflow fires before the details exist.
  assert.equal(calls.find((c) => c.path === '/contacts/upsert')?.body.tags, undefined);
});

test('submit: only existing custom fields are filled, none are created', async () => {
  const { client, calls } = fakeGhl({ customFields: FIELDS });
  const r = await recordApplication(client, application);
  const update = calls.find(isFieldUpdate)!;
  assert.deepEqual(update.body.customFields.map((f: any) => f.id).sort(), ['cf_booth', 'cf_event', 'cf_status']);
  assert.ok(r.fieldsMissing.includes('feeOption'));
  assert.ok(!calls.some((c) => c.method === 'POST' && c.path.includes('customFields')), 'never creates custom fields');
});

test('submit: no matching custom fields means no field update call', async () => {
  const { client, calls } = fakeGhl({ customFields: [{ id: 'x', name: 'Favorite Color' }] });
  await recordApplication(client, application);
  assert.equal(calls.filter(isFieldUpdate).length, 0);
});

test('HighLevel errors are thrown with status and body, never swallowed', async () => {
  const { client } = fakeGhl({ failOn: (c) => (c.path.endsWith('/notes') ? 422 : null) });
  await assert.rejects(recordApplication(client, application), (err: any) => err instanceof GhlError && err.status === 422 && err.op === 'add-note' && err.body.includes('boom'));
});

test('Stripe ids go to a note when no Stripe custom fields exist', async () => {
  const { client, calls } = fakeGhl({ customFields: [] });
  await linkStripeIds(client, 'c1', { customerId: 'cus_1', paymentIntentId: 'pi_1' });
  const note = calls.find(isNote)!;
  assert.ok(note.body.body.includes('cus_1') && note.body.body.includes('pi_1'));
});

test('Stripe ids go to custom fields when they exist, without a note', async () => {
  const { client, calls } = fakeGhl({ customFields: [{ id: 'cf_cus', name: 'Stripe Customer ID' }, { id: 'cf_pi', name: 'Stripe Payment Intent ID' }] });
  await linkStripeIds(client, 'c1', { customerId: 'cus_1', paymentIntentId: 'pi_1' });
  assert.equal(calls.filter(isNote).length, 0);
  assert.deepEqual(calls.find(isFieldUpdate)!.body.customFields, [{ id: 'cf_cus', field_value: 'cus_1' }, { id: 'cf_pi', field_value: 'pi_1' }]);
});

// ───────── webhook ─────────

function pi(overrides: Partial<Stripe.PaymentIntent> = {}, metadata: Record<string, string> = {}): Stripe.PaymentIntent {
  return {
    id: 'pi_123', object: 'payment_intent', amount: 7500, amount_received: 7500, status: 'succeeded', customer: 'cus_9', created: 1795000000,
    receipt_email: 'vendor@example.com', cancellation_reason: null, last_payment_error: null,
    latest_charge: { id: 'ch_1', object: 'charge', receipt_url: 'https://pay.stripe.com/receipts/abc', created: 1795000100 } as any,
    metadata: { source: 'weaverville-vendors', email: 'vendor@example.com', ghlContactId: 'ghl_c', eventName: '46th Annual Mountain Magic Christmas', feeOptionLabel: 'Entire Event', boothType: 'Indoor Hall Space', tagSlug: 'mountain-magic-2026', ...metadata },
    ...overrides,
  } as unknown as Stripe.PaymentIntent;
}

function fakeStripe(current: Stripe.PaymentIntent) {
  const updates: any[] = [];
  return {
    updates,
    paymentIntents: {
      async retrieve() { return current; },
      async update(_id: string, params: any) { updates.push(params); current = { ...current, metadata: { ...current.metadata, ...params.metadata } } as any; return current; },
    },
  };
}

const evt = (type: string, id = 'evt_1', obj = pi()) => ({ id, type, data: { object: obj } } as unknown as Stripe.Event);

test('webhook succeeded: note with amount, PaymentIntent and receipt before the payment-completed tag', async () => {
  const { client, calls } = fakeGhl({ customFields: FIELDS });
  const stripe = fakeStripe(pi());
  const r = await handleStripeEvent({ ghl: client, stripe, log: silent }, evt('payment_intent.succeeded'));
  assert.equal(r.status, 'processed');
  const note = indexOf(calls, isNote);
  const tag = indexOf(calls, isTagAdd(GHL_TAGS.paymentCompleted));
  assert.ok(note >= 0 && tag > note);
  for (const s of ['$75.00', 'pi_123', 'https://pay.stripe.com/receipts/abc']) assert.ok(calls[note].body.body.includes(s));
  assert.ok(indexOf(calls, isTagRemove(GHL_TAGS.paymentPending)) > tag);
  assert.ok(!calls.some(isTagAdd(GHL_TAGS.legacyPaid)), 'legacy paid tag is not written');
  assert.ok(stripe.updates[0].metadata.ghl_synced_events.includes('evt_1'), 'event recorded on the PaymentIntent');
});

test('webhook: a repeated event id is skipped', async () => {
  const { client, calls } = fakeGhl();
  const stripe = fakeStripe(pi({}, { ghl_synced_events: 'evt_0,evt_1' }));
  const r = await handleStripeEvent({ ghl: client, stripe, log: silent }, evt('payment_intent.succeeded'));
  assert.equal(r.status, 'duplicate');
  assert.equal(calls.length, 0);
});

test('webhook: HighLevel failure throws so the route answers 500 and Stripe retries; event not marked', async () => {
  const { client } = fakeGhl({ failOn: (c) => (c.path.endsWith('/tags') ? 503 : null) });
  const stripe = fakeStripe(pi());
  await assert.rejects(handleStripeEvent({ ghl: client, stripe, log: silent }, evt('payment_intent.succeeded')), GhlError);
  assert.equal(stripe.updates.length, 0);
});

test('webhook failed: note with reason, payment-failed tag, payment-pending kept', async () => {
  const { client, calls } = fakeGhl();
  const failed = pi({ status: 'requires_payment_method', amount_received: 0, last_payment_error: { message: 'Your card was declined.', decline_code: 'insufficient_funds' } as any });
  await handleStripeEvent({ ghl: client, stripe: fakeStripe(failed), log: silent }, evt('payment_intent.payment_failed', 'evt_f', failed));
  assert.ok(calls.find(isNote)!.body.body.includes('Your card was declined.'));
  assert.ok(calls.some(isTagAdd(GHL_TAGS.paymentFailed)));
  assert.ok(!calls.some(isTagRemove(GHL_TAGS.paymentPending)));
});

test('webhook canceled: note, payment-canceled tag, payment-pending removed', async () => {
  const { client, calls } = fakeGhl();
  const canceled = pi({ status: 'canceled', cancellation_reason: 'abandoned' });
  await handleStripeEvent({ ghl: client, stripe: fakeStripe(canceled), log: silent }, evt('payment_intent.canceled', 'evt_c', canceled));
  assert.ok(calls.find(isNote)!.body.body.includes('abandoned'));
  assert.ok(calls.some(isTagAdd(GHL_TAGS.paymentCanceled)));
  assert.ok(calls.some(isTagRemove(GHL_TAGS.paymentPending)));
});

test('webhook: success clears earlier failed and canceled tags', async () => {
  const { client, calls } = fakeGhl();
  await handleStripeEvent({ ghl: client, stripe: fakeStripe(pi()), log: silent }, evt('payment_intent.succeeded'));
  const removed = calls.find((c) => c.method === 'DELETE')!.body.tags;
  assert.deepEqual(removed, [GHL_TAGS.paymentPending, GHL_TAGS.paymentFailed, GHL_TAGS.paymentCanceled]);
});

test('webhook: contact found by email when the application never reached HighLevel', async () => {
  const { client, calls } = fakeGhl({ existingContact: 'ghl_by_email' });
  const noId = pi({}, { ghlContactId: '' });
  const r = await handleStripeEvent({ ghl: client, stripe: fakeStripe(noId), log: silent }, evt('payment_intent.succeeded', 'evt_2', noId));
  assert.equal(r.status === 'processed' && r.contactId, 'ghl_by_email');
  assert.ok(calls.some((c) => c.path.startsWith('/contacts/search/duplicate')));
});

test('webhook: other sources and event types are ignored without API calls', async () => {
  const { client, calls } = fakeGhl();
  const other = pi({}, { source: 'something-else' });
  assert.equal((await handleStripeEvent({ ghl: client, stripe: fakeStripe(other), log: silent }, evt('payment_intent.succeeded', 'e', other))).status, 'ignored');
  assert.equal((await handleStripeEvent({ ghl: client, stripe: fakeStripe(pi()), log: silent }, evt('charge.refunded'))).status, 'ignored');
  assert.equal(calls.length, 0);
});

// ───────── reconcile ─────────

function searchStripe(intents: Stripe.PaymentIntent[]) {
  return {
    paymentIntents: {
      search: (async () => ({ data: intents, has_more: false, next_page: null })) as any,
      retrieve: async (id: string) => intents.find((p) => p.id === id)!,
    },
  };
}

test('reconcile dry run: flags missing paid tag and writes nothing', async () => {
  const { client, calls } = fakeGhl({ tags: [GHL_TAGS.submitted] });
  const rows = await reconcileVendors({ stripe: searchStripe([pi()]), ghl: client, log: () => {} });
  assert.equal(rows[0].status, 'missing-paid-tag');
  assert.ok(calls.every((c) => c.method === 'GET'), 'dry run only reads');
});

test('reconcile: contacts already tagged paid are ok', async () => {
  const { client } = fakeGhl({ tags: [GHL_TAGS.paymentCompleted] });
  const rows = await reconcileVendors({ stripe: searchStripe([pi()]), ghl: client, log: () => {} });
  assert.equal(rows[0].status, 'ok');
});

test('reconcile --apply: fixes flagged contacts', async () => {
  const { client, calls } = fakeGhl({ tags: [] });
  const rows = await reconcileVendors({ stripe: searchStripe([pi()]), ghl: client, log: () => {} }, { apply: true });
  assert.equal(rows[0].status, 'fixed');
  assert.ok(calls.some(isTagAdd(GHL_TAGS.paymentCompleted)));
});
