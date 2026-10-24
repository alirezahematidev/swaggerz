/**
 * Line-by-line highlighting for the playground's specification editor: YAML and JSON keys,
 * strings, numbers, literals and comments. It only colors text (the editor's layout depends on
 * every character keeping its place), so it never needs to be exact, only fast and stable.
 */
export type TokenKind = 'text' | 'key' | 'string' | 'number' | 'literal' | 'comment' | 'punct';

export interface Token {
  readonly kind: TokenKind;
  readonly text: string;
}

// Indentation, an optional list dash, then a bare or quoted key followed by a colon.
const KEY = /^(\s*)(-\s+)?("(?:\\.|[^"\\])*"|'(?:''|[^'])*'|[^\s"'#:{}[\],][^#:]*?)(\s*:)(?=\s|$)/;
const DASH = /^(\s*)(-)(?=\s|$)/;
const VALUE =
  /("(?:\\.|[^"\\])*"?|'(?:''|[^'])*'?)|((?:^|(?<=\s))#.*$)|(-?\b\d+(?:\.\d+)*(?:[eE][+-]?\d+)?\b)|\b(true|false|null|True|False|Null|~)\b|([{}[\],])/g;

function values(text: string, tokens: Token[]): void {
  let last = 0;
  for (const match of text.matchAll(VALUE)) {
    const index = match.index;
    if (index > last) tokens.push({ kind: 'text', text: text.slice(last, index) });
    const [whole, string, comment, number, literal] = match;
    const kind: TokenKind =
      string !== undefined
        ? 'string'
        : comment !== undefined
          ? 'comment'
          : number !== undefined
            ? 'number'
            : literal !== undefined
              ? 'literal'
              : 'punct';
    tokens.push({ kind, text: whole });
    last = index + whole.length;
  }
  if (last < text.length) tokens.push({ kind: 'text', text: text.slice(last) });
}

export function highlightLine(line: string): Token[] {
  const tokens: Token[] = [];
  if (/^\s*#/.test(line)) return [{ kind: 'comment', text: line }];
  const key = KEY.exec(line);
  if (key !== null) {
    const [whole, indent = '', dash, name = '', colon = ''] = key;
    if (indent !== '') tokens.push({ kind: 'text', text: indent });
    if (dash !== undefined) tokens.push({ kind: 'punct', text: dash });
    tokens.push({ kind: 'key', text: name }, { kind: 'punct', text: colon });
    values(line.slice(whole.length), tokens);
    return tokens;
  }
  const dash = DASH.exec(line);
  if (dash !== null) {
    const [whole, indent = '', mark = ''] = dash;
    if (indent !== '') tokens.push({ kind: 'text', text: indent });
    tokens.push({ kind: 'punct', text: mark });
    values(line.slice(whole.length), tokens);
    return tokens;
  }
  values(line, tokens);
  return tokens;
}
