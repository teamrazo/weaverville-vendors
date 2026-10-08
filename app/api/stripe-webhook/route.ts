import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { GHL_TAGS, updateGhlTags, upsertGhlContact } from '../../lib/ghl';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Stripe calls this after a vendor pays. It is the source of truth for
// "paid" in HighLevel, so the sync happens even if the browser never
// returns to the confirmation page.
export async function POST(req: Request) {
  const secretKey = process.env.STRIPE_SECRET_KEY || '';
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

  if (!secretKey || !webhookSecret) {
    console.error('[stripe-webhook] STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET is not set');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  const stripe = new Stripe(secretKey);
  const signature = req.headers.get('stripe-signature') || '';
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err: any) {
    console.error('[stripe-webhook] Signature verification failed', err?.message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  if (event.type !== 'payment_intent.succeeded') {
    return NextResponse.json({ received: true, ignored: event.type });
  }

  const pi = event.data.object as Stripe.PaymentIntent;
  const m = pi.metadata || {};

  if (m.source !== 'weaverville-vendors') {
    return NextResponse.json({ received: true, ignored: 'other source' });
  }

  const email = m.email || pi.receipt_email || '';
  if (!email) {
    console.error('[stripe-webhook] Paid vendor fee with no email on record', { paymentIntent: pi.id });
    return NextResponse.json({ received: true, warning: 'no email' });
  }

  const ghl = await upsertGhlContact({
    email,
    phone: m.phone,
    contactName: m.contactName,
    businessName: m.businessName,
    address: m.address,
    city: m.city,
    state: m.state,
    zip: m.zip,
  });

  const contactId = (ghl.ok && ghl.contactId) || m.ghlContactId || '';
  if (!contactId) {
    console.error('[stripe-webhook] Could not resolve HighLevel contact', { paymentIntent: pi.id, email });
    // Ask Stripe to retry later.
    return NextResponse.json({ error: 'HighLevel sync failed' }, { status: 500 });
  }

  await updateGhlTags(
    contactId,
    [GHL_TAGS.submitted, GHL_TAGS.paid, m.tagSlug ? `campaign - ${m.tagSlug} - vendor` : ''].filter(Boolean),
    [GHL_TAGS.paymentPending]
  );

  console.log('[stripe-webhook] Vendor fee synced to HighLevel', { paymentIntent: pi.id, contactId });
  return NextResponse.json({ received: true });
}
