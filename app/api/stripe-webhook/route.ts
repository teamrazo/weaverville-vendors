import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { GhlClient, GhlError, ghlConfigFromEnv } from '../../lib/ghl';
import { handleStripeEvent } from '../../lib/vendor-sync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Stripe webhook: https://vendors.weavervilleca.org/api/stripe-webhook
 * Events: payment_intent.succeeded, payment_intent.payment_failed, payment_intent.canceled
 *
 * Stripe is the source of truth for payment status. This keeps HighLevel in step even if the
 * vendor never returns to the confirmation page.
 *   400  bad signature (Stripe will not retry; check STRIPE_WEBHOOK_SECRET)
 *   500  configuration or HighLevel/Stripe API failure (Stripe retries for up to 3 days)
 *   200  processed, duplicate, or not a vendor event
 */
export async function POST(req: Request) {
  const secretKey = process.env.STRIPE_SECRET_KEY || '';
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
  const ghl = new GhlClient(ghlConfigFromEnv());

  const missing = [!secretKey && 'STRIPE_SECRET_KEY', !webhookSecret && 'STRIPE_WEBHOOK_SECRET', !ghl.configured && 'GHL_WCOC_API_KEY'].filter(Boolean);
  if (missing.length) {
    console.error('[stripe-webhook] Not configured. Missing env vars:', missing.join(', '));
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  const stripe = new Stripe(secretKey);
  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, req.headers.get('stripe-signature') || '', webhookSecret);
  } catch (err: any) {
    console.error('[stripe-webhook] Signature verification failed. Is STRIPE_WEBHOOK_SECRET the signing secret of this endpoint?', err?.message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    const result = await handleStripeEvent({ ghl, stripe }, event);
    if (result.status === 'ignored') console.log('[stripe-webhook] Ignored', { eventId: event.id, type: event.type, reason: result.reason });
    return NextResponse.json({ received: true, ...result });
  } catch (err: any) {
    const detail = err instanceof GhlError
      ? { op: err.op, status: err.status, body: err.body }
      : { message: err?.message, type: err?.type, code: err?.code };
    console.error('[stripe-webhook] Sync failed; Stripe will retry', { eventId: event.id, type: event.type, ...detail });
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}
