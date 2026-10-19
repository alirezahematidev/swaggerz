/**
 * Builds a deterministic, realistic OpenAPI 3.0 document of configurable size for tree-shaking
 * tests and benchmarks: `resources` resource groups, each with CRUD operations, a model with nested
 * references, an enum, an input model and shared paging/error models.
 */
export interface LargeSpecOptions {
  /** Number of resource groups. Each contributes 5 operations and 3 models. */
  readonly resources: number;
}

export function largeSpec(options: LargeSpecOptions): Record<string, unknown> {
  const paths: Record<string, unknown> = {};
  const schemas: Record<string, unknown> = {
    Error: {
      type: 'object',
      required: ['code', 'message'],
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
        details: { type: 'array', items: { type: 'string' } },
      },
    },
    PageInfo: {
      type: 'object',
      required: ['total'],
      properties: { total: { type: 'integer' }, nextCursor: { type: 'string', nullable: true } },
    },
  };
  const error = {
    description: 'Error',
    content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
  };
  for (let i = 0; i < options.resources; i++) {
    const name = `Resource${i}`;
    const tag = `resources-${i}`;
    const related = i > 0 ? `Resource${i - 1}` : undefined;
    schemas[name] = {
      type: 'object',
      description: `A ${name}.`,
      required: ['id', 'name', 'status'],
      properties: {
        id: { type: 'string', format: 'uuid', readOnly: true },
        name: { type: 'string', minLength: 1, maxLength: 120 },
        status: { $ref: `#/components/schemas/${name}Status` },
        createdAt: { type: 'string', format: 'date-time' },
        tags: { type: 'array', items: { type: 'string' } },
        attributes: { type: 'object', additionalProperties: { type: 'string' } },
        ...(related === undefined ? {} : { parent: { $ref: `#/components/schemas/${related}` } }),
      },
    };
    schemas[`${name}Status`] = { type: 'string', enum: ['active', 'archived', 'pending'] };
    schemas[`${name}Input`] = {
      type: 'object',
      required: ['name'],
      properties: { name: { type: 'string' }, tags: { type: 'array', items: { type: 'string' } } },
    };
    const item = { $ref: `#/components/schemas/${name}` };
    paths[`/${tag}`] = {
      get: {
        operationId: `list${name}`,
        tags: [tag],
        summary: `List ${name} items.`,
        parameters: [
          { name: 'cursor', in: 'query', schema: { type: 'string' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 } },
          { name: 'status', in: 'query', schema: { $ref: `#/components/schemas/${name}Status` } },
        ],
        responses: {
          '200': {
            description: 'A page.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['items', 'page'],
                  properties: {
                    items: { type: 'array', items: item },
                    page: { $ref: '#/components/schemas/PageInfo' },
                  },
                },
              },
            },
          },
          default: error,
        },
      },
      post: {
        operationId: `create${name}`,
        tags: [tag],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: `#/components/schemas/${name}Input` } },
          },
        },
        responses: {
          '201': { description: 'Created.', content: { 'application/json': { schema: item } } },
          default: error,
        },
      },
    };
    paths[`/${tag}/{id}`] = {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      get: {
        operationId: `get${name}`,
        tags: [tag],
        responses: {
          '200': { description: 'The item.', content: { 'application/json': { schema: item } } },
          '404': error,
        },
      },
      put: {
        operationId: `update${name}`,
        tags: [tag],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: `#/components/schemas/${name}Input` } },
          },
        },
        responses: {
          '200': { description: 'Updated.', content: { 'application/json': { schema: item } } },
          default: error,
        },
      },
      delete: {
        operationId: `delete${name}`,
        tags: [tag],
        responses: { '204': { description: 'Deleted.' }, default: error },
      },
    };
  }
  return {
    openapi: '3.0.3',
    info: { title: 'Large API', version: '1.0.0' },
    servers: [{ url: 'https://api.example.com' }],
    paths,
    components: { schemas },
  };
}
