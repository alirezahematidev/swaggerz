import { findDuplicateSchemas } from '../analysis/graph.ts';
import { isIdentifier, toIdentifier } from '../analysis/naming.ts';
import { INPUT_ID_SUFFIX } from '../analysis/read-write.ts';
import type { ProjectModel } from '../analysis/types.ts';
import type { ResolvedConfig } from '../config/resolved.ts';
import type { Diagnostic, Severity } from '../diagnostics/types.ts';
import {
  wireMethod,
  type MediaTypeIR,
  type OperationIR,
  type SchemaIR,
  type SourceRef,
} from '../ir/types.ts';
import { enrichLocations } from '../loader/locate.ts';
import type { DocumentStore } from '../loader/store.ts';
import { compareStrings, pluralize } from '../utils/strings.ts';
import { LINT_RULES, type LintRuleInfo } from './rules.ts';

export { LINT_RULES, type LintRuleInfo } from './rules.ts';

interface Finding {
  readonly message: string;
  readonly source?: SourceRef;
  readonly operation?: OperationIR;
  readonly hint?: string;
}

type RuleName = (typeof LINT_RULES)[number]['name'];

interface RuleContext {
  readonly project: ProjectModel;
  readonly config: ResolvedConfig;
}

const isSuccess = (status: string): boolean => /^2(\d\d|XX)$/i.test(status) || status === 'default';
const isJson = (mediaType: string): boolean => /[/+]json(;|$)/i.test(mediaType);

/** An inline object schema (directly, or as array items) that gets no model of its own. */
function inlineObject(schema: SchemaIR): boolean {
  if (schema.kind === 'object') return schema.properties.length > 0;
  if (schema.kind === 'array') return inlineObject(schema.items);
  return false;
}

function route(operation: OperationIR): string {
  return `${wireMethod(operation.method)} ${operation.path}`;
}

