import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type {
  OperationDetail,
  OperationSummary,
  ParameterLocationName,
  ResponseLike,
} from './types.ts';
import { useResource } from '../api.ts';
import { filterOperations, type OperationFilter } from '../filters.ts';
import { href } from '../router.ts';
import {
  Async,
  Badge,
  CodeViewer,
  Empty,
  MethodBadge,
  ModelLink,
  Prose,
  SchemaView,
  Section,
  Tabs,
  type ModelNames,
} from './ui.tsx';

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'TRACE'];
const PAGE_SIZE = 200;

export function OperationsPage({
  operations,
  selected,
  names,
  version,
}: {
  operations: readonly OperationSummary[];
  selected?: string;
  names: ModelNames;
  version: number;
}) {
  const [filter, setFilter] = useState<OperationFilter>({
    query: '',
    methods: [],
    tag: '',
    deprecated: 'all',
  });
  const [limit, setLimit] = useState(PAGE_SIZE);
  const search = useRef<HTMLInputElement>(null);
  const tags = useMemo(
    () =>
      [
        ...new Set(operations.flatMap((op) => (op.tags.length === 0 ? ['default'] : op.tags))),
      ].sort(),
    [operations],
  );
  const methods = useMemo(
    () => METHODS.filter((m) => operations.some((op) => op.method === m)),
    [operations],
  );
  const results = useMemo(() => filterOperations(operations, filter), [operations, filter]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        event.preventDefault();
        search.current?.focus();
      }
    };
    addEventListener('keydown', onKey);
    return () => {
      removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <div class="split">
      <aside class="list-pane" aria-label="Operations">
        <div class="filters">
          <input
            ref={search}
            type="search"
            class="input"
            placeholder="Search operations, paths, tags, models  ( / )"
            name="operation-search"
            aria-label="Search operations"
            value={filter.query}
            onInput={(e) => {
              setFilter({ ...filter, query: e.currentTarget.value });
              setLimit(PAGE_SIZE);
            }}
          />
          <div class="chips" role="group" aria-label="Filter by method">
            {methods.map((method) => {
              const active = filter.methods.includes(method);
              return (
                <button
                  key={method}
                  type="button"
                  class={`chip ${active ? 'active' : ''}`}
                  aria-pressed={active}
                  onClick={() => {
                    setFilter({
                      ...filter,
                      methods: active
                        ? filter.methods.filter((m) => m !== method)
                        : [...filter.methods, method],
                    });
                  }}
                >
                  {method}
                </button>
              );
            })}
          </div>
          <div class="row">
            <select
              class="input"
              name="tag"
              aria-label="Filter by tag"
              value={filter.tag}
              onChange={(e) => {
                setFilter({ ...filter, tag: e.currentTarget.value });
              }}
            >
              <option value="">All tags</option>
              {tags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
            <select
              class="input"
              name="deprecated"
              aria-label="Deprecated operations"
              value={filter.deprecated}
              onChange={(e) => {
                setFilter({
                  ...filter,
                  deprecated: e.currentTarget.value as OperationFilter['deprecated'],
                });
              }}
            >
              <option value="all">Any status</option>
              <option value="hide">Hide deprecated</option>
              <option value="only">Only deprecated</option>
            </select>
          </div>
          <div class="muted small" aria-live="polite">
            {results.length} of {operations.length} operations
          </div>
        </div>
        {results.length === 0 ? (
          <Empty>No operations match the filters.</Empty>
        ) : (
          <ul class="list">
            {results.slice(0, limit).map((op) => (
              <li key={op.key}>
                <a
                  class={`list-item ${op.key === selected ? 'active' : ''}`}
                  href={href({ page: 'operations', key: op.key })}
                  aria-current={op.key === selected ? 'page' : undefined}
                >
                  <span class="row">
                    <MethodBadge method={op.method} />
                    <code class="path">{op.path}</code>
                  </span>
                  <span class="row small">
                    <span>{op.name}</span>
                    {op.deprecated ? <Badge tone="warn">deprecated</Badge> : null}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
        {results.length > limit ? (
          <button
            type="button"
            class="button ghost"
            onClick={() => {
              setLimit(limit + PAGE_SIZE);
            }}
          >
            Show more ({results.length - limit} remaining)
          </button>
        ) : null}
      </aside>
      <div class="detail-pane">
        {selected === undefined ? (
          <Empty>Select an operation to inspect its parameters, schemas and generated code.</Empty>
        ) : (
          <OperationView operationKey={selected} names={names} version={version} />
        )}
      </div>
    </div>
  );
}

const LOCATIONS: readonly ParameterLocationName[] = ['path', 'query', 'header', 'cookie'];

function Responses({
  responses,
  names,
}: {
  responses: readonly ResponseLike[];
  names: ModelNames;
}) {
  return (
    <div class="stack">
      {responses.map((response) => (
        <div key={response.status} class="response">
          <div class="row">
            <Badge
              tone={
                /^2/.test(response.status)
                  ? 'ok'
                  : response.status === 'default'
                    ? 'neutral'
                    : 'danger'
              }
            >
              {response.status}
            </Badge>
            <span>{response.description ?? ''}</span>
          </div>
          {response.headers.length === 0 ? null : (
            <table class="table small">
              <thead>
                <tr>
                  <th scope="col">Header</th>
                  <th scope="col">Type</th>
                  <th scope="col">Description</th>
                </tr>
              </thead>
              <tbody>
                {response.headers.map((header) => (
                  <tr key={header.name}>
                    <td>
                      <code>{header.name}</code>
                    </td>
                    <td>
                      <SchemaView schema={header.schema} names={names} depth={7} />
                    </td>
                    <td class="muted">{header.description ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {response.contents.map((content) => (
            <div key={content.mediaType} class="media">
              <div class="muted small">{content.mediaType}</div>
              <SchemaView schema={content.schema} names={names} />
              <Examples examples={content.examples} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function Examples({
  examples,
}: {
  examples: readonly { name?: string; value?: unknown; summary?: string }[];
}) {
  const withValues = examples.filter((example) => example.value !== undefined);
  if (withValues.length === 0) return null;
  return (
    <details class="examples">
      <summary>Examples ({withValues.length})</summary>
      {withValues.map((example, index) => (
        <div key={index}>
          {example.name === undefined ? null : (
            <div class="muted small">{example.summary ?? example.name}</div>
          )}
          <pre class="code">{JSON.stringify(example.value, null, 2)}</pre>
        </div>
      ))}
    </details>
  );
}

function OperationView({
  operationKey,
  names,
  version,
}: {
  operationKey: string;
  names: ModelNames;
  version: number;
}) {
  const resource = useResource<OperationDetail>(
    `/api/operation?key=${encodeURIComponent(operationKey)}`,
    version,
  );
  const [bodyType, setBodyType] = useState(0);
  return (
    <Async resource={resource}>
      {(detail) => {
        const op = detail.operation;
        const body = op.requestBody;
        const media = body?.contents[Math.min(bodyType, (body.contents.length || 1) - 1)];
        return (
          <article class="page">
            <header class="page-header">
              <div class="row">
                <MethodBadge method={detail.summary.method} />
                <h1 class="path-title">
                  <code>{op.path}</code>
                </h1>
              </div>
              <div class="row">
                <code class="symbol">{detail.summary.name}()</code>
                {op.deprecated ? <Badge tone="warn">deprecated</Badge> : null}
                {op.tags.map((tag) => (
                  <Badge key={tag}>{tag}</Badge>
                ))}
              </div>
              {op.summary === undefined ? null : <p class="lead">{op.summary}</p>}
              <Prose text={op.description} />
            </header>

            <dl class="meta">
              <dt>Operation ID</dt>
              <dd>
                {op.operationId === undefined ? (
                  <span class="muted">none (name derived from path)</span>
                ) : (
                  <code>{op.operationId}</code>
                )}
              </dd>
              <dt>Module</dt>
              <dd>
                <code>{detail.summary.module}</code>
              </dd>
              <dt>Types</dt>
              <dd class="wrap">
                {Object.values(detail.typeNames).map((name) => (
                  <code key={name} class="pill">
                    {name}
                  </code>
                ))}
              </dd>
              {detail.hooks.length === 0 ? null : (
                <>
                  <dt>React Query</dt>
                  <dd class="wrap">
                    {detail.hooks.map((hook) => (
                      <code key={hook} class="pill">
                        {hook}
                      </code>
                    ))}
                  </dd>
                </>
              )}
              <dt>Authentication</dt>
              <dd class="wrap">
                {detail.security.length === 0 ? (
                  <span class="muted">none</span>
                ) : (
                  detail.security.map((scheme) => (
                    <Badge
                      key={scheme.key}
                      tone="info"
                      {...(scheme.description === undefined ? {} : { title: scheme.description })}
                    >
                      {scheme.key} · {scheme.type}
                    </Badge>
                  ))
                )}
              </dd>
              {detail.request.mediaType === undefined ? null : (
                <>
                  <dt>Request body</dt>
                  <dd>
                    <code>{detail.request.mediaType}</code>
                  </dd>
                </>
              )}
              {detail.request.accept === undefined ? null : (
                <>
                  <dt>Accept</dt>
                  <dd>
                    <code>{detail.request.accept}</code>
                  </dd>
                </>
              )}
              <dt>Source</dt>
              <dd>
                <code>
                  {detail.source.file}
                  {detail.source.line === undefined ? '' : `:${detail.source.line}`}
                </code>{' '}
                <span class="muted small">#{detail.source.pointer}</span>
              </dd>
            </dl>

            <Section title="Parameters">
              {op.parameters.length === 0 ? (
                <Empty>No parameters.</Empty>
              ) : (
                LOCATIONS.filter((location) => op.parameters.some((p) => p.in === location)).map(
                  (location) => (
                    <div key={location}>
                      <h3 class="subhead">{location}</h3>
                      <table class="table">
                        <thead>
                          <tr>
                            <th scope="col">Name</th>
                            <th scope="col">Type</th>
                            <th scope="col">Description</th>
                          </tr>
                        </thead>
                        <tbody>
                          {op.parameters
                            .filter((p) => p.in === location)
                            .map((parameter) => (
                              <tr key={parameter.name}>
                                <td>
                                  <code>{parameter.name}</code>
                                  {parameter.required ? (
                                    <span class="required" title="required">
                                      *
                                    </span>
                                  ) : null}
                                  {parameter.deprecated ? (
                                    <Badge tone="warn">deprecated</Badge>
                                  ) : null}
                                  {parameter.style !==
                                  (location === 'query' || location === 'cookie'
                                    ? 'form'
                                    : 'simple') ? (
                                    <div class="muted small">style: {parameter.style}</div>
                                  ) : null}
                                </td>
                                <td>
                                  <SchemaView schema={parameter.schema} names={names} depth={7} />
                                </td>
                                <td class="muted">{parameter.description ?? ''}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  ),
                )
              )}
            </Section>

            {body === undefined ? null : (
              <Section title={`Request body${body.required ? ' (required)' : ''}`}>
                <Prose text={body.description} />
                {body.contents.length > 1 ? (
                  <Tabs
                    label="Request media type"
                    tabs={body.contents.map((c, i) => ({ id: String(i), label: c.mediaType }))}
                    value={String(Math.min(bodyType, body.contents.length - 1))}
                    onChange={(id) => {
                      setBodyType(Number(id));
                    }}
                  />
                ) : (
                  <div class="muted small">{media?.mediaType}</div>
                )}
                {media === undefined ? null : (
                  <>
                    <SchemaView schema={media.schema} names={names} />
                    <Examples examples={media.examples} />
                  </>
                )}
              </Section>
            )}

            <Section title="Responses">
              <Responses responses={op.responses} names={names} />
            </Section>

            <Section title={`Model dependencies (${detail.dependencies.length})`}>
              {detail.dependencies.length === 0 ? (
                <Empty>This operation does not reference named models.</Empty>
              ) : (
                <ul class="deps">
                  {detail.dependencies.map((dep) => (
                    <li key={dep.id}>
                      <ModelLink id={dep.id} names={names} />
                      {dep.chain.length > 1 ? (
                        <span class="muted small"> via {dep.chain.slice(0, -1).join(' → ')}</span>
                      ) : (
                        <span class="muted small"> direct</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Generated code">
              <CodeViewer variants={detail.code} />
            </Section>
          </article>
        );
      }}
    </Async>
  );
}
