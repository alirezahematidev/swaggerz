import type { SchemaIR } from '../../../service/types.ts';
import { cn } from '../lib/cn.ts';
import { href } from '../router.ts';
import { Badge } from './ui/badge.tsx';

export type ModelNames = ReadonlyMap<string, string>;

function constraintText(schema: SchemaIR): string[] {
  const parts: string[] = [];
  if (schema.format !== undefined) parts.push(schema.format);
  const constraints: object | undefined = 'constraints' in schema ? schema.constraints : undefined;
  for (const [key, value] of Object.entries(constraints ?? {}))
    parts.push(`${key} ${String(value)}`);
  if (schema.default !== undefined) parts.push(`default ${JSON.stringify(schema.default)}`);
  return parts;
}

/** One-line type label for a schema. */
export function typeLabel(schema: SchemaIR, names: ModelNames): string {
  const nullable = schema.nullable === true ? ' | null' : '';
  switch (schema.kind) {
    case 'ref':
      return `${names.get(schema.target) ?? schema.target}${nullable}`;
    case 'array':
      return `${typeLabel(schema.items, names)}[]${nullable}`;
    case 'enum':
      return `${schema.values.map((v) => JSON.stringify(v)).join(' | ')}${nullable}`;
    case 'object':
      return schema.properties.length === 0
        ? `Record<string, ${schema.additionalProperties === undefined || schema.additionalProperties === false ? 'unknown' : typeLabel(schema.additionalProperties, names)}>${nullable}`
        : `object${nullable}`;
    case 'union':
      return `${schema.variants.map((v) => typeLabel(v, names)).join(' | ')}${nullable}`;
    case 'intersection':
      return `${schema.members.map((m) => typeLabel(m, names)).join(' & ')}${nullable}`;
    default:
      return `${schema.kind}${nullable}`;
  }
}

export function ModelLink({
  id,
  names,
  className,
}: {
  id: string;
  names: ModelNames;
  className?: string;
}) {
  return (
    <a
      className={cn(
        'model-link rounded-[4px] font-mono text-[12.5px] font-medium text-foreground underline decoration-marigold/70 decoration-[1.5px] underline-offset-[3px] transition-colors hover:bg-highlight hover:decoration-marigold',
        className,
      )}
      href={href({ page: 'models', id })}
    >
      {names.get(id) ?? id}
    </a>
  );
}

function SchemaMeta({ schema }: { schema: SchemaIR }) {
  const meta = constraintText(schema);
  return (
    <>
      {schema.nullable === true && schema.kind === 'ref' ? <Badge>nullable</Badge> : null}
      {schema.deprecated === true ? <Badge tone="warning">deprecated</Badge> : null}
      {schema.readOnly === true ? <Badge tone="outline">read-only</Badge> : null}
      {schema.writeOnly === true ? <Badge tone="outline">write-only</Badge> : null}
      {meta.map((m) => (
        <Badge key={m} tone="info">
          {m}
        </Badge>
      ))}
    </>
  );
}

/** The type of a schema on one line: model links for references, otherwise a label. */
export function TypeCell({ schema, names }: { schema: SchemaIR; names: ModelNames }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {schema.kind === 'ref' ? (
        <ModelLink id={schema.target} names={names} />
      ) : schema.kind === 'array' && schema.items.kind === 'ref' ? (
        <span className="inline-flex items-center font-mono text-[12.5px]">
          <ModelLink id={schema.items.target} names={names} />
          <span className="text-muted-foreground">[]</span>
        </span>
      ) : (
        <code className="font-mono text-[12.5px] break-words text-code-type">
          {typeLabel(schema, names)}
        </code>
      )}
      <SchemaMeta schema={schema} />
    </div>
  );
}