/** Each rule yields its findings; the shared code adds codes, severities and locations. */
const CHECKS: Readonly<Record<RuleName, (context: RuleContext) => Finding[]>> = {
  'operation-id': ({ project }) =>
    project.operations
      .filter((symbol) => symbol.operation.operationId === undefined)
      .map((symbol) => ({
        message: `${route(symbol.operation)} has no operationId: its function is named "${symbol.name}" after the method and path.`,
        source: symbol.operation.source,
        operation: symbol.operation,
        hint: 'Add an operationId (an overlay can add it to a specification you do not own).',
      })),
  'operation-id-style': ({ project, config }) =>
    project.operations.flatMap((symbol) => {
      const id = symbol.operation.operationId;
      if (id === undefined) return [];
      // The name the configured style makes of the operationId. Suffixes that tell duplicates
      // apart and names chosen by a plugin are not the specification's doing (duplicates are
      // reported as operation/duplicate-id and naming/collision).
      const styled = toIdentifier(id, config.naming.operations);
      if (styled === id) return [];
      const style = config.naming.operations;
      return [
        {
          message: isIdentifier(id)
            ? `operationId "${id}" does not follow naming.operations ('${style}'): the function is exported as "${symbol.name}".`
            : `operationId "${id}" is not a JavaScript identifier; the function is exported as "${symbol.name}".`,
          source: symbol.operation.source,
          operation: symbol.operation,
          hint: isIdentifier(id)
            ? `Rename the operationId to "${styled}", or set naming.operations: 'preserve' to keep operationIds as they are.`
            : `Rename the operationId to "${styled}".`,
        },
      ];
    }),
  'operation-tags': ({ project, config }) =>
    config.output.groupBy === 'none'
      ? []
      : project.operations
          .filter((symbol) => symbol.operation.tags.length === 0)
          .map((symbol) => ({
            message: `${route(symbol.operation)} has no tags: it is generated into the "${symbol.group}" group.`,
            source: symbol.operation.source,
            operation: symbol.operation,
          })),
  'undeclared-tag': ({ project }) => {
    const declared = new Set(project.ir.tags.map((tag) => tag.name));
    const first = new Map<string, OperationIR>();
    for (const symbol of project.operations)
      for (const tag of symbol.operation.tags)
        if (!declared.has(tag) && !first.has(tag)) first.set(tag, symbol.operation);
    return [...first]
      .sort(([a], [b]) => compareStrings(a, b))
      .map(([tag, operation]) => ({
        message: `Tag "${tag}" is used by operations but not declared in the top-level tags.`,
        source: operation.source,
        operation,
        hint: 'Declare it with a description to document the group.',
      }));
  },
  'operation-summary': ({ project }) =>
    project.operations
      .filter(
        (symbol) =>
          symbol.operation.summary === undefined && symbol.operation.description === undefined,
      )
      .map((symbol) => ({
        message: `${route(symbol.operation)} has no summary or description for the JSDoc of "${symbol.name}".`,
        source: symbol.operation.source,
        operation: symbol.operation,
      })),
  'success-response': ({ project }) =>
    project.operations
      .filter((symbol) => !symbol.operation.responses.some((r) => isSuccess(r.status)))
      .map((symbol) => ({
        message: `${route(symbol.operation)} documents no 2xx or default response: "${symbol.name}" resolves with void.`,
        source: symbol.operation.source,
        operation: symbol.operation,
      })),
  'response-schema': ({ project }) =>
    project.operations.flatMap((symbol) =>
      symbol.operation.responses
        .filter((response) => isSuccess(response.status))
        .flatMap((response) =>
          response.contents
            .filter((media) => isJson(media.mediaType) && media.schema.kind === 'unknown')
            .map((media) => ({
              message: `The ${response.status} response of ${route(symbol.operation)} (${media.mediaType}) has no schema: "${symbol.name}" resolves with unknown.`,
              source: response.source,
              operation: symbol.operation,
            })),
        ),
    ),
  'inline-schema': ({ project }) =>
    project.operations.flatMap((symbol) => {
      const operation = symbol.operation;
      const bodies: {
        readonly media: MediaTypeIR;
        readonly what: string;
        readonly source: SourceRef;
      }[] = [
        ...(operation.requestBody?.contents ?? []).map((media) => ({
          media,
          what: 'request body',
          source: operation.requestBody?.source ?? operation.source,
        })),
        ...operation.responses
          .filter((response) => isSuccess(response.status))
          .flatMap((response) =>
            response.contents.map((media) => ({
              media,
              what: `${response.status} response`,
              source: response.source,
            })),
          ),
      ];
      return bodies
        .filter(({ media }) => isJson(media.mediaType) && inlineObject(media.schema))
        .map(({ media, what, source }) => ({
          message: `The ${what} of ${route(operation)} (${media.mediaType}) is an inline object schema: its type is named after "${symbol.name}" and cannot be reused.`,
          source,
          operation,
          hint: 'Move it to components/schemas and reference it.',
        }));
    }),
  'untyped-schema': ({ project }) =>
    project.ir.schemas
      .filter((definition) => definition.schema.kind === 'unknown')
      .map((definition) => ({
        message: `Schema ${definition.name} has no type, properties or composition: it is generated as unknown.`,
        source: definition.source,
      })),
  'duplicate-schema': ({ project }) =>
    findDuplicateSchemas(project.ir).flatMap((group) => {
      const definitions = group.flatMap((id) => {
        const definition = project.ir.schemas.find((d) => d.id === id);
        return definition === undefined ? [] : [definition];
      });
      const [first, ...rest] = definitions;
      if (first === undefined || rest.length === 0) return [];
      return [
        {
          message: `Schemas ${definitions.map((d) => d.name).join(', ')} are structurally identical: the client contains ${pluralize(definitions.length, 'duplicate type')}.`,
          source: first.source,
          hint: 'Reference one schema from the others.',
        },
      ];
    }),
  'unused-model': ({ project, config }) => {
    if (config.output.models === 'used') return [];
    const used = project.graph.usedSchemas();
    // Request bodies reference the request-side variant (`<id>~input`) of a schema with readOnly
    // or writeOnly properties: the schema itself is then used too, and reported once at most.
    return project.models
      .filter(
        (model) =>
          !model.id.endsWith(INPUT_ID_SUFFIX) &&
          !used.has(model.id) &&
          !used.has(`${model.id}${INPUT_ID_SUFFIX}`),
      )
      .map((model) => ({
        message: `Schema ${model.definition.name} is not used by any operation but is generated as ${model.name}.`,
        source: model.definition.source,
        hint: "Set output.models: 'used' to generate only the models operations use, or remove the schema if nothing else references it (including references the generator does not follow, such as contentSchema).",
      }));
  },
  'missing-servers': ({ project, config }) =>
    project.ir.servers.length > 0 || config.client.baseUrl !== undefined
      ? []
      : [
          {
            message: 'The specification declares no server: the client has no default base URL.',
            hint: 'Add a server, set client.baseUrl, or call client.setConfig({ baseUrl }) at runtime.',
          },
        ],
};

/** Severity of each rule after `lint.rules`; `undefined` when the rule is turned off. */
export function ruleSeverities(config: ResolvedConfig): Map<string, Severity | undefined> {
  const severities = new Map<string, Severity | undefined>();
  for (const rule of LINT_RULES as readonly LintRuleInfo[]) {
    const configured = config.lint.rules[rule.name];
    severities.set(rule.name, configured === 'off' ? undefined : (configured ?? rule.severity));
  }
  return severities;
}

/**
 * Runs the lint rules on a compiled project. Findings are diagnostics with the code
 * `lint/<rule>`, located in the specification when the store of the compilation is given.
 */
export function lintProject(
  project: ProjectModel,
  config: ResolvedConfig,
  store?: DocumentStore,
): Diagnostic[] {
  const severities = ruleSeverities(config);
  const diagnostics: Diagnostic[] = [];
  for (const rule of LINT_RULES) {
    const severity = severities.get(rule.name);
    if (severity === undefined) continue;
    for (const finding of CHECKS[rule.name]({ project, config })) {
      const file =
        finding.source === undefined
          ? config.spec.input
          : (store?.byDisplay(finding.source.file)?.location ?? finding.source.file);
      diagnostics.push({
        code: `lint/${rule.name}`,
        severity,
        message: finding.message,
        location: {
          file,
          ...(finding.source === undefined ? {} : { pointer: finding.source.pointer }),
        },
        ...(finding.operation === undefined
          ? {}
          : {
              operation: `${route(finding.operation)}${finding.operation.operationId === undefined ? '' : ` (${finding.operation.operationId})`}`,
            }),
        ...(finding.hint === undefined ? {} : { hint: finding.hint }),
      });
    }
  }
  return store === undefined ? diagnostics : enrichLocations(diagnostics, store);
}
