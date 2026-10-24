/**
 * The diagnostics dictionary. Meanings come from `docs/diagnostics.md`; the build checks that the
 * document and the compiler agree (every code `src/` reports is documented, every documented
 * code exists, lint rules match their catalog) and runs the examples in
 * `diagnostic-examples.ts` through the compiler, so each example shows the message the compiler
 * prints today.
 */
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadConfig } from '../../../src/config/load.ts';
import { SwaggerzError } from '../../../src/diagnostics/bag.ts';
import { formatDiagnostic } from '../../../src/diagnostics/format.ts';
import type { Diagnostic } from '../../../src/diagnostics/types.ts';
import { lintProject, LINT_RULES } from '../../../src/lint/lint.ts';
import { compile } from '../../../src/pipeline/compile.ts';
import { EXAMPLES, type DiagnosticExample } from './diagnostic-examples.ts';
import { inlineMarkdown, markdownTables } from './markdown.ts';
import { DriftError, ROOT, WEBSITE, writeGenerated } from './output.ts';

const SOURCE = 'docs/diagnostics.md';
const CODE_PATTERN =
  /['`"]((?:config|spec|overlay|ref|schema|operation|security|naming|query|output|plugin|dashboard|internal)\/[a-z0-9]+(?:-[a-z0-9]+)*)['`"]/g;

interface Entry {
  readonly code: string;
  readonly area: string;
  readonly severity: string;
  readonly meaning: string;
  /** Other codes documented in the same row. */
  readonly related: readonly string[];
  readonly example?: {
    readonly title: string;
    readonly command: string;
    readonly files: readonly { name: string; language: string; content: string }[];
    readonly output: string;
    readonly fix: string;
  };
}

/** `spec/invalid-parameter(s)` documents both spellings. */
function expand(code: string): string[] {
  const optional = /^(.*)\(([a-z]+)\)$/.exec(code);
  return optional === null
    ? [code]
    : [optional[1] ?? '', `${optional[1] ?? ''}${optional[2] ?? ''}`];
}

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true, recursive: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
    .map((entry) => path.join(entry.parentPath, entry.name))
    .filter((file) => !file.includes(`${path.sep}templates${path.sep}`))
    .sort();
}

async function codesInSource(): Promise<Set<string>> {
  const codes = new Set<string>();
  for (const file of await sourceFiles(path.join(ROOT, 'src'))) {
    const text = await readFile(file, 'utf8');
    for (const match of text.matchAll(CODE_PATTERN))
      if (match[1] !== undefined) codes.add(match[1]);
  }
  return codes;
}

async function runExample(example: DiagnosticExample): Promise<Diagnostic[]> {
  const directory = path.join(WEBSITE, '.cache', 'diagnostics', example.code.replace('/', '-'));
  await rm(directory, { recursive: true, force: true });
  await mkdir(directory, { recursive: true });
  for (const file of example.files) await writeFile(path.join(directory, file.name), file.content);
  let loaded;
  try {
    loaded = await loadConfig({
      cwd: directory,
      inlineConfig: example.config,
      command: example.lint === true ? 'lint' : 'generate',
      env: {},
    });
  } catch (error) {
    if (error instanceof SwaggerzError) return [...error.diagnostics];
    throw error;
  }
  const result = await compile({ config: loaded.config, plugins: loaded.plugins });
  const findings =
    example.lint === true && result.project !== undefined
      ? lintProject(result.project, loaded.config, result.store)
      : [];
  return [...result.diagnostics, ...findings];
}

export async function diagnostics(): Promise<void> {
  const text = await readFile(path.join(ROOT, SOURCE), 'utf8');
  const problems: string[] = [];
  const entries: Entry[] = [];
  const intro: string[] = [];

  for (const line of text.split('\n').slice(1)) {
    if (line.startsWith('|') || line.startsWith('## ')) break;
    if (line.trim() !== '') intro.push(line);
  }

  for (const table of markdownTables(text)) {
    for (const [index, row] of table.rows.entries()) {
      if (index === 0) continue; // header
      const [codeCell = '', severity = '', meaning = ''] = row;
      const codes = [...codeCell.matchAll(/`([^`]+)`/g)].flatMap((match) => expand(match[1] ?? ''));
      for (const code of codes) {
        entries.push({
          code,
          area: code.split('/')[0] ?? code,
          severity,
          meaning: inlineMarkdown(meaning, SOURCE),
          related: codes.filter((other) => other !== code),
        });
      }
    }
  }

  // The document and the compiler agree.
  const documented = new Set(entries.map((entry) => entry.code));
  const reported = await codesInSource();
  for (const code of [...reported].sort()) {
    if (!documented.has(code))
      problems.push(`${code} is reported in src/ but missing from ${SOURCE}`);
  }
  for (const entry of entries) {
    if (entry.area === 'lint') {
      const rule = LINT_RULES.find((r) => `lint/${r.name}` === entry.code);
      if (rule === undefined) problems.push(`${entry.code} is documented but is not a lint rule`);
      else if (rule.severity !== entry.severity) {
        problems.push(
          `${entry.code} is documented as ${entry.severity}, its rule defaults to ${rule.severity}`,
        );
      }
    } else if (!reported.has(entry.code)) {
      problems.push(`${entry.code} is documented in ${SOURCE} but nothing in src/ reports it`);
    }
  }
  for (const rule of LINT_RULES) {
    if (!documented.has(`lint/${rule.name}`))
      problems.push(`lint/${rule.name} is missing from ${SOURCE}`);
  }

  // Examples, from real compiler runs.
  const examples = new Map<string, NonNullable<Entry['example']>>();
  for (const example of EXAMPLES) {
    if (!documented.has(example.code)) {
      problems.push(`The example for ${example.code} names an undocumented code`);
      continue;
    }
    const all = await runExample(example);
    const matching = all.filter((d) => d.code === example.code);
    if (matching.length === 0) {
      problems.push(
        `The example for ${example.code} no longer reports it (got: ${all.map((d) => d.code).join(', ') || 'nothing'})`,
      );
      continue;
    }
    const directory = path.join(WEBSITE, '.cache', 'diagnostics', example.code.replace('/', '-'));
    examples.set(example.code, {
      title: inlineMarkdown(example.title, 'website/scripts/data/diagnostic-examples.ts'),
      command: example.lint === true ? 'swaggerz lint' : 'swaggerz generate',
      files: example.files.map((file) => ({
        name: file.name,
        language: file.name.endsWith('.json') ? 'json' : 'yaml',
        content: file.content.trimEnd(),
      })),
      output: matching.map((d) => formatDiagnostic(d, { cwd: directory })).join('\n\n'),
      fix: inlineMarkdown(example.fix, 'website/scripts/data/diagnostic-examples.ts'),
    });
  }

  if (problems.length > 0) {
    throw new DriftError(`${SOURCE}, src/ and the diagnostic examples disagree:`, problems);
  }

  await writeGenerated('diagnostics.json', {
    intro: intro.map((line) => inlineMarkdown(line.replace(/^- /, ''), SOURCE)),
    entries: entries.map((entry) => {
      const example = examples.get(entry.code);
      return example === undefined ? entry : { ...entry, example };
    }),
  });
}
