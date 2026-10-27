/** Facts about the project that pages and loaders share, read from the root package.json. */
import pkg from '../../package.json' with { type: 'json' };

function repositoryUrl(): string {
  const raw = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository.url;
  return raw.replace(/^git\+/, '').replace(/\.git$/, '');
}

export const PACKAGE = { name: pkg.name, version: pkg.version, description: pkg.description };

export const REPOSITORY = { url: repositoryUrl(), branch: 'main' } as const;

/** The product's page on Product Hunt, with the parameters of Product Hunt's own embed. */
export const PRODUCT_HUNT =
  'https://www.producthunt.com/products/swaggerz?embed=true&utm_source=embed&utm_medium=post_embed';
