import { isRecord } from '../utils/object.ts';
import { appendPointer } from './pointer.ts';

export interface RefOccurrence {
  readonly ref: string;
  /** Pointer of the object containing the `$ref`. */
  readonly pointer: string;
  /** True for discriminator mapping values, which may be plain schema names. */
  readonly mapping?: boolean;
}

/** Keys whose values are maps of user-chosen names rather than keyword objects. */
const NAME_MAP_KEYS = new Set([
  'properties',
  'patternProperties',
  'dependentSchemas',
  '$defs',
  'definitions',
  'schemas',
  'responses',
  'securitySchemes',
  'securityDefinitions',
  'paths',
  'webhooks',
  'callbacks',
  'content',
  'headers',
  'encoding',
  'links',
  'requestBodies',
  'pathItems',
  'variables',
]);

/** Keywords whose values are instance data, never schema or reference objects. */
const DATA_KEYS = new Set(['example', 'default', 'enum', 'const']);

type WalkMode = 'keywords' | 'names' | 'examples';

/**
 * Collects `$ref` strings with their location. The walk is context aware: names inside
 * `properties`, `paths`, etc. are not interpreted as keywords, and example/default payloads are
 * never scanned, so a literal `"$ref"` inside example data is not followed.
 */
export function collectRefs(root: unknown): RefOccurrence[] {
  const found: RefOccurrence[] = [];
  const stack: { node: unknown; pointer: string; mode: WalkMode }[] = [
    { node: root, pointer: '', mode: 'keywords' },
  ];
  while (stack.length > 0) {
    const entry = stack.pop();
    if (entry === undefined) break;
    const { node, pointer, mode } = entry;
    if (Array.isArray(node)) {
      node.forEach((child, index) => {
        stack.push({
          node: child,
          pointer: appendPointer(pointer, index),
          mode: mode === 'names' ? 'keywords' : mode,
        });
      });
      continue;
    }
    if (!isRecord(node)) continue;

    if (mode === 'names') {
      for (const [key, child] of Object.entries(node)) {
        stack.push({ node: child, pointer: appendPointer(pointer, key), mode: 'keywords' });
      }
      continue;
    }

    if (typeof node.$ref === 'string') found.push({ ref: node.$ref, pointer });

    for (const [key, child] of Object.entries(node)) {
      if (key === '$ref' || key.startsWith('x-') || DATA_KEYS.has(key)) continue;
      // Inside an Example Object, `value` is example data.
      if (mode === 'examples' && key === 'value') continue;
      const childPointer = appendPointer(pointer, key);
      if (key === 'examples') {
        // JSON Schema `examples` is an array of instances; OpenAPI `examples` maps names to
        // Example Objects (which may themselves be references).
        if (isRecord(child)) {
          for (const [name, example] of Object.entries(child)) {
            stack.push({
              node: example,
              pointer: appendPointer(childPointer, name),
              mode: 'examples',
            });
          }
        }
        continue;
      }
      if (key === 'discriminator' && isRecord(child) && isRecord(child.mapping)) {
        for (const [value, target] of Object.entries(child.mapping)) {
          if (typeof target === 'string' && looksLikeReference(target)) {
            found.push({
              ref: target,
              pointer: appendPointer(childPointer, 'mapping', value),
              mapping: true,
            });
          }
        }
        continue;
      }
      stack.push({
        node: child,
        pointer: childPointer,
        mode: NAME_MAP_KEYS.has(key) ? 'names' : 'keywords',
      });
    }
  }
  return found.reverse();
}

/** Discriminator mapping values are references when they are not bare schema names. */
export function looksLikeReference(value: string): boolean {
  return value.includes('#') || value.includes('/') || /\.(ya?ml|json)$/i.test(value);
}
