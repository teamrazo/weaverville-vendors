import { NextResponse } from 'next/server';
import Stripe from 'stripe';

export async function POST(req: Request) {
  try {
    const secretKey = process.env.STRIPE_SECRET_KEY || '';

    if (!secretKey) {
      return NextResponse.json(
        { error: 'Payment system not configured.' },
        { status: 500 }
      );
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const { email, contactName, businessName, eventName, phone } = body;

    const stripe = new Stripe(secretKey);

    const description = eventName
      ? `Weaverville Chamber of Commerce - ${eventName} Vendor Application Fee`
      : 'Weaverville Chamber of Commerce - Event Vendor Application Fee';

    const paymentIntent = await stripe.paymentIntents.create({
      amount: 2000,
      currency: 'usd',
      description,
      receipt_email: email || undefined,
      automatic_payment_methods: { enabled: true },
      metadata: {
        source: 'weaverville-vendors',
        item: 'WCoC Event Vendor Fee',
        eventName: eventName || '',
        businessName: businessName || '',
        contactName: contactName || '',
        phone: phone || '',
        email: email || '',
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
