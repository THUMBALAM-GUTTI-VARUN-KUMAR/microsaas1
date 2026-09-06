import type { APIRoute } from 'astro';

export const prerender = false;

// All supported language codes and their prefixes
const LANG_CODES = ['es', 'ja', 'fr', 'de', 'pt', 'ko', 'it'];
const BASE_URL = 'https://mediasavee.com';

// All static routes with SEO metadata
const ROUTES: Record<string, { changefreq: string; priority: string }> = {
  '/': { changefreq: 'daily', priority: '1.0' },
  '/video-downloader': { changefreq: 'weekly', priority: '0.9' },
  '/image-downloader': { changefreq: 'weekly', priority: '0.9' },
  '/gif-downloader': { changefreq: 'weekly', priority: '0.8' },
  '/audio-extractor': { changefreq: 'weekly', priority: '0.8' },
  '/pricing': { changefreq: 'weekly', priority: '0.8' },
  '/about': { changefreq: 'monthly', priority: '0.6' },
  '/contact': { changefreq: 'monthly', priority: '0.5' },
  '/legal/terms': { changefreq: 'monthly', priority: '0.4' },
  '/legal/privacy': { changefreq: 'monthly', priority: '0.4' },
};

function buildAlternates(route: string): string {
  const enHref = `${BASE_URL}${route}`;
  const lines: string[] = [
    `    <xhtml:link rel="alternate" hreflang="x-default" href="${enHref}"/>`,
    `    <xhtml:link rel="alternate" hreflang="en" href="${enHref}"/>`,
  ];
  for (const lang of LANG_CODES) {
    const path = `/${lang}${route === '/' ? '' : route}`;
    lines.push(`    <xhtml:link rel="alternate" hreflang="${lang}" href="${BASE_URL}${path}"/>`);
  }
  return lines.join('\n');
}

function buildEntry(loc: string, route: string, lastmod: string): string {
  const { changefreq, priority } = ROUTES[route] ?? { changefreq: 'monthly', priority: '0.5' };
  return [
    '  <url>',
    `    <loc>${loc}</loc>`,
    `    <lastmod>${lastmod}</lastmod>`,
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    buildAlternates(route),
    '  </url>',
  ].join('\n');
}

export const GET: APIRoute = () => {
  const today = new Date().toISOString().split('T')[0];
  const entries: string[] = [];

  for (const route of Object.keys(ROUTES)) {
    // English default (no prefix)
    entries.push(buildEntry(`${BASE_URL}${route}`, route, today));

    // Localized variants
    for (const lang of LANG_CODES) {
      const localPath = `/${lang}${route === '/' ? '' : route}`;
      entries.push(buildEntry(`${BASE_URL}${localPath}`, route, today));
    }
  }

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset',
    '  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    '  xmlns:xhtml="http://www.w3.org/1999/xhtml"',
    '>',
    entries.join('\n'),
    '</urlset>',
  ].join('\n');

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      'X-Robots-Tag': 'noindex',
    },
  });
};
