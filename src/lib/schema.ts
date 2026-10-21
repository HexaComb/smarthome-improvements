import { site } from '../data/site';
import type { Faq } from '../data/serviceContent';

const abs = (path: string) => new URL(path, site.url).href;

export function breadcrumbSchema(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: abs(it.path),
    })),
  };
}

export function faqSchema(faqs: Faq[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}

export function serviceSchema(opts: {
  name: string;
  description: string;
  path: string;
  image?: string;
  /** Service category (e.g. "Roofing"); falls back to name. */
  serviceType?: string;
  /** Name of the free inspection/assessment offer for this service. */
  freeOffer?: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    serviceType: opts.serviceType ?? opts.name,
    name: opts.name,
    description: opts.description,
    url: abs(opts.path),
    ...(opts.image ? { image: abs(opts.image) } : {}),
    provider: { '@id': `${site.url}/#business` },
    areaServed: site.serviceCities.map((c) => ({
      '@type': 'City',
      name: `${c}, ${site.region}`,
    })),
    ...(opts.freeOffer
      ? {
          offers: {
            '@type': 'Offer',
            name: opts.freeOffer,
            price: '0',
            priceCurrency: 'USD',
            url: abs(opts.path),
            availability: 'https://schema.org/InStock',
          },
        }
      : {}),
  };
}

/** ItemList markup so AI systems understand groupings (sub-services, projects). */
export function itemListSchema(name: string, items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      url: abs(it.path),
    })),
  };
}
