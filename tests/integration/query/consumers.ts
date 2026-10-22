import type { FeaturesConfig } from '../../../src/config/types.ts';
import { REACT_QUERY_CONFIG } from '../react-query/config.ts';

/**
 * Consumer programs type-checked against the hooks generated for features-3.1.yaml, one per
 * TanStack Query adapter and SWR. `__API__` is the output path.
 */

const OPTIONS = REACT_QUERY_CONFIG.reactQuery as Exclude<FeaturesConfig['reactQuery'], boolean>;

export function queryFeatures(framework: 'vue' | 'svelte' | 'solid' | 'swr'): FeaturesConfig {
  return framework === 'swr' ? { swr: OPTIONS ?? true } : { query: { framework, ...OPTIONS } };
}

export const VUE_CONSUMER = `
import { computed, ref } from 'vue';
import { QueryClient } from '@tanstack/vue-query';
import {
  getShapeQueryKey, getShapeQueryOptions, listShapesInfiniteQueryOptions, shapesKeys, useCreateShape,
  useDeleteShape, useGetShape, useGetTree, useListShapes, useListShapesInfinite, usePostEvent,
  type ListShapesPageParam,
} from '__API__/vue-query/index.js';
import type { Shape, ShapePage, TreeNode } from '__API__/index.js';

export function setup(queryClient: QueryClient): unknown[] {
  const id = ref('s');
  // Parameters may be getters or refs: the query follows them.
  const shape = useGetShape(() => ({ shapeId: id.value }));
  const data: Shape | null | undefined = shape.data.value;
  const kind = useGetShape(
    { shapeId: 's' },
    { select: (s) => s?.kind, staleTime: 1000, enabled: computed(() => id.value !== '') },
  );
  const selected: 'circle' | 'rect' | undefined = kind.data.value;
  // @ts-expect-error params are required
  useGetShape();
  const tree: TreeNode | undefined = useGetTree().data.value;
  const list = useListShapes(ref({ 'X-Request-ID': 'r' }), () => ({ request: { timeout: 500 } }), queryClient);
  const create = useCreateShape({ onSuccess: (created) => { const createdId: string = created.id; void createdId; } });
  create.mutate({ body: { kind: 'circle', radius: 1 } });
  // @ts-expect-error readOnly properties are not part of request bodies
  create.mutate({ body: { kind: 'circle', id: 'c', radius: 1 } });
  const remove = useDeleteShape();
  remove.mutate({ shapeId: 'x' });
  const post = usePostEvent();
  post.mutate();
  const pages = useListShapesInfinite(
    { 'X-Request-ID': 'r' },
    { initialPageParam: undefined, getNextPageParam: (last) => last.nextCursor },
  );
  const first: ShapePage | undefined = pages.data.value?.pages[0];
  const param: ListShapesPageParam = pages.data.value?.pageParams[0];
  const fetched: Promise<Shape | null> = queryClient.fetchQuery(getShapeQueryOptions({ shapeId: 's' }));
  const cached: Shape | null | undefined = queryClient.getQueryData(getShapeQueryOptions({ shapeId: 's' }).queryKey);
  const infinite = queryClient.fetchInfiniteQuery(
    listShapesInfiniteQueryOptions({ 'X-Request-ID': 'r' }, { initialPageParam: 'a', getNextPageParam: () => null }),
  );
  const key: readonly ['Shapes', 'getShape', { shapeId: string }] = getShapeQueryKey({ shapeId: 's' });
  const all: readonly ['Shapes'] = shapesKeys.all;
  void queryClient.invalidateQueries({ queryKey: shapesKeys.all });
  return [data, selected, tree, list, remove, first, param, fetched, cached, infinite, key, all];
}
`;

