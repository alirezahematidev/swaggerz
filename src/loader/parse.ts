import { parse as parseYaml, YAMLParseError } from 'yaml';

export type DocumentFormat = 'json' | 'yaml';

export class DocumentParseError extends Error {
  readonly line?: number;
  readonly column?: number;

  constructor(message: string, position?: { line: number; column: number }) {
    super(message);
    this.name = 'DocumentParseError';
    if (position !== undefined) {
      this.line = position.line;
      this.column = position.column;
    }
  }
}

/** Determines the format from a file extension, content type or the content itself. */
export function detectFormat(text: string, hint?: string): DocumentFormat {
  const lowerHint = hint?.toLowerCase() ?? '';
  if (lowerHint.endsWith('.json') || lowerHint.includes('application/json')) return 'json';
  if (/\.ya?ml$/.test(lowerHint) || lowerHint.includes('yaml')) return 'yaml';
  const first = text.trimStart()[0];
  return first === '{' || first === '[' ? 'json' : 'yaml';
}

function lineColumnAt(text: string, offset: number): { line: number; column: number } {
  let line = 1;
  let lineStart = 0;
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text.charCodeAt(i) === 10) {
      line++;
      lineStart = i + 1;
    }
  }
  return { line, column: offset - lineStart + 1 };
}

/**
 * Parses JSON or YAML. YAML is parsed with the YAML 1.2 core schema (so `yes`/`no` and dates stay
 * strings), duplicate keys are rejected and alias expansion is bounded to prevent
 * "billion laughs" style documents.
 */
export function parseDocumentText(text: string, format: DocumentFormat): unknown {
  if (format === 'json') {
    try {
      return JSON.parse(text) as unknown;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const match = /position (\d+)/.exec(message);
      const position = match?.[1] === undefined ? undefined : lineColumnAt(text, Number(match[1]));
      throw new DocumentParseError(`Invalid JSON: ${message}`, position);
    }
  }
  return parseYamlText(text);
}

function parseYamlText(text: string): unknown {
  try {
    return parseYaml(text, {
      schema: 'core',
      merge: true,
      uniqueKeys: true,
      maxAliasCount: 1000,
      prettyErrors: true,
    }) as unknown;
  } catch (error) {
    if (error instanceof YAMLParseError) {
      const pos = error.linePos?.[0];
      throw new DocumentParseError(
        `Invalid YAML: ${error.message.split('\n')[0] ?? error.message}`,
        pos === undefined ? undefined : { line: pos.line, column: pos.col },
      );
    }
    throw new DocumentParseError(
      `Invalid YAML: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
