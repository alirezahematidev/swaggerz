/**
 * Consumer programs type-checked against the schemas generated for features-3.1.yaml (also used by
 * `pnpm compat`). `__API__` is the output path.
 */
export const VALIBOT_CONSUMER = `
import * as v from 'valibot';
import { CatSchema, ShapeSchema, TreeNodeSchema } from '__API__/valibot/index.js';

export function parse(input: unknown): unknown[] {
  const shape = v.parse(ShapeSchema, input);
  const measure: number = shape.kind === 'circle' ? shape.radius : shape.width;
  const tree = v.parse(TreeNodeSchema, input);
  const child: string | undefined = tree.children?.[0]?.value;
  const petType: 'Cat' = v.parse(CatSchema, input).petType;
  return [measure, child, petType];
}
`;

export const ARKTYPE_CONSUMER = `
import { CatSchema, ShapeSchema, TreeNodeSchema } from '__API__/arktype/index.js';

export function parse(input: unknown): unknown[] {
  const shape = ShapeSchema.assert(input);
  const measure: number = shape.kind === 'circle' ? shape.radius : shape.width;
  const tree = TreeNodeSchema.assert(input);
  const child: string | undefined = tree.children?.[0]?.value;
  const petType: 'Cat' = CatSchema.assert(input).petType;
  return [measure, child, petType];
}
`;
