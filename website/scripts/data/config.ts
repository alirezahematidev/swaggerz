/**
 * The config reference, walked from the JSON Schema that `src/config/validate.ts` produces: the
 * same definitions validate configs at runtime and give editors completion, so the reference
 * cannot describe an option the CLI does not accept.
 */
import { configJsonSchema, HOOK_NAMES } from '../../../src/config/validate.ts';
import { CONFIG_EXTENSIONS } from '../../../src/config/load.ts';
import { CONFIG_BASENAME, ENV_PREFIX } from '../../../src/meta.ts';
import { ENV_OVERRIDES } from '../../../src/config/env.ts';
import { inlineMarkdown } from './markdown.ts';
import { writeGenerated } from './output.ts';

type Schema = { readonly [keyword: string]: unknown };

interface ConfigOption {
  readonly path: string;
  readonly type: string;
  readonly default: string | undefined;
  readonly description: string;
  readonly required: boolean;
  readonly constraints: readonly string[];
  readonly codeOnly: boolean;
}

const isSchema = (value: unknown): value is Schema =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const literal = (value: unknown): string =>
  typeof value === 'string' ? `'${value}'` : JSON.stringify(value);

/** A TypeScript-like spelling of a schema's type. */
export function typeOf(schema: Schema): string {
  if (Array.isArray(schema.enum)) return schema.enum.map(literal).join(' | ');
  if ('const' in schema) return literal(schema.const);
  for (const keyword of ['anyOf', 'oneOf']) {
    const branches = schema[keyword];
    if (Array.isArray(branches)) return branches.filter(isSchema).map(typeOf).join(' | ');
  }
  switch (schema.type) {
    case 'string':
    case 'boolean':
      return schema.type;
    case 'integer':
    case 'number':
      return 'number';
    case 'array': {
      if (Array.isArray(schema.prefixItems)) {
        const items = schema.prefixItems.filter(isSchema).map(typeOf);
        const min = typeof schema.minItems === 'number' ? schema.minItems : items.length;
        return `[${items.map((item, index) => `${item === '' ? 'unknown' : item}${index >= min ? '?' : ''}`).join(', ')}]`;
      }
      const items = isSchema(schema.items) ? typeOf(schema.items) : 'unknown';
      return items.includes(' ') ? `(${items})[]` : `${items}[]`;
    }
    case 'object':
      if (isSchema(schema.properties)) return 'object';
      if (isSchema(schema.additionalProperties)) {
        return `Record<string, ${typeOf(schema.additionalProperties)}>`;
      }
      return 'object';
    default:
      return 'unknown';
  }
}

function constraints(schema: Schema): string[] {
  const out: string[] = [];
  if (typeof schema.minimum === 'number') out.push(`≥ ${schema.minimum}`);
  if (typeof schema.maximum === 'number') out.push(`≤ ${schema.maximum}`);
  if (schema.minLength === 1) out.push('not empty');
  if (schema.type === 'integer') out.push('integer');
  if (typeof schema.pattern === 'string') out.push(`matches /${schema.pattern}/`);
  return out;
}

/** Object branches whose properties are options of their own (`features.query.framework`). */
function objectBranches(schema: Schema): Schema[] {
  if (isSchema(schema.properties)) return [schema];
  const branches = schema.anyOf ?? schema.oneOf;
  return Array.isArray(branches)
    ? branches.filter(isSchema).filter((branch) => isSchema(branch.properties))
    : [];
}

function walk(schema: Schema, prefix: string, out: ConfigOption[]): void {
  for (const branch of objectBranches(schema)) {
    const properties = branch.properties as Record<string, unknown>;
    const requiredHere = Array.isArray(branch.required) ? (branch.required as string[]) : [];
    for (const [name, value] of Object.entries(properties)) {
      if (!isSchema(value)) continue;
      const path = prefix === '' ? name : `${prefix}.${name}`;
      out.push({
        path,
        type: typeOf(value),
        default: 'default' in value ? JSON.stringify(value.default) : undefined,
        description: typeof value.description === 'string' ? value.description : '',
        required: requiredHere.includes(name),
        constraints: constraints(value),
        codeOnly: false,
      });
      walk(value, path, out);
    }
  }
}

export async function config(): Promise<void> {
  const schema = configJsonSchema();
  const options: ConfigOption[] = [];
  walk(schema, '', options);
  // `hooks` takes functions, so it exists only in TypeScript and JavaScript configs and is left
  // out of the JSON Schema; its hook names come from the same validator.
  options.push({
    path: 'hooks',
    type: 'InlineHooks',
    default: undefined,
    description:
      'Plugin hooks given inline, without writing a plugin. They run like a plugin named `config.hooks`, after the default plugin group.',
    required: false,
    constraints: [],
    codeOnly: true,
  });
  for (const hook of HOOK_NAMES) {
    options.push({
      path: `hooks.${hook}`,
      type: 'function',
      default: undefined,
      description: `The \`${hook}\` hook (see the plugin hooks).`,
      required: false,
      constraints: [],
      codeOnly: true,
    });
  }
  await writeGenerated('config.json', {
    basename: CONFIG_BASENAME,
    extensions: CONFIG_EXTENSIONS,
    envPrefix: ENV_PREFIX,
    env: ENV_OVERRIDES,
    options: options.map((option) => ({
      ...option,
      descriptionHtml: inlineMarkdown(option.description, 'src/config/validate.ts'),
    })),
  });
}
