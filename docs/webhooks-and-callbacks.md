# Webhooks and callbacks

Webhooks (OpenAPI 3.1 and later) and callbacks (3.0 and later) describe requests the **API sends to you**. swaggerz generates types for the receiving side, so the route handler you write is checked against the specification.

```ts check=webhooks
import type { AccountClosedWebhookHandler } from './generated/api';

export const onAccountClosed: AccountClosedWebhookHandler = async ({ body, headers }) => {
  if (headers['x-signature'] === '') return { received: false };
  console.log('closed', body.id);
  return { received: true };
};
```

For every webhook, `webhooks/<webhook>.ts` exports:

| Type                    | What it describes                                         |
| ----------------------- | --------------------------------------------------------- |
| `<Name>WebhookPayload`  | The request body the API sends                            |
| `<Name>WebhookRequest`  | `body`, and the declared `headers` and `query` parameters |
| `<Name>WebhookResponse` | The body your handler sends back                          |
| `<Name>WebhookHandler`  | `(request) => response`, sync or async                    |

Header names are lowercase, as Node.js and `fetch` expose them. Callbacks get the same types, named after their operation and callback: `CreateAccountAccountEventCallbackHandler` in `callbacks/create-account-account-event.ts`. Everything is exported from the main barrel.

## Wiring a handler

No server code is generated: the types fit any framework. Turn the incoming request into the handler's input and send back what it returns, for example with the web-standard `Request` and `Response` that Node.js, Deno, Bun and edge runtimes share:

```ts check=webhooks
import type { AccountClosedWebhookHandler, AccountClosedWebhookRequest } from './generated/api';

export function route(handler: AccountClosedWebhookHandler) {
  return async (request: Request): Promise<Response> => {
    const input: AccountClosedWebhookRequest = {
      body: (await request.json()) as AccountClosedWebhookRequest['body'],
      headers: { 'x-signature': request.headers.get('x-signature') ?? '' },
    };
    return Response.json(await handler(input));
  };
}
```

The cast is the trust boundary: the types say what the API promises, not what arrived. With `features.validation`, parse the body with its schema (`AccountSchema.parse(...)`) instead.

The payload comes from the API, so it is typed like a response: `readOnly` properties are kept and `writeOnly` ones left out. Your handler's response goes back to the API, so it is typed like a request body (the `…Input` variant, see [read and write models](read-write-models.md)). `output.webhooks: false` turns the types off.

## Limitations

- Types only: no routing, signature verification or server adapters are generated.
- The generated types describe requests; nothing checks at runtime that a request really came from the API.
