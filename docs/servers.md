# Servers

An OpenAPI document lists the servers an API runs on, for the whole API and, if needed, for single paths or operations. swaggerz compiles the first top-level server into the client as its base URL, and sends operations that declare their own servers to theirs.

## The base URL

```ts check
import { client } from './generated/api';

// At startup, for example from the environment the app runs in.
client.setConfig({ baseUrl: 'https://staging.example.com/api/v3' });
```

> [!NOTE]
> A base URL passed per call (`{ baseUrl }` in the options) always wins, over the client's and over an operation's own server.

The compiled default is the specification's first server with its variables replaced by their defaults; `client.baseUrl` in the config replaces it. Relative server URLs (`/v1`) of a specification loaded from a URL are resolved against that URL, as OpenAPI specifies, and a Swagger 2.0 document without `host` uses the host it was loaded from.

For environment-specific URLs, prefer `setConfig` at runtime over the compiled default: the generated code then stays identical across environments.

## Operation and path servers

An operation (or path) with its own `servers` is sent to its first server, ignoring the client's `baseUrl`:

```yaml
paths:
  /files/{name}:
    servers:
      - url: https://uploads.example.com
    put:
      operationId: uploadFile
```

```ts check=servers
import { uploadFile } from './generated/api';

const bytes = new Blob(['hello']);
await uploadFile({ name: 'hello.txt', body: bytes }); // PUT https://uploads.example.com/files/hello.txt
await uploadFile({ name: 'hello.txt', body: bytes }, { baseUrl: 'http://localhost:9000' }); // a per-call baseUrl wins
```

`client.operationServers: false` (in the config, or with `setConfig` at runtime) sends everything to the client's base URL instead, for example to route all traffic through one proxy.

## Several environments or tenants

Create a client per base URL and pass it per call:

```ts check
import { client, createClient, getPetById } from './generated/api';

const eu = createClient({ ...client.getConfig(), baseUrl: 'https://eu.example.com/api/v3' });
await getPetById({ petId: 10 }, { client: eu });
```

## Limitations

- Only the first server of a list is used; there is no failover between servers.
- Server variables are replaced by their defaults at generation time; to use another value, set the base URL at runtime.
