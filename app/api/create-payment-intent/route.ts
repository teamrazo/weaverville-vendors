import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { EVENTS } from '../../lib/events';
import { assertSameOrigin, clean, isEmail, readJsonBody, RequestError } from '../../lib/request';

// Stripe metadata values are capped at 500 characters.
const meta = (v: unknown) => (typeof v === 'string' ? v.slice(0, 500) : '');

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
    const ghlContactId = clean(body.ghlContactId, 64);
    const eventKey = clean(body.eventKey, 60);

    // Refuse to take money without contact details. This is the gap that
    // let earlier orders through with no name or email attached.
    if (!email || !contactName || !isEmail(email)) {
      console.error('[stripe] create-payment-intent called without valid contact details');
      return NextResponse.json(
        { error: 'Your application details were not found. Please submit the application form again.' },
        { status: 400 }
      );
    }

    // Price, name, date, and tag come from the server's event list,
    // never from the browser.
    const event = EVENTS[eventKey];
    if (!event) {
      return NextResponse.json(
        { error: 'This event is no longer available. Please submit the application form again.' },
        { status: 400 }
      );
    }
    const { name: eventName, date: eventDate, tagSlug } = event;

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

    const description = `Weaverville Chamber of Commerce - ${eventName} Vendor Application Fee`;

    const paymentIntent = await stripe.paymentIntents.create({
      amount: event.feeCents,
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
    if (err instanceof RequestError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('Error in /api/create-payment-intent:', err);
    return NextResponse.json(
      { error: 'Unable to start payment. Please try again.' },
      { status: 500 }
    );
  }
}
