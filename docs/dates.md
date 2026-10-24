# Dates

JSON has no date type: a `format: date-time` value arrives as a string. By default swaggerz keeps it that way, so the types match the wire exactly and nothing runs at runtime. With `types.dates: 'Date'`, `date` and `date-time` values are `Date` objects in your code, in both directions.

```ts
export default defineConfig({
  spec: { version: '3.1', input: './openapi.yaml' },
  types: { dates: 'Date' },
});
```

## What changes

```ts check=dates
import { getAccount } from './generated/api';

const account = await getAccount({ accountId: 'a-1' });
// `createdAt` is `format: date-time`, `birthday` is `format: date`.
console.log(account.createdAt.toISOString(), account.birthday?.getUTCFullYear());
```

- **Types.** Models, parameters, request bodies and webhook payloads use `Date` wherever the schema says `date` or `date-time`.
- **Responses** are converted after they are parsed (and validated, when validation is on): valid date strings become `Date` objects. Strings that are not valid dates stay strings, so a sloppy server does not lose data.
- **Requests**: bodies and date parameters are encoded before they are validated and serialized. `date-time` values become ISO strings; `date` values become `YYYY-MM-DD` in UTC. Your objects are copied, not modified.
- **Validation** checks the wire format (`z.iso.datetime({ offset: true })` and `z.iso.date()` with Zod, `v.isoTimestamp()` and `v.isoDate()` with Valibot, ISO dates with ArkType), so errors point at the string that was received.

> [!NOTE]
> With the default, `types.dates: 'string'`, nothing about dates runs at runtime: the types match the JSON exactly.

For every model that contains dates, a small module (`dates/<model>.ts`) describes where they are, and a runtime helper of about 1.2 KB walks it. Unions, recursion, arrays, maps and discriminated subtypes are followed.

## When to keep strings

Keep the default when you pass dates straight through (render them, send them back), when you use a date library that parses strings itself, or when you want the smallest client. Converting is worth it when your code computes with dates and you would otherwise parse them at every use.

## Limitations

- A `date` value means a calendar day without a time zone. It is encoded in UTC (`2026-10-23`), so build such `Date`s with `Date.UTC(…)` or `new Date('2026-10-23')`, not from a local midnight.
- Only `format: date` and `format: date-time` are converted; `time`, `duration` and custom formats stay strings.
- Values inside schemas the client cannot see (`additionalProperties: true` without a schema, `{}`) are not converted.
