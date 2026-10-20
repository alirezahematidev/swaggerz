import { useEffect, useState } from 'react';
import { href, parseRoute, type Route } from './routes.ts';

export { href, parseRoute, type Route } from './routes.ts';

/** The current route. Each section scrolls in its own area, which starts at the top. */
export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(location.hash));
  useEffect(() => {
    const onChange = (): void => {
      setRoute(parseRoute(location.hash));
    };
    addEventListener('hashchange', onChange);
    return () => {
      removeEventListener('hashchange', onChange);
    };
  }, []);
  return route;
}

/** Navigates to a route (hash-based, so the browser history works as expected). */
export function navigate(route: Route): void {
  location.hash = href(route);
}
