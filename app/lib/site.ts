import { EVENTS, DEFAULT_EVENT_KEY, formatFee } from './events';

// Shared copy and identifiers for metadata, share cards, structured data,
// and llms.txt. Keep facts here in step with app/lib/events.ts.

export const SITE_URL = 'https://vendors.weavervilleca.org';
export const CHAMBER_URL = 'https://weavervilleca.org';
export const CHAMBER_NAME = 'Weaverville Chamber of Commerce';

export const FEATURED_EVENT = EVENTS[DEFAULT_EVENT_KEY];

export const SHARE_TITLE = `Be a Vendor at ${FEATURED_EVENT.name}`;
export const SHARE_SUBTITLE =
  'Bring your booth to historic downtown Weaverville. Apply online in minutes.';

export const SITE_TITLE = `Vendor Applications: ${FEATURED_EVENT.name} | ${CHAMBER_NAME}`;
export const SITE_DESCRIPTION =
  `Apply to be a vendor at ${FEATURED_EVENT.name} in Weaverville, CA. ` +
  `Indoor and outdoor booth space for local makers, crafters, food vendors, and businesses. ` +
  `${formatFee(FEATURED_EVENT.feeCents)} application fee. Apply and pay online.`;

export const CONTACT = {
  name: 'Magdalena Elorriaga',
  telephone: '+1-909-963-6137',
  postOfficeBox: 'P.O. Box 487',
  locality: 'Weaverville',
  region: 'CA',
  postalCode: '96093',
};
