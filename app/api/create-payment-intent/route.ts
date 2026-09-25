import { NextResponse } from 'next/server';
import Stripe from 'stripe';

export async function POST() {
  try {
    const secretKey = process.env.STRIPE_SECRET_KEY || '';

    if (!secretKey) {
      return NextResponse.json(
        { error: 'Payment system not configured.' },
        { status: 500 }
      );
    }

    const stripe = new Stripe(secretKey);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: 2000,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      metadata: {
        source: 'weaverville-vendors',
        item: 'WCoC Event Vendor Fee',
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
