/** Routes of the dashboard (hash based). Pure functions, usable outside the browser. */
export type Route =
  | { readonly page: 'overview' }
  | { readonly page: 'operations'; readonly key?: string }
  | { readonly page: 'models'; readonly id?: string }
  | { readonly page: 'graph'; readonly key?: string }
  | { readonly page: 'usage' }
  | { readonly page: 'generate' };

export function parseRoute(hash: string): Route {
  const [page = '', ...rest] = hash.replace(/^#\/?/, '').split('/');
  const param = rest.length === 0 ? undefined : decodeURIComponent(rest.join('/'));
  switch (page) {
    case 'operations':
      return param === undefined ? { page } : { page, key: param };
    case 'models':
      return param === undefined ? { page } : { page, id: param };
    case 'graph':
      return param === undefined ? { page } : { page, key: param };
    case 'usage':
    case 'generate':
      return { page };
    default:
      return { page: 'overview' };
  }
}

export function href(route: Route): string {
  switch (route.page) {
    case 'overview':
      return '#/';
    case 'operations':
      return route.key === undefined
        ? '#/operations'
        : `#/operations/${encodeURIComponent(route.key)}`;
    case 'models':
      return route.id === undefined ? '#/models' : `#/models/${encodeURIComponent(route.id)}`;
    case 'graph':
      return route.key === undefined ? '#/graph' : `#/graph/${encodeURIComponent(route.key)}`;
    default:
      return `#/${route.page}`;
  }
}
