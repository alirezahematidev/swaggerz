/**
 * Compiles every twin (`website/twins/twins.ts`) and pairs the lines of the specification with
 * the lines of the generated code they produce. The pairs come from the compiler's own mapping:
 * the project model knows which operation, parameter, response and schema (by JSON pointer)
 * became which function, type and property, and the TypeScript parser locates those in the
 * generated text. Nothing is matched by guessing from names in the output.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import { LineCounter, parseDocument, isMap, isPair, isScalar, isSeq, type Node } from 'yaml';
import type {
  ModelSymbol,
  OperationSymbol,
  ProjectModel,
  WebhookSymbol,
} from '../../../src/analysis/types.ts';
import { loadConfig } from '../../../src/config/load.ts';
import { compile } from '../../../src/pipeline/compile.ts';
import { TWINS, type TwinDefinition } from '../../twins/twins.ts';
import { DriftError, WEBSITE, writeGenerated } from './output.ts';

const TWINS_DIR = path.join(WEBSITE, 'twins');

/** Inclusive 1-based line range. */
type Range = readonly [number, number];

export interface Pair {
  readonly label: string;
  readonly spec: readonly Range[];
  readonly code: readonly Range[];
}

const escapePointer = (segment: string): string => segment.replace(/~/g, '~0').replace(/\//g, '~1');

/** Every node of a YAML document by JSON pointer, as the lines from its key to its value's end. */
export function yamlRanges(text: string): Map<string, Range> {
  const lineCounter = new LineCounter();
  const document = parseDocument(text, { lineCounter });
  const ranges = new Map<string, Range>();
  const line = (offset: number): number => lineCounter.linePos(offset).line;
  const end = (offset: number): number => {
    // Ranges end after the last character; step back over the newline that may follow it.
    let position = Math.max(0, offset - 1);
    while (position > 0 && (text[position] === '\n' || text[position] === '\r')) position--;
    return line(position);
  };
  const visit = (node: Node | null | undefined, pointer: string): void => {
    if (node === null || node === undefined) return;
    if (isMap(node)) {
      for (const item of node.items) {
        if (!isPair(item) || !isScalar(item.key)) continue;
        const key = String(item.key.value);
        const child = `${pointer}/${escapePointer(key)}`;
        const start = item.key.range?.[0] ?? 0;
        const value = item.value as Node | null;
        const stop = value?.range?.[1] ?? item.key.range?.[1] ?? start;
        ranges.set(child, [line(start), end(stop)]);
        visit(value, child);
      }
    } else if (isSeq(node)) {
      node.items.forEach((item, index) => {
        const child = `${pointer}/${index}`;
        const itemNode = item as Node;
        const range = itemNode.range;
        if (range !== undefined && range !== null)
          ranges.set(child, [line(range[0]), end(range[1])]);
        visit(itemNode, child);
      });
    }
  };
  visit(document.contents, '');
  return ranges;
}

/** Locates declarations and members in one generated file. */
class CodeIndex {
  readonly #file: ts.SourceFile;
  readonly #text: string;

  constructor(name: string, text: string) {
    this.#text = text;
    this.#file = ts.createSourceFile(
      name,
      text,
      ts.ScriptTarget.ES2022,
      true,
      name.endsWith('.js') ? ts.ScriptKind.JS : ts.ScriptKind.TS,
    );
  }

  #line(position: number): number {
    return this.#file.getLineAndCharacterOfPosition(position).line + 1;
  }

  /** The node's lines, starting at its documentation comment when it has one. */
  range(node: ts.Node, withDocs = true): Range {
    const docs = withDocs ? ts.getJSDocCommentsAndTags(node) : [];
    const start = Math.min(
      node.getStart(this.#file),
      ...docs.map((doc) => doc.getStart(this.#file)),
    );
    return [this.#line(start), this.#line(node.getEnd())];
  }

  /** A top-level declaration (`function`, `type`, `interface`, `const`) by name. */
  declaration(name: string): ts.Node | undefined {
    for (const statement of this.#file.statements) {
      if (
        (ts.isFunctionDeclaration(statement) ||
          ts.isTypeAliasDeclaration(statement) ||
          ts.isInterfaceDeclaration(statement)) &&
        statement.name?.text === name
      ) {
        return statement;
      }
      if (ts.isVariableStatement(statement)) {
        const found = statement.declarationList.declarations.find(
          (d) => ts.isIdentifier(d.name) && d.name.text === name,
        );
        if (found !== undefined) return statement;
      }
    }
    return undefined;
  }

  /** Every function declaration with this name (overloads included). */
  functions(name: string): ts.FunctionDeclaration[] {
    return this.#file.statements.filter(
      (s): s is ts.FunctionDeclaration => ts.isFunctionDeclaration(s) && s.name?.text === name,
    );
  }

  /** Property signatures named `name` inside a declaration's type literals. */
  members(declaration: ts.Node, name: string): ts.Node[] {
    const found: ts.Node[] = [];
    const visit = (node: ts.Node): void => {
      if (
        (ts.isPropertySignature(node) || ts.isPropertyAssignment(node)) &&
        propertyName(node.name) === name
      ) {
        found.push(node);
        return;
      }
      ts.forEachChild(node, visit);
    };
    ts.forEachChild(declaration, visit);
    return found;
  }

  /** In a union type alias, the `ApiError<…, status>` member for a status code. */
  errorMember(declaration: ts.Node, status: string): ts.Node | undefined {
    let found: ts.Node | undefined;
    const visit = (node: ts.Node): void => {
      if (found !== undefined) return;
      if (
        ts.isTypeReferenceNode(node) &&
        node.typeArguments?.[1] !== undefined &&
        ts.isLiteralTypeNode(node.typeArguments[1]) &&
        node.typeArguments[1].literal.getText(this.#file) === status
      ) {
        found = node;
        return;
      }
      ts.forEachChild(node, visit);
    };
    ts.forEachChild(declaration, visit);
    return found;
  }

  /** Lines containing `text`, within a range. */
  linesWith(text: string, within?: Range): Range[] {
    const lines = this.#text.split('\n');
    const out: Range[] = [];
    lines.forEach((line, index) => {
      const number = index + 1;
      if (within !== undefined && (number < within[0] || number > within[1])) return;
      if (line.includes(text)) out.push([number, number]);
    });
    return out;
  }

  /** JavaScript output: the `@property` line of a JSDoc typedef. */
  typedefProperty(typedef: string, property: string): Range[] {
    const lines = this.#text.split('\n');
    const start = lines.findIndex((line) =>
      new RegExp(`@typedef\\s+\\{[^}]*\\}\\s+${typedef}\\b`).test(line),
    );
    if (start === -1) return [];
    for (let index = start + 1; index < lines.length && !lines[index]?.includes('*/'); index++) {
      const line = lines[index] ?? '';
      if (
        new RegExp(
          `@property\\s+\\{.*\\}\\s+\\[?['"]?${property.replace(/[-]/g, '\\-')}['"]?[\\]=\\s]`,
        ).test(`${line} `)
      ) {
        return [[index + 1, index + 1]];
      }
    }
    return [];
  }

  /** JavaScript output: the lines of a JSDoc typedef block. */
  typedef(name: string): Range | undefined {
    const lines = this.#text.split('\n');
    const at = lines.findIndex((line) =>
      new RegExp(`@typedef\\s+\\{[^}]*\\}\\s+${name}\\b`).test(line),
    );
    if (at === -1) return undefined;
    let start = at;
    while (start > 0 && !lines[start]?.includes('/**')) start--;
    let end = at;
    while (end < lines.length - 1 && !lines[end]?.includes('*/')) end++;
    return [start + 1, end + 1];
  }
}

function propertyName(name: ts.PropertyName): string | undefined {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name))
    return name.text;
  return undefined;
}

/** Collects pairs, merging those of the same spec node. */
class Pairs {
  readonly #pairs = new Map<string, { label: string; spec: Range[]; code: Range[] }>();
  readonly #spec: Map<string, Range>;

  constructor(spec: Map<string, Range>) {
    this.#spec = spec;
  }

  add(pointer: string, label: string, code: readonly (Range | undefined)[]): void {
    const spec = this.#spec.get(pointer);
    const ranges = code.filter((range): range is Range => range !== undefined);
    if (spec === undefined || ranges.length === 0) return;
    const existing = this.#pairs.get(pointer);
    if (existing === undefined)
      this.#pairs.set(pointer, { label, spec: [spec], code: [...ranges] });
    else existing.code.push(...ranges);
  }

  /** Pairs whose spec side is the key line only (a mapping key whose value is elsewhere). */
  addKeyLine(pointer: string, label: string, code: readonly (Range | undefined)[]): void {
    const spec = this.#spec.get(pointer);
    const ranges = code.filter((range): range is Range => range !== undefined);
    if (spec === undefined || ranges.length === 0) return;
    this.#pairs.set(`${pointer}#key`, { label, spec: [[spec[0], spec[0]]], code: [...ranges] });
  }

  toArray(): Pair[] {
    return [...this.#pairs.values()].map((pair) => ({
      label: pair.label,
      spec: pair.spec,
      code: dedupe(pair.code),
    }));
  }
}

