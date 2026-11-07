import { EVENTS } from '../lib/events';
import { CHAMBER_NAME, CHAMBER_URL, CONTACT, SITE_DESCRIPTION, SITE_TITLE, SITE_URL } from '../lib/site';

// JSON-LD for search engines and LLMs. Rendered on the server in the root layout.
// Event markup is left out until event dates are confirmed: Google requires a
// full startDate, and several events are listed as TBD.

const ORG_ID = `${CHAMBER_URL}/#organization`;

function buildGraph() {
  const offers = Object.values(EVENTS).map((ev) => ({
    '@type': 'Offer',
    name: `${ev.name} vendor application`,
    description: `Vendor application fee for ${ev.name} (${ev.date}). Booth options: ${ev.booths.join(', ')}.`,
    price: (ev.feeCents / 100).toFixed(2),
    priceCurrency: 'USD',
    url: SITE_URL,
    seller: { '@id': ORG_ID },
  }));

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': ['Organization', 'LocalBusiness'],
        '@id': ORG_ID,
        name: CHAMBER_NAME,
        url: CHAMBER_URL,
        foundingDate: '1909',
        telephone: CONTACT.telephone,
        address: {
          '@type': 'PostalAddress',
          postOfficeBoxNumber: CONTACT.postOfficeBox.replace('P.O. Box ', ''),
          addressLocality: CONTACT.locality,
          addressRegion: CONTACT.region,
          postalCode: CONTACT.postalCode,
          addressCountry: 'US',
        },
        areaServed: 'Trinity County, California',
        contactPoint: {
          '@type': 'ContactPoint',
          contactType: 'vendor applications',
          name: CONTACT.name,
          telephone: CONTACT.telephone,
          areaServed: 'US',
          availableLanguage: 'English',
        },
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        url: SITE_URL,
        name: `${CHAMBER_NAME} Event Vendor Portal`,
        publisher: { '@id': ORG_ID },
        inLanguage: 'en-US',
      },
      {
        '@type': 'WebPage',
        '@id': `${SITE_URL}/#webpage`,
        url: SITE_URL,
        name: SITE_TITLE,
        description: SITE_DESCRIPTION,
        isPartOf: { '@id': `${SITE_URL}/#website` },
        about: { '@id': ORG_ID },
        primaryImageOfPage: `${SITE_URL}/opengraph-image`,
        inLanguage: 'en-US',
        potentialAction: {
          '@type': 'ApplyAction',
          name: 'Apply to be an event vendor',
          target: SITE_URL,
        },
      },
      {
        '@type': 'Service',
        '@id': `${SITE_URL}/#vendor-applications`,
        name: 'Event vendor booth applications',
        serviceType: 'Event vendor booth space',
        provider: { '@id': ORG_ID },
        areaServed: 'Weaverville, CA',
        url: SITE_URL,
        offers,
      },
    ],
  };
}

export default function StructuredData() {
  // Escape "<" so no value can close the script tag.
  const json = JSON.stringify(buildGraph()).replace(/</g, '\\u003c');
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
