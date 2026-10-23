import type { JsonValue, SchemaIR } from '../ir/types.ts';
import type { JsDocBlock, JsDocTag } from './types.ts';

const MAX_EXAMPLE_LENGTH = 500;

function json(value: JsonValue): string | undefined {
  const text = JSON.stringify(value);
  return text.length > MAX_EXAMPLE_LENGTH ? undefined : text;
}

/** Splits text into a first paragraph (summary) and the rest. */
export function splitSummary(text: string | undefined): { summary?: string; description?: string } {
  if (text === undefined || text.trim() === '') return {};
  const trimmed = text.trim();
  const index = trimmed.search(/\n\s*\n/);
  if (index === -1) return { summary: trimmed };
  return { summary: trimmed.slice(0, index).trim(), description: trimmed.slice(index).trim() };
}

/** Documentation tags derived from schema metadata and constraints. */
export function schemaTags(schema: SchemaIR): JsDocTag[] {
  const tags: JsDocTag[] = [];
  if (schema.deprecated === true) tags.push({ tag: 'deprecated' });
  if (schema.format !== undefined && schema.format !== 'binary')
    tags.push({ tag: 'format', text: schema.format });
  const constraints: Record<string, unknown> =
    'constraints' in schema ? { ...schema.constraints } : {};
  for (const [key, value] of Object.entries(constraints)) {
    if (key === 'contentEncoding' || key === 'contentMediaType') continue;
    if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') {
      tags.push({ tag: key, text: String(value) });
    }
  }
  if (schema.default !== undefined) {
    const text = json(schema.default);
    if (text !== undefined) tags.push({ tag: 'default', text });
  }
  const example = schema.examples?.[0];
  if (example !== undefined) {
    const text = json(example);
    if (text !== undefined) tags.push({ tag: 'example', text });
  }
  return tags;
}

/** JSDoc block for a schema (model or property). */
export function schemaDoc(schema: SchemaIR, fallback?: string): JsDocBlock {
  const text = schema.description ?? schema.title ?? fallback;
  return { ...splitSummary(text), tags: schemaTags(schema) };
}