/** Recursive schema viewer. References link to the model explorer instead of expanding. */
export function SchemaView({
  schema,
  names,
  depth = 0,
}: {
  schema: SchemaIR;
  names: ModelNames;
  depth?: number;
}) {
  if (depth > 6) return <TypeCell schema={schema} names={names} />;
  switch (schema.kind) {
    case 'object': {
      if (schema.properties.length === 0) return <TypeCell schema={schema} names={names} />;
      return (
        <div className="flex flex-col">
          <ul className={cn('flex flex-col', depth > 0 && 'mt-2 border-l border-border pl-3.5')}>
            {schema.properties.map((property) => {
              const nested =
                (property.schema.kind === 'object' && property.schema.properties.length > 0) ||
                (property.schema.kind === 'array' &&
                  property.schema.items.kind === 'object' &&
                  property.schema.items.properties.length > 0) ||
                ((property.schema.kind === 'union' || property.schema.kind === 'intersection') &&
                  depth < 4);
              return (
                <li key={property.name} className="border-b border-border/60 py-2.5 last:border-0">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <code className="font-mono text-[12.5px] font-semibold text-foreground">
                      {property.name}
                      {property.required ? (
                        <span className="required ml-0.5 text-danger">
                          <span aria-hidden="true">*</span>
                          <span className="sr-only"> (required)</span>
                        </span>
                      ) : null}
                    </code>
                    {nested ? (
                      <SchemaMetaLine schema={property.schema} names={names} />
                    ) : (
                      <TypeCell schema={property.schema} names={names} />
                    )}
                  </div>
                  {property.schema.description === undefined ? null : (
                    <p className="mt-1 max-w-2xl text-[13px] leading-5 text-muted-foreground">
                      {property.schema.description}
                    </p>
                  )}
                  {nested ? (
                    <SchemaView
                      schema={
                        property.schema.kind === 'array' ? property.schema.items : property.schema
                      }
                      names={names}
                      depth={depth + 1}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
          {schema.additionalProperties !== undefined && schema.additionalProperties !== false ? (
            <div className="pt-2 text-[12.5px] text-muted-foreground">
              Additional properties: <TypeCell schema={schema.additionalProperties} names={names} />
            </div>
          ) : null}
        </div>
      );
    }
    case 'array':
      return (
        <div className="flex flex-col gap-1">
          <TypeCell schema={schema} names={names} />
          {schema.items.kind === 'object' && schema.items.properties.length > 0 ? (
            <SchemaView schema={schema.items} names={names} depth={depth + 1} />
          ) : null}
        </div>
      );
    case 'union':
    case 'intersection': {
      const parts = schema.kind === 'union' ? schema.variants : schema.members;
      const label =
        schema.kind === 'union' ? (schema.combinator === 'anyOf' ? 'Any of' : 'One of') : 'All of';
      return (
        <div
          className={cn('flex flex-col gap-2', depth > 0 && 'mt-2 border-l border-border pl-3.5')}
        >
          <div className="text-[11px] font-medium tracking-wider text-faint-foreground uppercase">
            {label}
          </div>
          <ul className="flex flex-col gap-2">
            {parts.map((part, i) => (
              <li
                key={i}
                className="rounded-lg border border-border bg-surface-sunken/60 px-3 py-2"
              >
                <SchemaView schema={part} names={names} depth={depth + 1} />
              </li>
            ))}
          </ul>
          {schema.kind === 'union' && schema.discriminator !== undefined ? (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-muted-foreground">
              Discriminated by{' '}
              <code className="font-mono text-foreground">{schema.discriminator.propertyName}</code>
              {schema.discriminator.mapping.map((m) => (
                <span key={m.value} className="inline-flex items-center gap-1">
                  <code className="font-mono text-code-string">{JSON.stringify(m.value)}</code>→
                  <ModelLink id={m.target} names={names} />
                </span>
              ))}
            </div>
          ) : null}
        </div>
      );
    }
    default:
      return <TypeCell schema={schema} names={names} />;
  }
}

function SchemaMetaLine({ schema, names }: { schema: SchemaIR; names: ModelNames }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <code className="font-mono text-[12.5px] text-code-type">{typeLabel(schema, names)}</code>
      <SchemaMeta schema={schema} />
    </div>
  );
}
