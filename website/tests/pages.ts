/** One page of every template the site has. */
export const TEMPLATES = [
  { name: 'landing', path: '/' },
  { name: 'mdx-page', path: '/docs/introduction/' },
  { name: 'repository-doc', path: '/docs/guides/overlays/' },
  { name: 'guide-with-notes', path: '/docs/guides/servers/' },
  { name: 'config-reference', path: '/docs/reference/config/' },
  { name: 'cli-reference', path: '/docs/reference/cli/' },
  { name: 'api-reference', path: '/docs/reference/api/' },
  { name: 'diagnostics', path: '/docs/reference/diagnostics/' },
  { name: 'measured', path: '/docs/concepts/tree-shaking/' },
  { name: 'examples', path: '/examples/' },
  { name: 'example', path: '/examples/react-query/' },
  { name: 'changelog', path: '/changelog/' },
  { name: 'playground', path: '/playground/' },
  { name: 'not-found', path: '/this-page-does-not-exist/' },
] as const;

export const THEMES = ['light', 'dark'] as const;
