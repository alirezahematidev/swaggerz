import { isPropertyIdentifier } from '../analysis/naming.ts';
import type { JsDocBlock } from './types.ts';

/** Quotes a string as a single-quoted JavaScript string literal. */
export function quote(value: string): string {
  let result = "'";
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    switch (char) {
      case '\\':
        result += '\\\\';
        break;
      case "'":
        result += "\\'";
        break;
      case '\n':
        result += '\\n';
        break;
      case '\r':
        result += '\\r';
        break;
      case '\t':
        result += '\\t';
        break;
      case '\u2028':
        result += '\\u2028';
        break;
      case '\u2029':
        result += '\\u2029';
        break;
      default:
        result += code < 0x20 || code === 0x7f ? `\\u${code.toString(16).padStart(4, '0')}` : char;
    }
  }
  return `${result}'`;
}

/** Renders an object key, quoting it when it is not a valid identifier. */
export function propertyKey(name: string): string {
  return isPropertyIdentifier(name) ? name : quote(name);
}

/** Renders a property access: `obj.name` or `obj['name']`. */
export function propertyAccess(object: string, name: string, optional = false): string {
  if (isPropertyIdentifier(name)) return `${object}${optional ? '?.' : '.'}${name}`;
  return `${object}${optional ? '?.' : ''}[${quote(name)}]`;
}

/** Renders a JSON value as a JavaScript literal (deterministic key order is preserved). */
export function literal(value: unknown): string {
  if (typeof value === 'string') return quote(value);
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'null';
  if (typeof value === 'boolean' || value === null) return String(value);
  if (Array.isArray(value)) return `[${value.map(literal).join(', ')}]`;
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).map(
      ([k, v]) => `${propertyKey(k)}: ${literal(v)}`,
    );
    return entries.length === 0 ? '{}' : `{ ${entries.join(', ')} }`;
  }
  return 'undefined';
}

/** Escapes text placed inside a block comment so it cannot terminate the comment. */
export function escapeComment(text: string): string {
  return text
    .replace(/\*\//g, '*\\/')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u2028\u2029]/g, '\n');
}

/** Escapes text for a JSDoc description: lines may not start a tag accidentally. */
function escapeDocText(text: string): string {
  return escapeComment(text)
    .split('\n')
    .map((line) => line.replace(/^(\s*)@/, '$1\\@').trimEnd())
    .join('\n');
}

/** Renders a JSDoc block. Returns `''` when the block is empty. */
export function renderJsDoc(block: JsDocBlock | undefined, indent = ''): string {
  if (block === undefined) return '';
  const lines: string[] = [];
  const pushText = (text: string): void => {
    for (const line of escapeDocText(text.trim()).split('\n')) lines.push(line);
  };
  if (block.summary !== undefined && block.summary.trim() !== '') pushText(block.summary);
  if (block.description !== undefined && block.description.trim() !== '') {
    if (lines.length > 0) lines.push('');
    pushText(block.description);
  }
  if (block.tags.length > 0 && lines.length > 0) lines.push('');
  for (const tag of block.tags) {
    const text = tag.text === undefined ? '' : escapeComment(tag.text).trim();
    const [first = '', ...rest] = text.split('\n');
    lines.push(`@${tag.tag}${first === '' ? '' : ` ${first}`}`.trimEnd());
    for (const line of rest) lines.push(line.trimEnd());
  }
  // Collapse runs of blank lines.
  const compact = lines.filter((line, index) => !(line === '' && lines[index - 1] === ''));
  while (compact.at(-1) === '') compact.pop();
  if (compact.length === 0) return '';
  if (compact.length === 1) return `${indent}/** ${compact[0] ?? ''} */\n`;
  return `${indent}/**\n${compact.map((line) => `${indent} *${line === '' ? '' : ` ${line}`}`).join('\n')}\n${indent} */\n`;
}

/** Indents every non-empty line. */
export function indentLines(text: string, indent: string): string {
  return text
    .split('\n')
    .map((line) => (line === '' ? line : indent + line))
    .join('\n');
}
