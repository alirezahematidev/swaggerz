/**
 * Starlight route middleware: adds the headings of generated reference pages and of
 * "What's generated" sections to "On this page".
 */
import { defineRouteMiddleware } from '@astrojs/starlight/route-data';
import { headingsFor, type Heading } from './reference/headings.ts';

export const onRequest = defineRouteMiddleware((context) => {
  const route = context.locals.starlightRoute;
  const extra: Heading[] = [...headingsFor(route.entry.id)];
  if (route.entry.data.twin !== undefined) {
    extra.push({ depth: 2, slug: 'whats-generated', text: "What's generated" });
  }
  if (extra.length === 0) return;
  route.toc ??= {
    minHeadingLevel: 2,
    maxHeadingLevel: 3,
    items: [{ depth: 2, slug: '_top', text: 'Overview', children: [] }],
  };
  const items = route.toc.items;
  for (const heading of extra) {
    const parent = items.at(-1);
    if (heading.depth === 3 && parent !== undefined && parent.slug !== '_top') {
      parent.children.push({ ...heading, children: [] });
    } else {
      items.push({ ...heading, children: [] });
    }
  }
});
