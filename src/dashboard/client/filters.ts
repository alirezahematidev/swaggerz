import type { ModelSummary, OperationSummary } from '../api-types.ts';

export interface OperationFilter {
  readonly query: string;
  readonly methods: readonly string[];
  readonly tag: string;
  readonly deprecated: 'all' | 'only' | 'hide';
}

/** Case-insensitive search across names, ids, paths, tags, descriptions and model names. */
export function filterOperations(
  operations: readonly OperationSummary[],
  filter: OperationFilter,
): OperationSummary[] {
  const terms = filter.query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t !== '');
  return operations.filter((op) => {
    if (filter.methods.length > 0 && !filter.methods.includes(op.method)) return false;
    if (filter.tag !== '' && !(op.tags.length === 0 ? ['default'] : op.tags).includes(filter.tag))
      return false;
    if (filter.deprecated === 'only' && !op.deprecated) return false;
    if (filter.deprecated === 'hide' && op.deprecated) return false;
    if (terms.length === 0) return true;
    const haystack = [
      op.name,
      op.operationId ?? '',
      op.method,
      op.path,
      op.summary ?? '',
      op.description ?? '',
      ...op.tags,
      ...op.models,
    ]
      .join(' ')
      .toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
}

export interface ModelFilter {
  readonly query: string;
  readonly show: 'all' | 'used' | 'unused' | 'recursive';
}

export function filterModels(models: readonly ModelSummary[], filter: ModelFilter): ModelSummary[] {
  const query = filter.query.toLowerCase().trim();
  return models.filter((model) => {
    if (filter.show === 'used' && !model.used) return false;
    if (filter.show === 'unused' && model.used) return false;
    if (filter.show === 'recursive' && !model.recursive) return false;
    return (
      query === '' ||
      model.name.toLowerCase().includes(query) ||
      model.kind.toLowerCase().includes(query)
    );
  });
}

export type TokenKind = 'comment' | 'string' | 'keyword' | 'number' | 'type' | 'text';

const KEYWORDS = new Set([
  'as',
  'async',
  'await',
  'boolean',
  'const',
  'declare',
  'default',
  'export',
  'extends',
  'false',
  'from',
  'function',
  'if',
  'import',
  'in',
  'keyof',
  'let',
  'never',
  'new',
  'null',
  'number',
  'readonly',
  'return',
  'string',
  'true',
  'type',
  'typeof',
  'undefined',
  'unknown',
  'void',
]);

/** A small, safe tokenizer for syntax highlighting (text is rendered as text nodes, never HTML). */
export function tokenize(code: string): { kind: TokenKind; text: string }[] {
  const pattern =
    /(\/\*[\s\S]*?\*\/|\/\/[^\n]*)|('(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`)|\b(\d+(?:\.\d+)?)\b|\b([A-Za-z_$][\w$]*)\b/g;
  const tokens: { kind: TokenKind; text: string }[] = [];
  let last = 0;
  for (const match of code.matchAll(pattern)) {
    const index = match.index;
    if (index > last) tokens.push({ kind: 'text', text: code.slice(last, index) });
    const [text, comment, string, number, word] = match;
    if (comment !== undefined) tokens.push({ kind: 'comment', text });
    else if (string !== undefined) tokens.push({ kind: 'string', text });
    else if (number !== undefined) tokens.push({ kind: 'number', text });
    else if (word !== undefined && KEYWORDS.has(word)) tokens.push({ kind: 'keyword', text });
    else if (word !== undefined && /^[A-Z]/.test(word)) tokens.push({ kind: 'type', text });
    else tokens.push({ kind: 'text', text });
    last = index + text.length;
  }
  if (last < code.length) tokens.push({ kind: 'text', text: code.slice(last) });
  return tokens;
}
