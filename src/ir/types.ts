/**
 * Normalized intermediate representation (IR).
 *
 * Every supported specification version is converted into this shape by a version-specific
 * adapter. Code generators, the dashboard and plugins consume only the IR; none of them read raw
 * Swagger/OpenAPI documents.
 *
 * Stability: **experimental**. The IR is exposed to plugins and may change in minor releases
 * before 1.0. Changes are recorded in the changelog and `IR_VERSION` is incremented.
 */

export const IR_VERSION = 2;

export type SpecVersion = '2.0' | '3.0' | '3.1';

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

/** Vendor extensions (`x-*` keys) preserved verbatim. */
export type Extensions = Readonly<Record<string, JsonValue>>;

/** Points back to the original document that produced an IR node. */
export interface SourceRef {
  /** Document path relative to the root specification's directory, or an absolute URL. */
  readonly file: string;
  /** JSON pointer inside that document. */
  readonly pointer: string;
}

export interface ApiDocument {
  readonly irVersion: typeof IR_VERSION;
  readonly specVersion: SpecVersion;
  /** The version string exactly as declared, e.g. `3.0.3`. */
  readonly specVersionRaw: string;
  readonly info: ApiInfo;
  readonly servers: readonly ServerIR[];
  /** Sorted by path, then by HTTP method order. */
  readonly operations: readonly OperationIR[];
  /** Named schemas sorted by id. */
  readonly schemas: readonly SchemaDefinition[];
  /** Requests the API sends to its consumers (OpenAPI 3.1 `webhooks`), sorted by name. */
  readonly webhooks: readonly WebhookIR[];
  readonly securitySchemes: readonly SecuritySchemeIR[];
  /** Document-level security requirements, applied when an operation declares none. */
  readonly security: readonly SecurityRequirementIR[];
  readonly tags: readonly TagIR[];
  readonly externalDocs?: ExternalDocsIR;
  readonly extensions: Extensions;
  /** All documents that contributed to this IR (root first). */
  readonly sources: readonly string[];
}

export interface ApiInfo {
  readonly title: string;
  readonly version: string;
  readonly summary?: string;
  readonly description?: string;
  readonly termsOfService?: string;
  readonly contact?: { readonly name?: string; readonly url?: string; readonly email?: string };
  readonly license?: { readonly name: string; readonly url?: string; readonly identifier?: string };
}

export interface ServerIR {
  readonly url: string;
  readonly description?: string;
  readonly variables: Readonly<
    Record<
      string,
      { readonly default: string; readonly enum?: readonly string[]; readonly description?: string }
    >
  >;
}

export interface TagIR {
  readonly name: string;
  readonly description?: string;
  readonly externalDocs?: ExternalDocsIR;
}

export interface ExternalDocsIR {
  readonly url: string;
  readonly description?: string;
}

export type HttpMethod = 'get' | 'put' | 'post' | 'delete' | 'options' | 'head' | 'patch' | 'trace';

export const HTTP_METHODS: readonly HttpMethod[] = [
  'get',
  'put',
  'post',
  'delete',
  'options',
  'head',
  'patch',
  'trace',
];

export interface OperationIR {
  /** Stable, unique key: `${method} ${path}`, e.g. `get /pets/{petId}`. */
  readonly key: string;
  /** The original `operationId`, if declared. */
  readonly operationId?: string;
  readonly method: HttpMethod;
  readonly path: string;
  readonly summary?: string;
  readonly description?: string;
  readonly tags: readonly string[];
  readonly deprecated: boolean;
  /** Path-item and operation parameters merged, in declaration order. */
  readonly parameters: readonly ParameterIR[];
  readonly requestBody?: RequestBodyIR;
  /** Sorted by status code; `default` last. */
  readonly responses: readonly ResponseIR[];
  /** `undefined` inherits {@link ApiDocument.security}; an empty array disables auth. */
  readonly security?: readonly SecurityRequirementIR[];
  readonly servers?: readonly ServerIR[];
  readonly externalDocs?: ExternalDocsIR;
  /** Requests the API sends back while or after handling this operation (OpenAPI 3.x). */
  readonly callbacks?: readonly WebhookIR[];
  readonly extensions: Extensions;
  readonly source: SourceRef;
}

/**
 * A request the API sends to its consumers: a webhook, or a callback of an operation. Its
 * operations describe the incoming request (parameters, body) and the expected responses.
 */
export interface WebhookIR {
  /** Key under `webhooks`, or the callback name. */
  readonly name: string;
  /** Callbacks: the runtime expression of the target URL, e.g. `{$request.body#/callbackUrl}`. */
  readonly expression?: string;
  /** One per HTTP method. `path` is the expression for callbacks and empty for webhooks. */
  readonly operations: readonly OperationIR[];
}

