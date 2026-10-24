/**
 * robots.txt: everything may be crawled, and the sitemap (written by Starlight when the site's
 * URL is known) is announced. Crawlers only read it at the root of a host, so it takes effect
 * once the site has a domain of its own.
 */
import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) => {
  const base = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
  const lines = ['User-agent: *', 'Allow: /'];
  if (site !== undefined) lines.push(`Sitemap: ${new URL(`${base}sitemap-index.xml`, site).href}`);
  return new Response(`${lines.join('\n')}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
