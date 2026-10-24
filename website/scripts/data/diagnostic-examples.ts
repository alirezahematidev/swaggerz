/**
 * Small inputs that trigger a diagnostic, for the dictionary. Each runs through the compiler at
 * build time; an example that stops reporting its code fails the build.
 */
import type { UserConfig } from '../../../src/config/types.ts';

export interface DiagnosticExample {
  readonly code: string;
  readonly title: string;
  readonly config: UserConfig;
  readonly files: readonly { readonly name: string; readonly content: string }[];
  /** Also run `swaggerz lint`'s rules. */
  readonly lint?: boolean;
  /** How to make the diagnostic go away. */
  readonly fix: string;
}

const spec = (version: '3.0' | '3.1' | '2.0' | '3.2' = '3.1'): UserConfig['spec'] => ({
  version,
  input: './openapi.yaml',
});

const openapi = (body: string, version = '3.1.0'): { name: string; content: string } => ({
  name: 'openapi.yaml',
  content: `openapi: ${version}\ninfo:\n  title: Example\n  version: '1.0'\n${body.trimStart()}`,
});

const pets = (operation: string): string => `paths:
  /pets:
    get:
${operation
  .trim()
  .split('\n')
  .map((line) => `      ${line}`)
  .join('\n')}
`;

export const EXAMPLES: readonly DiagnosticExample[] = [
  {
    code: 'config/invalid',
    title: 'A misspelled option',
    config: { spec: spec(), ouput: { directory: './src/api' } } as unknown as UserConfig,
    files: [openapi('paths: {}')],
    fix: 'Correct the option name; the hint suggests the closest valid one.',
  },
  {
    code: 'spec/version-mismatch',
    title: 'The config expects 3.1, the document is 3.0',
    config: { spec: spec('3.1') },
    files: [openapi('paths: {}', '3.0.3')],
    fix: "Set `spec.version` to the version the document declares, or to `'auto'`.",
  },
  {
    code: 'spec/unquoted-version',
    title: 'A version written as a YAML number',
    config: { spec: spec('3.1') },
    files: [
      {
        name: 'openapi.yaml',
        content: 'openapi: 3.1.0\ninfo:\n  title: Example\n  version: 1.0\npaths: {}\n',
      },
    ],
    fix: "Quote the version (`version: '1.0'`), otherwise YAML reads it as the number 1.",
  },
  {
    code: 'spec/parse-error',
    title: 'Broken YAML',
    config: { spec: spec() },
    files: [{ name: 'openapi.yaml', content: 'openapi: 3.1.0\ninfo:\n  title: [Example\n' }],
    fix: 'Fix the syntax at the reported line and column.',
  },
  {
    code: 'ref/missing-target',
    title: 'A reference to a schema that does not exist',
    config: { spec: spec() },
    files: [
      openapi(`
paths: {}
components:
  schemas:
    Pet:
      type: object
      properties:
        category:
          $ref: '#/components/schemas/Categry'
    Category:
      type: object
`),
    ],
    fix: 'Point the `$ref` at an existing component (here, `Category`).',
  },
  {
    code: 'ref/external-blocked',
    title: 'A remote reference with the default policy',
    config: { spec: spec() },
    files: [
      openapi(`
paths: {}
components:
  schemas:
    Pet:
      $ref: 'https://schemas.example.com/pet.yaml'
`),
    ],
    fix: "Set `spec.refs.external: 'remote'` and add the host to `spec.refs.allowedHosts`, or download the file next to the specification.",
  },
  {
    code: 'ref/circular',
    title: 'Two components that only refer to each other',
    config: { spec: spec() },
    files: [
      openapi(`
paths: {}
components:
  schemas:
    A:
      $ref: '#/components/schemas/B'
    B:
      $ref: '#/components/schemas/A'
`),
    ],
    fix: 'Give one of the schemas a definition of its own; recursion through properties is fine.',
  },
  {
    code: 'schema/nullable-31',
    title: '`nullable` in an OpenAPI 3.1 document',
    config: { spec: spec() },
    files: [
      openapi(`
paths: {}
components:
  schemas:
    Name:
      type: string
      nullable: true
`),
    ],
    fix: "Use `type: [string, 'null']`, the JSON Schema 2020-12 spelling of a nullable type.",
  },
  {
    code: 'schema/unsupported-keyword',
    title: 'A 3.1 keyword in a 3.0 document',
    config: { spec: spec('3.0') },
    files: [
      openapi(
        `
paths: {}
components:
  schemas:
    Shipping:
      type: object
      properties:
        country: { type: string }
      if:
        properties:
          country: { const: US }
      then:
        required: [zip]
`,
        '3.0.3',
      ),
    ],
    fix: 'Move the document to OpenAPI 3.1, or express the rule in the description.',
  },
  {
    code: 'schema/assertion-keyword',
    title: 'A rule TypeScript cannot express',
    config: { spec: spec() },
    files: [
      openapi(`
paths: {}
components:
  schemas:
    NotEmpty:
      type: string
      not:
        const: ''
`),
    ],
    fix: 'Nothing to fix: enable `features.validation` to enforce it at runtime.',
  },
  {
    code: 'schema/enum-type-mismatch',
    title: 'Enum values of the wrong type',
    config: { spec: spec() },
    files: [
      openapi(`
paths: {}
components:
  schemas:
    Status:
      type: string
      enum: [active, 2]
`),
    ],
    fix: 'Make every value match the declared `type`.',
  },
  {
    code: 'schema/array-without-items',
    title: 'An array without `items` in OpenAPI 3.0',
    config: { spec: spec('3.0') },
    files: [
      openapi(
        `
paths: {}
components:
  schemas:
    Tags:
      type: array
`,
        '3.0.3',
      ),
    ],
    fix: 'Declare `items` so the elements get a type instead of `unknown`.',
  },
  {
    code: 'operation/duplicate-id',
    title: 'Two operations with the same operationId',
    config: { spec: spec() },
    files: [
      openapi(`
paths:
  /pets:
    get:
      operationId: listPets
      responses: { '204': { description: Empty } }
  /cats:
    get:
      operationId: listPets
      responses: { '204': { description: Empty } }
`),
    ],
    fix: 'Give every operation its own `operationId`; an overlay can do it for specifications you do not own.',
  },
  {
    code: 'operation/missing-path-parameter',
    title: 'A path template without its parameter',
    config: { spec: spec() },
    files: [
      openapi(`
paths:
  /pets/{petId}:
    get:
      operationId: getPet
      responses: { '204': { description: Empty } }
`),
    ],
    fix: 'Declare `petId` as an `in: path` parameter of the path or the operation.',
  },
  {
    code: 'operation/ignored-header',
    title: 'An `Accept` header parameter',
    config: { spec: spec() },
    files: [
      openapi(
        pets(`
operationId: listPets
parameters:
  - name: Accept
    in: header
    schema: { type: string }
responses: { '204': { description: Empty } }
`),
      ),
    ],
    fix: 'Remove the parameter: OpenAPI 3 describes `Accept` through the response content types.',
  },
  {
    code: 'security/unknown-scheme',
    title: 'A security requirement naming no scheme',
    config: { spec: spec() },
    files: [
      openapi(
        pets(`
operationId: listPets
security:
  - apiKey: []
responses: { '204': { description: Empty } }
`),
      ),
    ],
    fix: 'Declare the scheme under `components.securitySchemes`, or correct its name.',
  },
  {
    code: 'naming/collision',
    title: 'Two operationIds that become the same function name',
    config: { spec: spec() },
    files: [
      openapi(`
paths:
  /pets:
    get:
      operationId: list-pets
      responses: { '204': { description: Empty } }
  /pets/all:
    get:
      operationId: listPets
      responses: { '204': { description: Empty } }
`),
    ],
    fix: 'Rename one of the operations, or choose names with the `operationName` plugin hook.',
  },
  {
    code: 'query/invalid-page-param',
    title: 'An infinite query on a parameter that does not exist',
    config: {
      spec: spec(),
      features: { query: { infinite: { listPets: { pageParam: 'cursor' } } } },
    },
    files: [
      openapi(
        pets(`
operationId: listPets
parameters:
  - name: page
    in: query
    schema: { type: integer }
responses: { '204': { description: Empty } }
`),
      ),
    ],
    fix: 'Name the query parameter that carries the page (here `page`).',
  },
  {
    code: 'query/unknown-target',
    title: 'Invalidating a query that does not exist',
    config: {
      spec: spec(),
      features: { query: { invalidates: { createPet: ['listPet'] } } },
    },
    files: [
      openapi(`
paths:
  /pets:
    get:
      operationId: listPets
      responses: { '204': { description: Empty } }
    post:
      operationId: createPet
      responses: { '204': { description: Empty } }
`),
    ],
    fix: 'Name a query operation or a tag; the hint suggests the closest one.',
  },
  {
    code: 'overlay/no-match',
    title: 'An overlay action whose target matches nothing',
    config: { spec: { ...spec(), overlays: ['./fixes.overlay.yaml'] } },
    files: [
      openapi(
        pets(`
operationId: listPets
responses: { '204': { description: Empty } }
`),
      ),
      {
        name: 'fixes.overlay.yaml',
        content: `overlay: 1.1.0
info: { title: Fixes, version: 1.0.0 }
actions:
  - target: $.paths['/pet'].get
    update: { operationId: listAllPets }
`,
      },
    ],
    fix: 'Update the target: the specification has probably changed since the overlay was written.',
  },
  {
    code: 'overlay/invalid-target',
    title: 'A target that is not RFC 9535 JSONPath',
    config: { spec: { ...spec(), overlays: ['./fixes.overlay.yaml'] } },
    files: [
      openapi('paths: {}'),
      {
        name: 'fixes.overlay.yaml',
        content: `overlay: 1.1.0
info: { title: Fixes, version: 1.0.0 }
actions:
  - target: $.paths[?@.summary =~ 'internal']
    remove: true
`,
      },
    ],
    fix: "Use RFC 9535's own functions instead of other dialects' operators: `$.paths[?search(@.summary, 'internal')]`.",
  },
  {
    code: 'lint/operation-id',
    title: 'An operation without an operationId',
    lint: true,
    config: { spec: spec() },
    files: [
      openapi(
        `
servers: [{ url: 'https://api.example.com' }]
tags: [{ name: pets }]
paths:
  /pets:
    post:
      summary: Add a pet
      tags: [pets]
      responses: { '204': { description: Created } }
`,
      ),
    ],
    fix: 'Add an `operationId`, so the function keeps its name when the path changes.',
  },
  {
    code: 'lint/response-schema',
    title: 'A JSON response without a schema',
    lint: true,
    config: { spec: spec() },
    files: [
      openapi(`
servers: [{ url: 'https://api.example.com' }]
tags: [{ name: pets }]
paths:
  /pets:
    get:
      operationId: listPets
      summary: List pets
      tags: [pets]
      responses:
        '200':
          description: The pets
          content:
            application/json: {}
`),
    ],
    fix: 'Describe the body with a schema; until then the function resolves with `unknown`.',
  },
  {
    code: 'lint/inline-schema',
    title: 'An inline request body',
    lint: true,
    config: { spec: spec() },
    files: [
      openapi(`
servers: [{ url: 'https://api.example.com' }]
tags: [{ name: pets }]
paths:
  /pets:
    post:
      operationId: addPet
      summary: Add a pet
      tags: [pets]
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                name: { type: string }
      responses: { '204': { description: Created } }
`),
    ],
    fix: 'Move the schema to `components.schemas` and reference it, so other operations can share the type.',
  },
  {
    code: 'lint/missing-servers',
    title: 'No server and no base URL',
    lint: true,
    config: { spec: spec() },
    files: [
      openapi(`
tags: [{ name: pets }]
paths:
  /pets:
    get:
      operationId: listPets
      summary: List pets
      tags: [pets]
      responses: { '204': { description: Empty } }
`),
    ],
    fix: 'Declare `servers`, set `client.baseUrl`, or call `client.setConfig({ baseUrl })` at startup.',
  },
];
