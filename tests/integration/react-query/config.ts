import type { FeaturesConfig } from '../../../src/config/types.ts';

/** React Query options used by the React Query test suites (features-3.1.yaml). */
export const REACT_QUERY_CONFIG: FeaturesConfig = {
  reactQuery: {
    infinite: { listShapes: { pageParam: 'cursor' } },
    invalidates: { createShape: ['listShapes'], deleteShape: ['Shapes'] },
  },
};

/** Consumer program type-checked against generated hooks; `__API__` is the output path. */
export const REACT_QUERY_CONSUMER = `
import { QueryClient } from '@tanstack/react-query';
import {
  getShapeQueryKey, getShapeQueryOptions, listShapesInfiniteQueryOptions, shapesKeys, useCreateShape,
  useDeleteShape, useGetShape, useGetTree, useListShapes, useListShapesInfinite, usePostEvent,
  type ListShapesPageParam,
} from '__API__/react-query/index.js';
import type { Shape, ShapePage, TreeNode } from '__API__/index.js';

export function useConsumer(queryClient: QueryClient): unknown[] {
  const shape = useGetShape({ shapeId: 's' });
  // getShape declares a 304; query data cannot be undefined, so a missing body is null.
  const data: Shape | null | undefined = shape.data;
  const kind = useGetShape({ shapeId: 's' }, { select: (s) => s?.kind, staleTime: 1000, enabled: true });
  const selected: 'circle' | 'rect' | undefined = kind.data;
  // @ts-expect-error params are required
  useGetShape();
  // @ts-expect-error select must receive the response type
  useGetShape({ shapeId: 's' }, { select: (s: number) => s });
  const tree: TreeNode | undefined = useGetTree().data;
  const list = useListShapes({ 'X-Request-ID': 'r' }, { request: { timeout: 500 } }, queryClient);
  const create = useCreateShape({ onSuccess: (created) => { const id: string = created.id; void id; } });
  create.mutate({ body: { kind: 'circle', radius: 1 } });
  // @ts-expect-error readOnly properties are not part of request bodies
  create.mutate({ body: { kind: 'circle', id: 'c', radius: 1 } });
  // @ts-expect-error the body is required
  create.mutate({});
  const remove = useDeleteShape();
  remove.mutate({ shapeId: 'x' });
  const post = usePostEvent();
  post.mutate();
  post.mutate({ body: { type: 'click', x: 1, y: 2 } });
  const pages = useListShapesInfinite(
    { 'X-Request-ID': 'r' },
    { initialPageParam: undefined, getNextPageParam: (last) => last.nextCursor },
  );
  const first: ShapePage | undefined = pages.data?.pages[0];
  const param: ListShapesPageParam = pages.data?.pageParams[0];
  const fetched: Promise<Shape | null> = queryClient.fetchQuery(getShapeQueryOptions({ shapeId: 's' }));
  const prefetched: Promise<void> = queryClient.prefetchQuery(getShapeQueryOptions({ shapeId: 's' }));
  const cached: Shape | null | undefined = queryClient.getQueryData(getShapeQueryOptions({ shapeId: 's' }).queryKey);
  const infinite = queryClient.fetchInfiniteQuery(
    listShapesInfiniteQueryOptions({ 'X-Request-ID': 'r' }, { initialPageParam: 'a', getNextPageParam: () => null }),
  );
  const key: readonly ['Shapes', 'getShape', { shapeId: string }] = getShapeQueryKey({ shapeId: 's' });
  const all: readonly ['Shapes'] = shapesKeys.all;
  void queryClient.invalidateQueries({ queryKey: shapesKeys.all });
  return [data, selected, tree, list, remove, first, param, fetched, prefetched, cached, infinite, key, all];
}
`;