export type ParameterLocation = 'path' | 'query' | 'header' | 'cookie';

/**
 * Serialization styles. `tabDelimited` exists only to preserve Swagger 2.0 `collectionFormat: tsv`.
 */
export type ParameterStyle =
  | 'matrix'
  | 'label'
  | 'form'
  | 'simple'
  | 'spaceDelimited'
  | 'pipeDelimited'
  | 'tabDelimited'
  | 'deepObject';

export interface ParameterIR {
  readonly name: string;
  readonly in: ParameterLocation;
  readonly required: boolean;
  readonly deprecated: boolean;
  readonly description?: string;
  readonly schema: SchemaIR;
  readonly style: ParameterStyle;
  readonly explode: boolean;
  readonly allowReserved: boolean;
  /** Set when the parameter uses `content` instead of `schema`; the value is serialized with it. */
  readonly contentType?: string;
  readonly examples: readonly ExampleIR[];
  readonly extensions: Extensions;
  readonly source: SourceRef;
}

export interface ExampleIR {
  readonly name?: string;
  readonly summary?: string;
  readonly description?: string;
  readonly value?: JsonValue;
  readonly externalValue?: string;
}

export interface RequestBodyIR {
  readonly required: boolean;
  readonly description?: string;
  /** Media types in declaration order. */
  readonly contents: readonly MediaTypeIR[];
  readonly extensions: Extensions;
  readonly source: SourceRef;
}

export interface MediaTypeIR {
  readonly mediaType: string;
  readonly schema: SchemaIR;
  readonly examples: readonly ExampleIR[];
  readonly encoding?: Readonly<Record<string, EncodingIR>>;
}

export interface EncodingIR {
  readonly contentType?: string;
  readonly style?: ParameterStyle;
  readonly explode?: boolean;
}

export interface ResponseIR {
  /** `200`, `2XX` or `default`. */
  readonly status: string;
  readonly description?: string;
  readonly contents: readonly MediaTypeIR[];
  readonly headers: readonly HeaderIR[];
  readonly extensions: Extensions;
  readonly source: SourceRef;
}

export interface HeaderIR {
  readonly name: string;
  readonly required: boolean;
  readonly deprecated: boolean;
  readonly description?: string;
  readonly schema: SchemaIR;
}

export type SecuritySchemeIR =
  | (SecuritySchemeBase & {
      readonly type: 'apiKey';
      readonly in: 'header' | 'query' | 'cookie';
      readonly name: string;
    })
  | (SecuritySchemeBase & {
      readonly type: 'http';
      /** Lowercased scheme, e.g. `bearer` or `basic`. */
      readonly scheme: string;
      readonly bearerFormat?: string;
    })
  | (SecuritySchemeBase & { readonly type: 'oauth2'; readonly flows: OAuthFlowsIR })
  | (SecuritySchemeBase & { readonly type: 'openIdConnect'; readonly openIdConnectUrl: string })
  | (SecuritySchemeBase & { readonly type: 'mutualTLS' });

interface SecuritySchemeBase {
  /** Key under `components.securitySchemes` / `securityDefinitions`. */
  readonly key: string;
  readonly description?: string;
  readonly extensions: Extensions;
  readonly source: SourceRef;
}

export interface OAuthFlowsIR {
  readonly implicit?: OAuthFlowIR;
  readonly password?: OAuthFlowIR;
  readonly clientCredentials?: OAuthFlowIR;
  readonly authorizationCode?: OAuthFlowIR;
}

export interface OAuthFlowIR {
  readonly authorizationUrl?: string;
  readonly tokenUrl?: string;
  readonly refreshUrl?: string;
  readonly scopes: Readonly<Record<string, string>>;
}

/** All schemes in one requirement must be satisfied together. An empty object means "optional". */
export type SecurityRequirementIR = Readonly<Record<string, readonly string[]>>;

/** A schema that can be referenced by name. */
export interface SchemaDefinition {
  /**
   * Stable identifier: `<document>#<pointer>` where `<document>` is empty for the root document,
   * e.g. `#/components/schemas/Pet` or `schemas/common.yaml#/Error`.
   */
  readonly id: string;
  /** Preferred original name (component key, title or file name); naming conventions apply later. */
  readonly name: string;
  /** Additional component names that refer to the same schema through a pure `$ref`. */
  readonly aliases: readonly string[];
  readonly schema: SchemaIR;
  readonly source: SourceRef;
}

export interface SchemaMeta {
  readonly nullable?: boolean;
  readonly title?: string;
  readonly description?: string;
  readonly deprecated?: boolean;
  readonly readOnly?: boolean;
  readonly writeOnly?: boolean;
  readonly default?: JsonValue;
  readonly examples?: readonly JsonValue[];
  readonly format?: string;
  /** Constraints TypeScript types cannot express; generated Zod schemas enforce them. */
  readonly assertions?: SchemaAssertions;
  readonly extensions?: Extensions;
  readonly source?: SourceRef;
}