function dedupe(ranges: readonly Range[]): Range[] {
  const seen = new Set<string>();
  return ranges.filter((range) => {
    const key = range.join('-');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function operationPairs(
  op: OperationSymbol,
  code: CodeIndex,
  pairs: Pairs,
  javascript: boolean,
): void {
  const pointer = op.operation.source.pointer;
  const fn = code.functions(op.name);
  const first = fn[0];
  if (first === undefined) return;
  const fnRange = code.range(first);
  pairs.add(
    pointer,
    op.name,
    fn.map((node) => code.range(node)),
  );
  pairs.add(
    `${pointer}/operationId`,
    'operationId',
    code.linesWith(`operationId: '${op.operation.operationId ?? ''}'`),
  );
  const pathItem = pointer.split('/').slice(0, -1).join('/');
  pairs.addKeyLine(pathItem, 'path', code.linesWith(`path: '${op.operation.path}'`));
  for (const field of ['summary', 'description'] as const) {
    const text = op.operation[field];
    if (text !== undefined)
      pairs.add(`${pointer}/${field}`, field, code.linesWith(text.slice(0, 40), fnRange));
  }
  const params = javascript ? undefined : code.declaration(op.typeNames.params);
  op.operation.parameters.forEach((parameter, index) => {
    const property = op.parameterProperties[index] ?? parameter.name;
    const members =
      params === undefined ? [] : code.members(params, property).map((m) => code.range(m));
    const typedef = javascript ? code.typedefProperty(op.typeNames.params, property) : [];
    const sent = code.linesWith(
      `${/^[A-Za-z_$][\w$]*$/.test(parameter.name) ? parameter.name : `'${parameter.name}'`}: params`,
      fnRange,
    );
    pairs.add(parameter.source.pointer, parameter.name, [...members, ...typedef, ...sent]);
  });
  const body = op.operation.requestBody;
  if (body !== undefined) {
    const members =
      params === undefined ? [] : code.members(params, op.bodyProperty).map((m) => code.range(m));
    const bodyType = code.declaration(op.typeNames.body);
    const bodies =
      op.typeNames.bodies === undefined ? undefined : code.declaration(op.typeNames.bodies);
    pairs.add(body.source.pointer, 'request body', [
      ...members,
      bodyType === undefined ? undefined : code.range(bodyType),
      bodies === undefined ? undefined : code.range(bodies),
      params === undefined ? undefined : code.range(params),
    ]);
    for (const media of body.contents) {
      pairs.add(
        `${body.source.pointer}/content/${escapePointer(media.mediaType)}`,
        media.mediaType,
        code.linesWith(`'${media.mediaType}'`),
      );
    }
  }
  const response = code.declaration(op.typeNames.response);
  const apiError = code.declaration(op.typeNames.apiError);
  for (const item of op.operation.responses) {
    const status = item.status;
    if (status.startsWith('2')) {
      pairs.add(item.source.pointer, `${status} response`, [
        response === undefined ? undefined : code.range(response),
        ...(javascript ? [code.typedef(op.typeNames.response)] : []),
      ]);
    } else if (apiError !== undefined) {
      const member = code.errorMember(apiError, status);
      pairs.add(item.source.pointer, `${status} response`, [
        member === undefined ? undefined : code.range(member, false),
      ]);
    }
  }
  pairs.add(`${pointer}/security`, 'security', code.linesWith('security: [', fnRange));
  const server = op.operation.servers?.[0]?.url;
  if (server !== undefined) {
    for (const candidate of [`${pointer}/servers`, `${pathItem}/servers`]) {
      pairs.add(candidate, 'servers', code.linesWith(server, fnRange));
    }
  }
}

function modelPairs(
  model: ModelSymbol,
  code: CodeIndex,
  pairs: Pairs,
  spec: Map<string, Range>,
  declarationName: string,
): void {
  const pointer = model.definition.source.pointer;
  const declaration = code.declaration(declarationName);
  if (declaration === undefined) return;
  pairs.add(pointer, model.name, [code.range(declaration)]);
  for (const key of spec.keys()) {
    const match = new RegExp(
      `^${pointer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/properties/([^/]+)$`,
    ).exec(key);
    if (match === null) continue;
    const property = (match[1] ?? '').replace(/~1/g, '/').replace(/~0/g, '~');
    pairs.add(
      key,
      property,
      code.members(declaration, property).map((m) => code.range(m)),
    );
  }
}

function webhookPairs(webhook: WebhookSymbol, code: CodeIndex, pairs: Pairs): void {
  const pointer = webhook.operation.source.pointer;
  const handler = code.declaration(webhook.typeNames.handler);
  const request = code.declaration(webhook.typeNames.request);
  const payload = code.declaration(webhook.typeNames.payload);
  const response = code.declaration(webhook.typeNames.response);
  pairs.add(pointer, webhook.typeNames.handler, [
    handler === undefined ? undefined : code.range(handler),
  ]);
  const body = webhook.operation.requestBody;
  if (body !== undefined) {
    pairs.add(body.source.pointer, 'payload', [
      payload === undefined ? undefined : code.range(payload),
    ]);
  }
  for (const parameter of webhook.operation.parameters) {
    const name = parameter.in === 'header' ? parameter.name.toLowerCase() : parameter.name;
    pairs.add(
      parameter.source.pointer,
      parameter.name,
      request === undefined ? [] : code.members(request, name).map((m) => code.range(m)),
    );
  }
  for (const item of webhook.operation.responses) {
    pairs.add(item.source.pointer, `${item.status} response`, [
      response === undefined ? undefined : code.range(response),
    ]);
  }
}

function hookPairs(op: OperationSymbol, code: CodeIndex, pairs: Pairs): void {
  const query = op.query;
  if (query === undefined) return;
  const pointer = op.operation.source.pointer;
  const names = [query.hook, query.queryOptions, query.mutationOptions].filter(
    (n): n is string => n !== undefined,
  );
  pairs.add(
    pointer,
    query.hook,
    names.flatMap((name) => code.functions(name).map((fn) => code.range(fn))),
  );
  const keyNames = [query.queryKey, query.queryKeyType].filter((n): n is string => n !== undefined);
  pairs.add(
    `${pointer}/operationId`,
    'query key',
    keyNames.map((name) => {
      const node = code.declaration(name);
      return node === undefined ? undefined : code.range(node);
    }),
  );
  pairs.add(`${pointer}/tags`, 'key prefix', code.linesWith(`'${query.keyPrefix[0] ?? ''}'`));
}

function linkFile(
  project: ProjectModel,
  file: string,
  text: string,
  spec: Map<string, Range>,
): Pair[] {
  const code = new CodeIndex(file, text);
  const pairs = new Pairs(spec);
  const module = file.replace(/\.(d\.ts|ts|js)$/, '');
  const javascript = file.endsWith('.js');
  for (const op of project.operations) {
    if (op.module === module) operationPairs(op, code, pairs, javascript);
    if (op.query?.module === module) hookPairs(op, code, pairs);
  }
  for (const model of project.models) {
    if (model.module === module) modelPairs(model, code, pairs, spec, model.name);
    if (model.schemaModule === module && model.schemaName !== undefined) {
      modelPairs(model, code, pairs, spec, model.schemaName);
    }
    if (model.datesModule === module && model.datesName !== undefined) {
      modelPairs(model, code, pairs, spec, model.datesName);
    }
  }
  for (const webhook of project.webhooks) {
    if (webhook.module === module) webhookPairs(webhook, code, pairs);
  }
  if (file === 'client.ts') {
    const server = project.ir.servers[0]?.url;
    if (server !== undefined) pairs.add('/servers', 'servers', code.linesWith(server));
  }
  return pairs.toArray();
}

const languageOf = (file: string): string =>
  file.endsWith('.json')
    ? 'json'
    : file.endsWith('.yaml') || file.endsWith('.yml')
      ? 'yaml'
      : file.endsWith('.js')
        ? 'js'
        : 'ts';

/** The twin's options as they would appear in a config file. */
export function configLiteral(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => configLiteral(item)).join(', ')}]`;
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value);
    if (entries.length === 0) return '{}';
    return `{ ${entries.map(([key, item]) => `${/^[A-Za-z_$][\w$]*$/.test(key) ? key : `'${key}'`}: ${configLiteral(item)}`).join(', ')} }`;
  }
  return typeof value === 'string' ? `'${value}'` : String(value);
}

async function buildTwin(twin: TwinDefinition): Promise<unknown> {
  const [input = ''] = twin.spec;
  const loaded = await loadConfig({
    cwd: TWINS_DIR,
    inlineConfig: {
      ...twin.config,
      spec: { version: twin.version ?? '3.1', input: `./${input}`, ...twin.config?.spec },
    },
    env: {},
  });
  const result = await compile({ config: loaded.config, plugins: loaded.plugins });
  const problems = result.diagnostics
    .filter((d) => d.severity !== 'info')
    .map((d) => `${twin.id}: ${d.code} ${d.message}`);
  if (!result.ok || result.project === undefined || problems.length > 0) {
    throw new DriftError(`The twin "${twin.id}" does not compile cleanly:`, problems);
  }
  const specText = await readFile(path.join(TWINS_DIR, input), 'utf8');
  const specRanges = yamlRanges(specText);
  const tabs = [];
  for (const shown of twin.files) {
    const file = result.files.find((candidate) => candidate.path === shown.path);
    if (file === undefined) {
      throw new DriftError(`The twin "${twin.id}" shows a file the generator no longer writes:`, [
        `${shown.path} (generated: ${result.files
          .map((f) => f.path)
          .filter((p) => !p.startsWith('runtime/'))
          .join(', ')})`,
      ]);
    }
    const pairs = linkFile(result.project, file.path, file.content, specRanges);
    tabs.push({
      label: shown.label,
      file: file.path,
      language: languageOf(file.path),
      code: file.content.trimEnd(),
      pairs,
    });
  }
  const specFiles = await Promise.all(
    twin.spec.map(async (name) => ({
      name,
      language: languageOf(name),
      code: (await readFile(path.join(TWINS_DIR, name), 'utf8')).trimEnd(),
    })),
  );
  const options = twin.config === undefined ? undefined : configLiteral(twin.config);
  return { id: twin.id, spec: specFiles, tabs, config: options };
}

export async function twins(): Promise<void> {
  const built = [];
  for (const twin of TWINS) built.push(await buildTwin(twin));
  await writeGenerated(
    'twins.json',
    Object.fromEntries(built.map((twin) => [(twin as { id: string }).id, twin])),
  );
}
