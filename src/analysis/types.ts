import type { ApiDocument, OperationIR, SchemaDefinition, WebhookIR } from '../ir/types.ts';
import type { DependencyGraph } from './graph.ts';

/**
 * Result of semantic analysis: the IR plus resolved names, module layout and the dependency
 * graph. Stability: **experimental** (exposed to plugins).
 */
export interface ProjectModel {
  readonly ir: ApiDocument;
  readonly graph: DependencyGraph;
  /** Sorted by group, then name. */
  readonly operations: readonly OperationSymbol[];
  /** Sorted by name. */
  readonly models: readonly ModelSymbol[];
  readonly operationByKey: ReadonlyMap<string, OperationSymbol>;
  readonly modelById: ReadonlyMap<string, ModelSymbol>;
  /** React Query key factories per operation group (empty when React Query is disabled). */
  readonly reactQueryGroups: readonly ReactQueryGroup[];
  /** Webhooks and callbacks (empty when `output.webhooks` is false), sorted by module. */
  readonly webhooks: readonly WebhookSymbol[];
}

/** One request the API sends: an operation of a webhook or of an operation's callback. */
export interface WebhookSymbol {
  readonly kind: 'webhook' | 'callback';
  /** The operation key. */
  readonly key: string;
  readonly operation: OperationIR;
  readonly webhook: WebhookIR;
  /** Callbacks: key of the operation that declares the callback. */
  readonly owner?: string;
  /** Module path relative to the output directory, shared by the operations of one webhook. */
  readonly module: string;
  readonly typeNames: {
    /** The request body the API sends. */
    readonly payload: string;
    /** Body, headers and query parameters of the request. */
    readonly request: string;
    /** The response body the API expects back. */
    readonly response: string;
    readonly handler: string;
  };
}

export interface ReactQueryGroup {
  readonly group: string;
  /** Module path of the group's key factory, e.g. `react-query/pet/keys`. */
  readonly module: string;
  /** Exported key factory name, e.g. `petKeys`. */
  readonly name: string;
  /** Root key shared by every query of the group, e.g. `['pet']`. */
  readonly prefix: readonly string[];
}

export interface OperationSymbol {
  readonly key: string;
  readonly operation: OperationIR;
  /** Exported function name, e.g. `getPetById`. */
  readonly name: string;
  /** Group directory (kebab-case tag) or `''` when grouping is disabled. */
  readonly group: string;
  /** Module path relative to the output directory, without extension. */
  readonly module: string;
  readonly typeNames: {
    readonly params: string;
    readonly body: string;
    readonly response: string;
    /** Everything the operation rejects with: its {@link apiError} union or a `RequestError`. */
    readonly error: string;
    /** Union of one `ApiError<Body, Status>` per documented error status, plus undeclared ones. */
    readonly apiError: string;
    readonly errorBody: string;
    /** Map of media type → body type; only when the request body offers several media types. */
    readonly bodies?: string;
  };
  /** Type guard narrowing an unknown error to the operation's `apiError` union. */
  readonly errorGuard: string;
  /** Parameter property name for each parameter (index-aligned with `operation.parameters`). */
  readonly parameterProperties: readonly string[];
  /** Property holding the request body inside the params object. */
  readonly bodyProperty: string;
  /** Property selecting the request media type (used when the body offers several). */
  readonly contentTypeProperty: string;
  readonly reactQuery?: {
    readonly module: string;
    readonly hook: string;
    /** Static query key prefix, e.g. `['pet', 'getPetById']`. */
    readonly keyPrefix: readonly string[];
    readonly queryKey?: string;
    readonly queryKeyType?: string;
    readonly queryOptions?: string;
    readonly infiniteHook?: string;
    readonly infiniteQueryKey?: string;
    readonly infiniteQueryKeyType?: string;
    readonly infiniteQueryOptions?: string;
    readonly pageParamType?: string;
    /** Wire name of the query parameter that receives the page parameter. */
    readonly pageParam?: string;
    readonly mutationOptions?: string;
  };
}

export interface ModelSymbol {
  readonly id: string;
  readonly definition: SchemaDefinition;
  /** Exported type name. */
  readonly name: string;
  /** Module path relative to the output directory, without extension. */
  readonly module: string;
  /** Exported alias names (from `SchemaDefinition.aliases`). */
  readonly aliases: readonly string[];
  /** Whether any operation (transitively) references this model. */
  readonly used: boolean;
  /** Zod schema constant name, when validation is enabled. */
  readonly zodName?: string;
  readonly zodModule?: string;
  /** `types.dates: 'Date'`: name and module of the model's date shape, if it contains dates. */
  readonly datesName?: string;
  readonly datesModule?: string;
}
