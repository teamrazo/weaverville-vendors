import { NextResponse } from 'next/server';
import { GHL_TAGS, upsertGhlContact } from '../../lib/ghl';
import { EVENTS } from '../../lib/events';
import { assertSameOrigin, clean, isEmail, readJsonBody, RequestError } from '../../lib/request';

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const body = await readJsonBody(req);

    // Honeypot. Real visitors never see or fill this field.
    if (clean(body.website)) {
      return NextResponse.json({ success: true, ghlSynced: false, ghlContactId: null });
    }

    const email = clean(body.email, 254).toLowerCase();
    const contactName = clean(body.contactName, 120);
    if (!email || !contactName) {
      return NextResponse.json({ success: false, error: 'Name and email are required.' }, { status: 400 });
    }
    if (!isEmail(email)) {
      return NextResponse.json({ success: false, error: 'Please enter a valid email address.' }, { status: 400 });
    }

    // The event, and the tag written to HighLevel, come from the server's
    // own event list. A client cannot create arbitrary tags.
    const event = EVENTS[clean(body.eventKey, 60)];
    if (!event) {
      return NextResponse.json({ success: false, error: 'Please choose an event.' }, { status: 400 });
    }

    const ghl = await upsertGhlContact(
      {
        email,
        phone: clean(body.phone, 40),
        contactName,
        businessName: clean(body.businessName, 160),
        address: clean(body.address, 200),
        city: clean(body.city, 80),
        state: clean(body.state, 40),
        zip: clean(body.zip, 20),
      },
      [GHL_TAGS.submitted, GHL_TAGS.paymentPending, `campaign - ${event.tagSlug} - vendor`]
    );

    // A HighLevel outage should not block the vendor from paying.
    // The Stripe webhook retries the sync after payment.
    return NextResponse.json({
      success: true,
      ghlSynced: ghl.ok,
      ghlContactId: ghl.ok ? ghl.contactId : null,
    });
  } catch (err: any) {
    if (err instanceof RequestError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    console.error('Error in /api/submit:', err);
    return NextResponse.json({ success: false, error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
