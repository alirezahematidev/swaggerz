/**
 * The rules of `swaggerz lint`. Each one reports something in the specification that changes the
 * generated client: names derived from paths, types that end up `unknown`, documentation that is
 * missing from the JSDoc. Style rules that do not affect the output are out of scope (Spectral and
 * Redocly cover them). Findings are diagnostics with the code `lint/<name>`.
 */
export interface LintRuleInfo {
  readonly name: string;
  /** Severity unless `lint.rules` overrides it. */
  readonly severity: 'info' | 'warning' | 'error';
  /** What the rule reports and why it matters for the generated client. */
  readonly summary: string;
}

export const LINT_RULES = [
  {
    name: 'operation-id',
    severity: 'warning',
    summary:
      'An operation has no operationId: its function name is derived from the method and path and changes when the path does.',
  },
  {
    name: 'operation-id-style',
    severity: 'info',
    summary:
      'An operationId is not a valid identifier in the configured naming style, so the generated function has another name (searching for the operationId does not find it).',
  },
  {
    name: 'operation-tags',
    severity: 'info',
    summary: 'An operation has no tags: it is generated into the `default` group.',
  },
  {
    name: 'undeclared-tag',
    severity: 'info',
    summary:
      'A tag used by operations is not declared in the top-level `tags`, so it has no description for the group documentation.',
  },
  {
    name: 'operation-summary',
    severity: 'info',
    summary:
      'An operation has neither a summary nor a description: its JSDoc only says which endpoint it calls.',
  },
  {
    name: 'success-response',
    severity: 'warning',
    summary:
      'An operation documents no 2xx (or default) response: the generated function resolves with `void` whatever the server returns.',
  },
  {
    name: 'response-schema',
    severity: 'warning',
    summary:
      'A success response declares a media type without a schema: the generated function resolves with `unknown`.',
  },
  {
    name: 'inline-schema',
    severity: 'info',
    summary:
      'A JSON request or response body is an inline object schema: its type is named after the operation (`AddPetBody`) and cannot be reused by other operations.',
  },
  {
    name: 'untyped-schema',
    severity: 'info',
    summary: 'A named schema has no type, properties or composition: it is generated as `unknown`.',
  },
  {
    name: 'duplicate-schema',
    severity: 'info',
    summary: 'Named schemas are structurally identical: the client contains duplicate types.',
  },
  {
    name: 'unused-model',
    severity: 'info',
    summary:
      'A named schema is not used by any operation: it is still generated unless `output.models` is `used`.',
  },
  {
    name: 'missing-servers',
    severity: 'info',
    summary:
      'The specification declares no server: the generated client has no default base URL and needs `client.baseUrl` or `client.setConfig({ baseUrl })`.',
  },
] as const satisfies readonly LintRuleInfo[];
