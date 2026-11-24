import { NextResponse } from 'next/server';
import { GhlClient, GhlError, ghlConfigFromEnv } from '../../lib/ghl';
import { recordApplication } from '../../lib/vendor-sync';
import { EVENTS, resolveFee } from '../../lib/events';
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
    const fee = resolveFee(event.id, clean(body.feeOption, 40));
    if (!fee) {
      return NextResponse.json({ success: false, error: 'Please choose how many days you will attend.' }, { status: 400 });
    }
    const requestedBooth = clean(body.boothType, 120);
    const boothType = event.booths.includes(requestedBooth) ? requestedBooth : event.booths[0];

    // Details are written before the trigger tags, so the board alert workflow can include them.
    // A HighLevel outage does not block the vendor from paying: it is logged with the full
    // HighLevel response, and the Stripe webhook creates the contact on payment if needed.
    const ghl = new GhlClient(ghlConfigFromEnv());
    let ghlContactId: string | null = null;
    try {
      const recorded = await recordApplication(ghl, {
        contact: {
          email,
          phone: clean(body.phone, 40),
          contactName,
          businessName: clean(body.businessName, 160),
          address: clean(body.address, 200),
          city: clean(body.city, 80),
          state: clean(body.state, 40),
          zip: clean(body.zip, 20),
        },
        eventName: event.name,
        eventDate: event.date,
        tagSlug: event.tagSlug,
        boothType,
        feeOptionLabel: fee.option?.label || 'Standard fee',
        preferredDays: fee.option?.asksDays ? clean(body.preferredDays, 120) : '',
        amountCents: fee.feeCents,
        businessDescription: clean(body.description, 2000),
      });
      ghlContactId = recorded.contactId;
      console.log('[submit] Application recorded in HighLevel', { contactId: recorded.contactId, event: event.id, fieldsWritten: recorded.fieldsWritten, fieldsMissing: recorded.fieldsMissing });
    } catch (err) {
      const detail = err instanceof GhlError ? { op: err.op, status: err.status, body: err.body } : { message: (err as Error)?.message };
      console.error('[submit] HighLevel sync FAILED. Vendor continues to payment; webhook will create the contact on payment.', { email, event: event.id, ...detail });
    }

    return NextResponse.json({ success: true, ghlSynced: Boolean(ghlContactId), ghlContactId });
  } catch (err: any) {
    if (err instanceof RequestError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    console.error('Error in /api/submit:', err);
    return NextResponse.json({ success: false, error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
