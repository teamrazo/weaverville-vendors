import { NextResponse } from 'next/server';
import { GHL_TAGS, upsertGhlContact } from '../../lib/ghl';

export async function POST(req: Request) {
  try {
    const text = await req.text();
    if (!text) {
      return NextResponse.json({ success: false, error: 'Empty request body' }, { status: 400 });
    }

    const body = JSON.parse(text);

    if (!body.email || !body.contactName) {
      return NextResponse.json(
        { success: false, error: 'Name and email are required.' },
        { status: 400 }
      );
    }

    const ghl = await upsertGhlContact(
      {
        email: body.email,
        phone: body.phone,
        contactName: body.contactName,
        businessName: body.businessName,
        address: body.address,
        city: body.city,
        state: body.state,
        zip: body.zip,
      },
      [
        GHL_TAGS.submitted,
        GHL_TAGS.paymentPending,
        `campaign - ${body.tagSlug || 'witches-brigade-2026'} - vendor`,
      ]
    );

    // A HighLevel outage should not block the vendor from paying.
    // The Stripe webhook retries the sync after payment.
    return NextResponse.json({
      success: true,
      ghlSynced: ghl.ok,
      ghlContactId: ghl.ok ? ghl.contactId : null,
    });
  } catch (err: any) {
    console.error('Error in /api/submit:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
