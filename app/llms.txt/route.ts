import { EVENTS, formatFee } from '../lib/events';
import { CHAMBER_NAME, CHAMBER_URL, CONTACT, SITE_URL } from '../lib/site';

// Plain-text summary for LLMs and AI search (llmstxt.org format).
// Built from app/lib/events.ts so events and fees stay current.
export const dynamic = 'force-static';

export function GET() {
  const events = Object.values(EVENTS)
    .map(
      (ev) =>
        `### ${ev.name}\n- Date: ${ev.date}\n- Time: ${ev.time}\n- Vendor application fee: ${formatFee(ev.feeCents)}\n- Booth options: ${ev.booths.join('; ')}`
    )
    .join('\n\n');

  const body = `# ${CHAMBER_NAME} Event Vendor Portal

> Official vendor application site for events run by the ${CHAMBER_NAME} in historic downtown Weaverville, Trinity County, California. Local makers, crafters, food vendors, and businesses apply and pay the application fee online.

## How to apply
1. Go to ${SITE_URL} and choose an event.
2. Enter business and contact details, describe your products or services, and pick a booth option.
3. Accept the vendor agreement and liability disclaimer and sign electronically.
4. Pay the application fee securely by card through Stripe.
5. The Chamber Board reviews applications within 3 to 5 business days. Approved vendors receive an email with arrival, setup, and booth details.

Submitting an application does not guarantee acceptance or a specific booth location.

## Events open for vendor applications
${events}

## Contact
- Vendor contact: ${CONTACT.name}, ${CONTACT.telephone}
- Mail: ${CONTACT.postOfficeBox}, ${CONTACT.locality}, ${CONTACT.region} ${CONTACT.postalCode}
- Chamber website: ${CHAMBER_URL}

## Links
- [Vendor application](${SITE_URL}/): apply and pay online
- [${CHAMBER_NAME}](${CHAMBER_URL}): events, members, and visitor information
`;

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
}