/**
 * JSON Schema keywords that restrict values without changing their shape (`not`,
 * `if`/`then`/`else`, `dependentSchemas`, `dependentRequired`).
 */
export interface SchemaAssertions {
  readonly not?: SchemaIR;
  /** `if`, `then` and `else` (renamed so the object is never mistaken for a promise). */
  readonly conditional?: {
    readonly condition: SchemaIR;
    readonly whenTrue?: SchemaIR;
    readonly whenFalse?: SchemaIR;
  };
  /** Property name → schema the whole object must satisfy when the property is present. */
  readonly dependentSchemas?: Readonly<Record<string, SchemaIR>>;
  /** Property name → properties required when it is present. */
  readonly dependentRequired?: Readonly<Record<string, readonly string[]>>;
}

export interface StringConstraints {
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly pattern?: string;
  readonly contentMediaType?: string;
  readonly contentEncoding?: string;
}

export interface NumberConstraints {
  readonly minimum?: number;
  readonly maximum?: number;
  readonly exclusiveMinimum?: number;
  readonly exclusiveMaximum?: number;
  readonly multipleOf?: number;
}

export interface ArrayConstraints {
  readonly minItems?: number;
  readonly maxItems?: number;
  readonly uniqueItems?: boolean;
}

export interface ObjectConstraints {
  readonly minProperties?: number;
  readonly maxProperties?: number;
}

export interface PropertyIR {
  readonly name: string;
  readonly required: boolean;
  readonly schema: SchemaIR;
}

export interface DiscriminatorIR {
  readonly propertyName: string;
  /** Discriminator value → definition id. Includes implicit mappings. */
  readonly mapping: readonly { readonly value: string; readonly target: string }[];
}

export type SchemaIR =
  | RefSchema
  | StringSchema
  | NumberSchema
  | BooleanSchema
  | NullSchema
  | EnumSchema
  | ArraySchema
  | ObjectSchema
  | UnionSchema
  | IntersectionSchema
  | BinarySchema
  | UnknownSchema
  | NeverSchema;

export interface RefSchema extends SchemaMeta {
  readonly kind: 'ref';
  /** {@link SchemaDefinition.id} of the referenced schema. */
  readonly target: string;
}

export interface StringSchema extends SchemaMeta {
  readonly kind: 'string';
  readonly constraints?: StringConstraints;
}

export interface NumberSchema extends SchemaMeta {
  readonly kind: 'number' | 'integer';
  readonly constraints?: NumberConstraints;
}

export interface BooleanSchema extends SchemaMeta {
  readonly kind: 'boolean';
}

export interface NullSchema extends SchemaMeta {
  readonly kind: 'null';
}

export interface EnumSchema extends SchemaMeta {
  readonly kind: 'enum';
  readonly values: readonly JsonValue[];
  /** True when produced from `const`. */
  readonly isConst?: boolean;
}

export interface ArraySchema extends SchemaMeta {
  readonly kind: 'array';
  readonly items: SchemaIR;
  /** Tuple prefix (`prefixItems`); `items` describes the rest. */
  readonly prefixItems?: readonly SchemaIR[];
  readonly constraints?: ArrayConstraints;
}

export interface ObjectSchema extends SchemaMeta {
  readonly kind: 'object';
  readonly properties: readonly PropertyIR[];
  /**
   * `undefined` when not declared (no index signature is generated), `false` when closed,
   * otherwise the schema of additional property values.
   */
  readonly additionalProperties?: SchemaIR | false;
  /** Schema discriminator for allOf-based polymorphism declared on this object. */
  readonly discriminator?: DiscriminatorIR;
  readonly constraints?: ObjectConstraints;
}

export interface UnionSchema extends SchemaMeta {
  readonly kind: 'union';
  readonly variants: readonly SchemaIR[];
  readonly combinator: 'oneOf' | 'anyOf' | 'type';
  readonly discriminator?: DiscriminatorIR;
}

export interface IntersectionSchema extends SchemaMeta {
  readonly kind: 'intersection';
  readonly members: readonly SchemaIR[];
}

/** Raw bytes: `format: binary`, Swagger `type: file`, or binary `contentMediaType`. */
export interface BinarySchema extends SchemaMeta {
  readonly kind: 'binary';
}

export interface UnknownSchema extends SchemaMeta {
  readonly kind: 'unknown';
}

export interface NeverSchema extends SchemaMeta {
  readonly kind: 'never';
}

export type SchemaKind = SchemaIR['kind'];
