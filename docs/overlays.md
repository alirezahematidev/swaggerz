# Overlays

Third-party specifications often need small fixes before they generate a good client: a missing `operationId`, a wrong `nullable`, a field typed `string` that is really an `integer`, an internal endpoint you do not want in your client. An [OpenAPI Overlay](https://spec.openapis.org/overlay/latest) describes those fixes in a separate file of ordered actions, so you do not fork the specification and the fixes keep applying when it is updated.

```ts
export default defineConfig({
  spec: {
    version: '3.1',
    input: 'https://api.example.com/openapi.json',
    overlays: ['./overlays/fixes.overlay.yaml'],
  },
});
```

`spec.overlays` lists overlay documents (JSON or YAML; local paths relative to the config file, or `http(s)` URLs) that are applied in order. Each one is applied to the result of the previous one.

## Writing an overlay

```yaml
overlay: 1.1.0
info:
  title: Fixes for the Example API
  version: 1.0.0
actions:
  - target: $.paths['/internal/metrics']
    description: Not for clients.
    remove: true
  - target: $.paths['/pets'].get
    update:
      operationId: listPets
  - target: $.components.schemas.Pet.properties.id
    update:
      type: integer
      format: int64
  - target: $.paths.*.*.parameters[?@.name == 'X-Debug']
    remove: true
  - target: $.paths['/pets'].get.tags
    update: [pets]
```

Every action has a `target`, an [RFC 9535](https://www.rfc-editor.org/rfc/rfc9535) JSONPath query, and one of:

| Field          | Effect on each selected node                                                                                                                                                                                                                                                                                               |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `update`       | Merged into the node. Objects merge recursively: new properties are added, primitives replace primitives, arrays are concatenated, objects merge again; other combinations (an object into a string) are an error. An array node gets an array value concatenated, any other value appended. A primitive node is replaced. |
| `copy`         | (Overlay 1.1) A JSONPath query selecting exactly one node of the document being patched; its value is merged like `update`.                                                                                                                                                                                                |
| `remove: true` | The node is removed from its object or array.                                                                                                                                                                                                                                                                              |

`remove` wins over `update`, and `update` over `copy`. A target that selects nothing changes nothing.

### Reusable actions (Overlay 1.2)

```yaml
overlay: 1.2.0
info: { title: Internal operations, version: 1.0.0 }
components:
  actions:
    internal:
      fields:
        update:
          x-internal: true
          tags: [internal]
actions:
  - $ref: '#/components/actions/internal'
    target: $.paths['/admin/users'].get
  - $ref: '#/components/actions/internal'
    target: $.paths['/admin/audit'].get
```

The fields of the reference itself (`target`, `description`, or an `update` of its own) take precedence over the reusable action's `fields`.

## JSONPath

Targets are RFC 9535 queries: `$.paths['/pets']` (member names with special characters need brackets), `$..description` (any depth), `$.paths.*.get`, `$.tags[0]`, `$.tags[-1]`, slices (`[1:3]`), and filters with comparisons, `&&`, `||`, `!` and the functions `length()`, `count()`, `match()`, `search()` and `value()`:

```text
$.paths.*[?@.deprecated == true]
$.components.schemas[?@.type == 'object' && !@.required]
$..parameters[?match(@.name, 'X-.*')]
```

The implementation passes the [JSONPath Compliance Test Suite](https://github.com/jsonpath-standard/jsonpath-compliance-test-suite). Non-standard extensions that some tools accept (`in`, `=~`, script expressions) are syntax errors: they would not be portable.

## Versions and scope

- **Overlay 1.0, 1.1 and 1.2** are supported. Every version is applied with the 1.1 rules, which clarified 1.0 (array concatenation, primitive targets). A newer 1.x version is applied with a warning; other major versions are rejected.
- **Every specification version**: overlays patch the parsed document before swaggerz reads it, so they work for Swagger 2.0 and OpenAPI 3.0, 3.1 and 3.2 alike.
- Overlays apply to the **root document** (`spec.input`). Documents it references with `$ref` are not patched; target the referencing node, or patch the referenced file's `$ref` itself.
- `extends` is ignored: the config decides which document an overlay applies to.
- Plugins' `beforeParse` hooks receive the patched document.

## Diagnostics and watching

Problems point into the overlay file, with line and column: an invalid JSONPath (`overlay/invalid-target`), a target that matches nothing (`overlay/no-match`, a warning: the specification may have changed since the overlay was written), an incompatible update, a `copy` source that is not exactly one node. See [diagnostics](diagnostics.md). With `--verbose`, `overlay/applied` says how many actions were applied.

Local overlay files are watched by `generate --watch`, the dashboard and the MCP server, like the specification. Remote overlays are fetched with the `spec.fetch` timeout and size limit (configured headers are sent only when the overlay is on the specification's own origin) but not polled.
