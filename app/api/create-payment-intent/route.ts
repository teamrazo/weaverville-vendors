import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { EVENTS, resolveFee } from '../../lib/events';
import { assertSameOrigin, clean, isEmail, readJsonBody, RequestError } from '../../lib/request';

// Stripe metadata values are capped at 500 characters.
const meta = (v: unknown) => (typeof v === 'string' ? v.slice(0, 500) : '');

// A PaymentIntent in these states can still have its amount and details changed.
const REUSABLE: Stripe.PaymentIntent.Status[] = ['requires_payment_method', 'requires_confirmation', 'requires_action'];

/**
 * Creates the vendor's PaymentIntent, or updates the one already started for this
 * application. Refreshing the payment page or switching the day option keeps a single
 * PaymentIntent and a single Stripe customer per application.
 */
export async function POST(req: Request) {
  try {
    const secretKey = process.env.STRIPE_SECRET_KEY || '';
    if (!secretKey) {
      return NextResponse.json({ error: 'Payment system not configured.' }, { status: 500 });
    }

    assertSameOrigin(req);
    const body = await readJsonBody(req);

    const email = clean(body.email, 254).toLowerCase();
    const contactName = clean(body.contactName, 120);
    const businessName = clean(body.businessName, 160);
    const phone = clean(body.phone, 40);
    const address = clean(body.address, 200);
    const city = clean(body.city, 80);
    const state = clean(body.state, 40);
    const zip = clean(body.zip, 20);
    const boothType = clean(body.boothType, 120);
    const preferredDays = clean(body.preferredDays, 120);
    const ghlContactId = clean(body.ghlContactId, 64);
    const eventKey = clean(body.eventKey, 60);
    const feeOption = clean(body.feeOption, 40);
    const existingId = clean(body.paymentIntentId, 80);

    // Refuse to take money without contact details.
    if (!email || !contactName || !isEmail(email)) {
      console.error('[stripe] create-payment-intent called without valid contact details');
      return NextResponse.json(
        { error: 'Your application details were not found. Please submit the application form again.' },
        { status: 400 }
      );
    }

    // Price, name, date, and tag come from the server's event list, never from the browser.
    const event = EVENTS[eventKey];
    const fee = resolveFee(eventKey, feeOption);
    if (!event || !fee) {
      return NextResponse.json(
        { error: 'Please choose your event and how many days you will attend.' },
        { status: 400 }
      );
    }

    const stripe = new Stripe(secretKey);
    const optionLabel = fee.option?.label || '';
    const description = `Weaverville Chamber of Commerce - ${event.name} Vendor ${optionLabel ? `Registration (${optionLabel})` : 'Application Fee'}`;
    const metadata: Stripe.MetadataParam = {
      source: 'weaverville-vendors',
      item: 'WCoC Event Vendor Fee',
      eventKey: meta(eventKey),
      eventName: meta(event.name),
      eventDate: meta(event.date),
      feeOption: meta(fee.option?.id || ''),
      feeOptionLabel: meta(optionLabel),
      preferredDays: meta(fee.option?.asksDays ? preferredDays : ''),
      tagSlug: meta(event.tagSlug),
      boothType: meta(boothType),
      businessName: meta(businessName),
      contactName: meta(contactName),
      phone: meta(phone),
      email: meta(email),
      address: meta(address),
      city: meta(city),
      state: meta(state),
      zip: meta(zip),
      ghlContactId: meta(ghlContactId),
    };

    // Reuse the PaymentIntent already started for this application, if it is still open
    // and belongs to the same vendor.
    if (existingId.startsWith('pi_')) {
      try {
        const existing = await stripe.paymentIntents.retrieve(existingId);
        if (existing.metadata?.source === 'weaverville-vendors' && existing.metadata?.email === email) {
          if (existing.status === 'succeeded' || existing.status === 'processing') {
            return NextResponse.json({ alreadyPaid: true, status: existing.status, paymentIntentId: existing.id });
          }
          if (REUSABLE.includes(existing.status)) {
            const updated = await stripe.paymentIntents.update(existing.id, {
              amount: fee.feeCents,
              description,
              receipt_email: email,
              metadata,
            });
            return NextResponse.json({
              clientSecret: updated.client_secret,
              paymentIntentId: updated.id,
              amountCents: updated.amount,
            });
          }
        }
      } catch (err: any) {
        // Unknown or foreign id: fall through and start a new one.
        console.warn('[stripe] could not reuse PaymentIntent', { code: err?.code });
      }
    }

    const customer = await stripe.customers.create({
      email,
      name: contactName,
      phone: phone || undefined,
      address: address
        ? { line1: address, city: city || undefined, state: state || undefined, postal_code: zip || undefined, country: 'US' }
        : undefined,
      description: businessName ? `Vendor: ${businessName}` : undefined,
      metadata: { source: 'weaverville-vendors', businessName: meta(businessName) },
    });

    const paymentIntent = await stripe.paymentIntents.create({
      amount: fee.feeCents,
      currency: 'usd',
      customer: customer.id,
      description,
      receipt_email: email,
      automatic_payment_methods: { enabled: true },
      metadata,
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amountCents: paymentIntent.amount,
    });
  } catch (err: any) {
    if (err instanceof RequestError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    // Full detail stays in the server logs. Vendors never see key or configuration errors.
    console.error('Error in /api/create-payment-intent:', {
      type: err?.type,
      code: err?.code,
      statusCode: err?.statusCode,
      message: err?.message,
    });
    return NextResponse.json(
      {
        error:
          'Online payment is temporarily unavailable. Your application was received. Please try again later or contact the Chamber.',
      },
      { status: 500 }
    );
  }
}
