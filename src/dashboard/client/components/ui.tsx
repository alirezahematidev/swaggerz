import type { ComponentChildren } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import type { CodeVariant, Diagnostic, SchemaIR } from '../../api-types.ts';
import type { Resource } from '../api.ts';
import { tokenize } from '../filters.ts';
import { href } from '../router.ts';

export function MethodBadge({ method }: { method: string }) {
  return <span class={`method method-${method.toLowerCase()}`}>{method}</span>;
}

export function Badge({
  children,
  tone = 'neutral',
  title,
}: {
  children: ComponentChildren;
  tone?: 'neutral' | 'warn' | 'danger' | 'ok' | 'info';
  title?: string;
}) {
  return (
    <span class={`badge badge-${tone}`} {...(title === undefined ? {} : { title })}>
      {children}
    </span>
  );
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div class="state" role="status" aria-live="polite">
      <span class="spinner" aria-hidden="true" />
      {label}
    </div>
  );
}

export function ErrorState({ error }: { error: Error }) {
  return (
    <div class="state state-error" role="alert">
      <strong>Something went wrong.</strong> {error.message}
    </div>
  );
}

export function Empty({ children }: { children: ComponentChildren }) {
  return <div class="state state-empty">{children}</div>;
}

/** Renders loading and error states around a resource. */
export function Async<T>({
  resource,
  children,
}: {
  resource: Resource<T>;
  children: (data: T) => ComponentChildren;
}) {
  if (resource.state === 'loading') return <Loading />;
  if (resource.state === 'error') return <ErrorState error={resource.error} />;
  return <>{children(resource.data)}</>;
}

