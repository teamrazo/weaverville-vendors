import { NextResponse } from 'next/server';
import Stripe from 'stripe';

export const dynamic = 'force-dynamic';

/**
 * Status of a vendor payment for the confirmation page. Returns only what the
 * page shows: status, amount, event, and option. Never contact details.
 */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get('id') || '';
  const secretKey = process.env.STRIPE_SECRET_KEY || '';
  if (!secretKey || !/^pi_[A-Za-z0-9]{8,80}$/.test(id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  try {
    const pi = await new Stripe(secretKey).paymentIntents.retrieve(id);
    if (pi.metadata?.source !== 'weaverville-vendors') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({
      status: pi.status,
      amountCents: pi.amount,
      eventName: pi.metadata.eventName || '',
      optionLabel: pi.metadata.feeOptionLabel || '',
      boothType: pi.metadata.boothType || '',
    });
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}
