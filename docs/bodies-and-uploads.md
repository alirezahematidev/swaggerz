# Request bodies and uploads

Every media type a specification declares for a request body is typed, including form data, multipart uploads, binary bodies and formats swaggerz does not serialize itself.

## One media type

The body is the `body` member of `params`, next to the parameters. JSON bodies are serialized with `JSON.stringify` after dates are encoded:

```ts check=bodies
import { createAccount } from './generated/api';

await createAccount({ body: { name: 'Ada' } });
```

## Several media types

When an operation accepts several media types, `params` becomes a union discriminated by `contentType`. Leaving it out selects the default (the first available of JSON, multipart, form-urlencoded, text and binary); each other media type has a body type of its own, listed in `<Name>Bodies`:

```ts check=bodies
import { createAccount } from './generated/api';

await createAccount({ body: { name: 'Ada' } }); // application/json
await createAccount({ contentType: 'application/x-www-form-urlencoded', body: { name: 'Ada' } });
await createAccount({
  contentType: 'application/xml',
  body: '<account><name>Ada</name></account>',
});
```

XML and other text media types that the runtime does not serialize take the body already serialized: a `string`, `Blob`, `ArrayBuffer` or `ArrayBufferView`.

## Forms

`application/x-www-form-urlencoded` bodies send arrays as repeated fields and nested objects as JSON, unless the property's `encoding` says otherwise: `style: deepObject` sends `metadata[order_id]=6735`, an exploded `form` style sends each property as its own field, and other styles join values with their delimiter.

## Multipart uploads

`multipart/form-data` bodies send `Blob`s, `File`s and bytes as file parts, and arrays as repeated parts:

```ts check=bodies
import { uploadAvatar } from './generated/api';

declare const input: HTMLInputElement; // an <input type="file">
const file = input.files?.[0];
if (file !== undefined)
  await uploadAvatar({ accountId: 'a-1', body: { image: file, caption: 'Me' } });
```

A `File` keeps its name; other binary values are sent as `blob`. Object properties become JSON parts labeled `application/json` (OpenAPI's default), and a property whose `encoding` names one `contentType` is labeled with it.

Bodies made only of fields and files are sent as `FormData`, so the transport sets the multipart boundary. `FormData` can only label a part with a `Content-Type` by turning it into a file upload, so when a part needs one (a JSON object, or an `encoding.contentType`), the runtime writes the multipart body itself, with its own boundary. A `FormData` you build yourself is sent unchanged.

## Binary bodies and responses

`format: binary`, Swagger 2.0 `type: file` and binary media types (`application/octet-stream`, `image/*`, …) are `Blob`s. Request bodies also accept `ArrayBuffer` and typed arrays. Binary responses resolve with a `Blob`; pass `parseAs: 'stream'` to read the body as it arrives instead.

## Limitations

- XML is neither serialized nor parsed: requests take a serialized string, responses return text.
- A wildcard request media type (`*/*`, `text/*`) is never sent as `Content-Type`: JSON bodies go out as `application/json`, other bodies with the transport's default.
- OpenAPI 3.2 positional multipart encoding (`itemEncoding`, `prefixEncoding`) is ignored.