export function Section({
  title,
  children,
  actions,
  id,
}: {
  title: string;
  children: ComponentChildren;
  actions?: ComponentChildren;
  id?: string;
}) {
  return (
    <section class="section" {...(id === undefined ? {} : { 'aria-labelledby': id })}>
      <div class="section-header">
        <h2 {...(id === undefined ? {} : { id })}>{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

/** Multi-paragraph text from the specification, rendered as plain (escaped) text. */
export function Prose({ text }: { text: string | undefined }) {
  if (text === undefined || text.trim() === '') return null;
  return (
    <div class="prose">
      {text
        .trim()
        .split(/\n\s*\n/)
        .map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
    </div>
  );
}

export function Code({ code, label }: { code: string; label?: string }) {
  const tokens = useMemo(() => tokenize(code), [code]);
  return (
    <pre class="code" tabIndex={0} {...(label === undefined ? {} : { 'aria-label': label })}>
      <code>
        {tokens.map((token, index) =>
          token.kind === 'text' ? (
            token.text
          ) : (
            <span key={index} class={`tok-${token.kind}`}>
              {token.text}
            </span>
          ),
        )}
      </code>
    </pre>
  );
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: readonly { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
  label: string;
}) {
  return (
    <div class="tabs" role="tablist" aria-label={label}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={tab.id === value}
          class={tab.id === value ? 'tab active' : 'tab'}
          onClick={() => {
            onChange(tab.id);
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function CodeViewer({ variants }: { variants: readonly CodeVariant[] }) {
  const [index, setIndex] = useState(0);
  const current = variants[Math.min(index, variants.length - 1)];
  if (current === undefined) return <Empty>No generated code.</Empty>;
  const ids = variants.map((_, i) => String(i));
  return (
    <div class="code-viewer">
      <Tabs
        label="Generated code"
        tabs={variants.map((variant, i) => ({
          id: ids[i] ?? '0',
          label: `${variant.label} · ${variant.path}`,
        }))}
        value={String(Math.min(index, variants.length - 1))}
        onChange={(id) => {
          setIndex(Number(id));
        }}
      />
      <Code code={current.content} label={current.path} />
    </div>
  );
}

const SEVERITY_TONE = { error: 'danger', warning: 'warn', info: 'info' } as const;

export function DiagnosticsList({
  diagnostics,
  limit = 200,
}: {
  diagnostics: readonly Diagnostic[];
  limit?: number;
}) {
  const [severity, setSeverity] = useState<'all' | 'error' | 'warning' | 'info'>('all');
  const shown = diagnostics.filter((d) => severity === 'all' || d.severity === severity);
  if (diagnostics.length === 0)
    return <Empty>No diagnostics. The specification was processed cleanly.</Empty>;
  return (
    <div>
      <Tabs
        label="Severity"
        value={severity}
        onChange={setSeverity}
        tabs={[
          { id: 'all', label: `All (${diagnostics.length})` },
          {
            id: 'error',
            label: `Errors (${diagnostics.filter((d) => d.severity === 'error').length})`,
          },
          {
            id: 'warning',
            label: `Warnings (${diagnostics.filter((d) => d.severity === 'warning').length})`,
          },
          {
            id: 'info',
            label: `Notes (${diagnostics.filter((d) => d.severity === 'info').length})`,
          },
        ]}
      />
      <ul class="diagnostics">
        {shown.slice(0, limit).map((d, i) => (
          <li key={i} class={`diagnostic diagnostic-${d.severity}`}>
            <div class="diagnostic-head">
              <Badge tone={SEVERITY_TONE[d.severity]}>{d.severity}</Badge>
              <code class="muted">{d.code}</code>
            </div>
            <div>{d.message}</div>
            {d.location === undefined ? null : (
              <div class="muted small">
                {d.location.file.split('/').at(-1)}
                {d.location.line === undefined ? '' : `:${d.location.line}`}
                {d.location.pointer === undefined || d.location.pointer === ''
                  ? ''
                  : ` · #${d.location.pointer}`}
              </div>
            )}
            {d.operation === undefined ? null : <div class="muted small">in {d.operation}</div>}
            {d.hint === undefined ? null : <div class="hint">{d.hint}</div>}
          </li>
        ))}
      </ul>
      {shown.length > limit ? (
        <p class="muted">
          Showing {limit} of {shown.length}.
        </p>
      ) : null}
    </div>
  );
}

export type ModelNames = ReadonlyMap<string, string>;

function constraintText(schema: SchemaIR): string[] {
  const parts: string[] = [];
  if (schema.format !== undefined) parts.push(schema.format);
  const constraints: object | undefined = 'constraints' in schema ? schema.constraints : undefined;
  for (const [key, value] of Object.entries(constraints ?? {}))
    parts.push(`${key}: ${String(value)}`);
  if (schema.default !== undefined) parts.push(`default: ${JSON.stringify(schema.default)}`);
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

export function ModelLink({ id, names }: { id: string; names: ModelNames }) {
  return (
    <a class="model-link" href={href({ page: 'models', id })}>
      {names.get(id) ?? id}
    </a>
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
  const meta = constraintText(schema);
  const header = (
    <div class="schema-head">
      {schema.kind === 'ref' ? (
        <ModelLink id={schema.target} names={names} />
      ) : (
        <code class="type">{typeLabel(schema, names)}</code>
      )}
      {schema.nullable === true && schema.kind === 'ref' ? <Badge>nullable</Badge> : null}
      {schema.deprecated === true ? <Badge tone="warn">deprecated</Badge> : null}
      {schema.readOnly === true ? <Badge>read-only</Badge> : null}
      {schema.writeOnly === true ? <Badge>write-only</Badge> : null}
      {meta.map((m) => (
        <Badge key={m} tone="info">
          {m}
        </Badge>
      ))}
    </div>
  );
  if (depth > 6) return header;
  switch (schema.kind) {
    case 'object':
      if (schema.properties.length === 0) return header;
      return (
        <div class="schema">
          {depth === 0 ? null : header}
          <table class="table props">
            <thead>
              <tr>
                <th scope="col">Property</th>
                <th scope="col">Type</th>
                <th scope="col">Description</th>
              </tr>
            </thead>
            <tbody>
              {schema.properties.map((property) => (
                <tr key={property.name}>
                  <td>
                    <code>{property.name}</code>
                    {property.required ? (
                      <span class="required" title="required">
                        *
                      </span>
                    ) : null}
                  </td>
                  <td>
                    {property.schema.kind === 'object' && property.schema.properties.length > 0 ? (
                      <SchemaView schema={property.schema} names={names} depth={depth + 1} />
                    ) : (
                      <SchemaView schema={property.schema} names={names} depth={7} />
                    )}
                  </td>
                  <td class="muted">{property.schema.description ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {schema.additionalProperties !== undefined && schema.additionalProperties !== false ? (
            <div class="muted small">
              Additional properties: {typeLabel(schema.additionalProperties, names)}
            </div>
          ) : null}
        </div>
      );
    case 'array':
      return (
        <div class="schema">
          {header}
          {schema.items.kind === 'object' && schema.items.properties.length > 0 ? (
            <div class="nested">
              <SchemaView schema={schema.items} names={names} depth={depth + 1} />
            </div>
          ) : null}
        </div>
      );
    case 'union':
    case 'intersection': {
      const parts = schema.kind === 'union' ? schema.variants : schema.members;
      const label =
        schema.kind === 'union' ? (schema.combinator === 'anyOf' ? 'Any of' : 'One of') : 'All of';
      return (
        <div class="schema">
          {depth === 0 ? null : header}
          <div class="muted small">{label}</div>
          <ul class="variants">
            {parts.map((part, i) => (
              <li key={i}>
                <SchemaView schema={part} names={names} depth={depth + 1} />
              </li>
            ))}
          </ul>
          {schema.kind === 'union' && schema.discriminator !== undefined ? (
            <div class="small">
              Discriminated by <code>{schema.discriminator.propertyName}</code>:{' '}
              {schema.discriminator.mapping.map((m) => (
                <span key={m.value} class="mapping">
                  <code>{m.value}</code> → <ModelLink id={m.target} names={names} />
                </span>
              ))}
            </div>
          ) : null}
        </div>
      );
    }
    default:
      return header;
  }
}
