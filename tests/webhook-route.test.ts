import { test } from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';
import { POST } from '../app/api/stripe-webhook/route';

const SECRET = 'whsec_test_secret';
const stripe = new Stripe('sk_test_dummy');

function signedRequest(payload: object, secret = SECRET) {
  const body = JSON.stringify(payload);
  const header = stripe.webhooks.generateTestHeaderString({ payload: body, secret });
  return new Request('https://vendors.weavervilleca.org/api/stripe-webhook', { method: 'POST', headers: { 'stripe-signature': header }, body });
}

function withEnv(env: Record<string, string | undefined>, fn: () => Promise<void>) {
  return async () => {
    const saved = { ...process.env };
    Object.assign(process.env, env);
    for (const [k, v] of Object.entries(env)) if (v === undefined) delete process.env[k];
    try { await fn(); } finally { process.env = saved; }
  };
}

const configured = { STRIPE_SECRET_KEY: 'sk_test_dummy', STRIPE_WEBHOOK_SECRET: SECRET, GHL_WCOC_API_KEY: 'test', GHL_API_KEY: undefined };

test('missing STRIPE_WEBHOOK_SECRET answers 500 "Webhook not configured" (the live symptom)', withEnv({ ...configured, STRIPE_WEBHOOK_SECRET: undefined }, async () => {
  const res = await POST(signedRequest({ id: 'evt', type: 'payment_intent.succeeded', data: { object: {} } }));
  assert.equal(res.status, 500);
  assert.deepEqual(await res.json(), { error: 'Webhook not configured' });
}));

test('a bad signature answers 400', withEnv(configured, async () => {
  const res = await POST(signedRequest({ id: 'evt', type: 'payment_intent.succeeded', data: { object: {} } }, 'whsec_wrong'));
  assert.equal(res.status, 400);
}));

test('a valid signature on an unhandled event answers 200 and ignores it', withEnv(configured, async () => {
  const res = await POST(signedRequest({ id: 'evt_x', object: 'event', type: 'charge.refunded', data: { object: { id: 'ch_1', object: 'charge', metadata: {} } } }));
  assert.equal(res.status, 200);
  assert.equal((await res.json()).status, 'ignored');
}));
