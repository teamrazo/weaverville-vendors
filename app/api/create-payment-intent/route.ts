import { NextResponse } from 'next/server';
import Stripe from 'stripe';

// Stripe metadata values are capped at 500 characters.
const meta = (v: unknown) => (typeof v === 'string' ? v.slice(0, 500) : '');

export async function POST(req: Request) {
  try {
    const secretKey = process.env.STRIPE_SECRET_KEY || '';
    if (!secretKey) {
      return NextResponse.json({ error: 'Payment system not configured.' }, { status: 500 });
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const {
      email,
      contactName,
      businessName,
      phone,
      address,
      city,
      state,
      zip,
      eventKey,
      eventName,
      eventDate,
      tagSlug,
      boothType,
      ghlContactId,
    } = body;

    // Refuse to take money without contact details. This is the gap that
    // let earlier orders through with no name or email attached.
    if (!email || !contactName) {
      console.error('[stripe] create-payment-intent called without contact details');
      return NextResponse.json(
        { error: 'Your application details were not found. Please submit the application form again.' },
        { status: 400 }
      );
    }

    const stripe = new Stripe(secretKey);

    const customer = await stripe.customers.create({
      email,
      name: contactName,
      phone: phone || undefined,
      address: address
        ? {
            line1: address,
            city: city || undefined,
            state: state || undefined,
            postal_code: zip || undefined,
            country: 'US',
          }
        : undefined,
      description: businessName ? `Vendor: ${businessName}` : undefined,
      metadata: {
        source: 'weaverville-vendors',
        businessName: meta(businessName),
      },
    });

    const description = eventName
      ? `Weaverville Chamber of Commerce - ${eventName} Vendor Application Fee`
      : 'Weaverville Chamber of Commerce - Event Vendor Application Fee';

    const paymentIntent = await stripe.paymentIntents.create({
      amount: 2000,
      currency: 'usd',
      customer: customer.id,
      description,
      receipt_email: email,
      automatic_payment_methods: { enabled: true },
      metadata: {
        source: 'weaverville-vendors',
        item: 'WCoC Event Vendor Fee',
        eventKey: meta(eventKey),
        eventName: meta(eventName),
        eventDate: meta(eventDate),
        tagSlug: meta(tagSlug),
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
      },
    });

    return NextResponse.json({ clientSecret: paymentIntent.client_secret });
  } catch (err: any) {
    console.error('Error in /api/create-payment-intent:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to create payment intent' },
      { status: 500 }
    );
  }
}
