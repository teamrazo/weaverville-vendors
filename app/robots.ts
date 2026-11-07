import type { MetadataRoute } from 'next';
import { SITE_URL } from './lib/site';

// Search engines and AI crawlers may read the public page and llms.txt.
// The payment and confirmation steps and the API stay out of indexes.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/', '/payment', '/confirmation'] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
