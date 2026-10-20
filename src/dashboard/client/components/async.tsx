import type { ReactNode } from 'react';
import type { Resource } from '../api.ts';
import { ErrorState, Loading } from './ui/states.tsx';

/**
 * Renders loading and error states around a resource. While a newer request is in flight the
 * previous data stays rendered, so the layout does not jump.
 */
export function Async<T>({
  resource,
  children,
  loading,
  error,
}: {
  resource: Resource<T>;
  children: (data: T) => ReactNode;
  loading?: ReactNode;
  /** Replaces the default error message (return `undefined` to keep it). */
  error?: (error: Error) => ReactNode;
}) {
  if (resource.state === 'loading') return <>{loading ?? <Loading />}</>;
  if (resource.state === 'error')
    return <>{error?.(resource.error) ?? <ErrorState error={resource.error} />}</>;
  return <>{children(resource.data)}</>;
}