/** Svelte and Solid share the accessor-based API. */
function accessorConsumer(pkg: string, directory: string): string {
  return `
import { QueryClient } from '${pkg}';
import {
  createCreateShapeMutation, createDeleteShapeMutation, createGetShapeQuery, createGetTreeQuery,
  createListShapesInfiniteQuery, createListShapesQuery, createPostEventMutation, getShapeQueryKey,
  getShapeQueryOptions, listShapesInfiniteQueryOptions, shapesKeys, type ListShapesPageParam,
} from '__API__/${directory}/index.js';
import type { Shape, ShapePage, TreeNode } from '__API__/index.js';

export function setup(queryClient: QueryClient, id: () => string): unknown[] {
  // Parameters and options are accessors, read reactively.
  const shape = createGetShapeQuery(() => ({ shapeId: id() }));
  const data: Shape | null | undefined = shape.data;
  const kind = createGetShapeQuery(() => ({ shapeId: 's' }), () => ({ select: (s) => s?.kind, staleTime: 1000 }));
  const selected: 'circle' | 'rect' | undefined = kind.data;
  // @ts-expect-error params are required
  createGetShapeQuery();
  const tree: TreeNode | undefined = createGetTreeQuery().data;
  const list = createListShapesQuery(() => ({ 'X-Request-ID': 'r' }), () => ({ request: { timeout: 500 } }), () => queryClient);
  const create = createCreateShapeMutation(() => ({
    onSuccess: (created) => { const createdId: string = created.id; void createdId; },
  }));
  create.mutate({ body: { kind: 'circle', radius: 1 } });
  // @ts-expect-error readOnly properties are not part of request bodies
  create.mutate({ body: { kind: 'circle', id: 'c', radius: 1 } });
  const remove = createDeleteShapeMutation();
  remove.mutate({ shapeId: 'x' });
  const post = createPostEventMutation();
  post.mutate();
  const pages = createListShapesInfiniteQuery(
    () => ({ 'X-Request-ID': 'r' }),
    () => ({ initialPageParam: undefined, getNextPageParam: (last) => last.nextCursor }),
  );
  const first: ShapePage | undefined = pages.data?.pages[0];
  const param: ListShapesPageParam = pages.data?.pageParams[0];
  const fetched: Promise<Shape | null> = queryClient.fetchQuery(getShapeQueryOptions({ shapeId: 's' }));
  const cached: Shape | null | undefined = queryClient.getQueryData(getShapeQueryOptions({ shapeId: 's' }).queryKey);
  const infinite = queryClient.fetchInfiniteQuery(
    listShapesInfiniteQueryOptions({ 'X-Request-ID': 'r' }, { initialPageParam: 'a', getNextPageParam: () => null }),
  );
  const key: readonly ['Shapes', 'getShape', { shapeId: string }] = getShapeQueryKey({ shapeId: 's' });
  const all: readonly ['Shapes'] = shapesKeys.all;
  void queryClient.invalidateQueries({ queryKey: shapesKeys.all });
  return [data, selected, tree, list, remove, first, param, fetched, cached, infinite, key, all];
}
`;
}

export const SVELTE_CONSUMER = accessorConsumer('@tanstack/svelte-query', 'svelte-query');
export const SOLID_CONSUMER = accessorConsumer('@tanstack/solid-query', 'solid-query');

export const SWR_CONSUMER = `
import {
  getShapeQueryKey, shapesKeys, useCreateShape, useDeleteShape, useGetShape, useGetTree,
  useListShapes, useListShapesInfinite, usePostEvent,
} from '__API__/swr/index.js';
import type { GetShapeResponse, ShapePage, TreeNode } from '__API__/index.js';

export function useConsumer(): unknown[] {
  const shape = useGetShape({ shapeId: 's' });
  const data: GetShapeResponse | undefined = shape.data;
  const errorName: string | undefined = shape.error?.name;
  const skipped = useGetShape({ shapeId: 's' }, { enabled: false, revalidateOnFocus: false });
  // @ts-expect-error params are required
  useGetShape();
  const tree: TreeNode | undefined = useGetTree().data;
  const list = useListShapes({ 'X-Request-ID': 'r' }, { request: { timeout: 500 } });
  const create = useCreateShape({ onSuccess: (created) => { const createdId: string = created.id; void createdId; } });
  void create.trigger({ body: { kind: 'circle', radius: 1 } });
  // @ts-expect-error readOnly properties are not part of request bodies
  void create.trigger({ body: { kind: 'circle', id: 'c', radius: 1 } });
  const remove = useDeleteShape();
  void remove.trigger({ shapeId: 'x' });
  const post = usePostEvent();
  void post.trigger();
  const pages = useListShapesInfinite(
    { 'X-Request-ID': 'r' },
    { initialPageParam: undefined, getNextPageParam: (last) => last.nextCursor },
  );
  const first: ShapePage | undefined = pages.data?.[0];
  const key: readonly ['Shapes', 'getShape', { shapeId: string }] = getShapeQueryKey({ shapeId: 's' });
  const all: readonly ['Shapes'] = shapesKeys.all;
  return [data, errorName, skipped, tree, list, remove, first, key, all];
}
`;
