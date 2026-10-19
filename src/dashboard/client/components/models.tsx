import { useMemo, useState } from 'preact/hooks';
import type { ModelDetail, ModelSummary } from '../../api-types.ts';
import { useResource } from '../api.ts';
import { filterModels, type ModelFilter } from '../filters.ts';
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
  type ModelNames,
} from './ui.tsx';

const PAGE_SIZE = 300;

export function ModelsPage({
  models,
  selected,
  names,
  version,
}: {
  models: readonly ModelSummary[];
  selected?: string;
  names: ModelNames;
  version: number;
}) {
  const [filter, setFilter] = useState<ModelFilter>({ query: '', show: 'all' });
  const [limit, setLimit] = useState(PAGE_SIZE);
  const results = useMemo(() => filterModels(models, filter), [models, filter]);
  return (
    <div class="split">
      <aside class="list-pane" aria-label="Models">
        <div class="filters">
          <input
            type="search"
            class="input"
            placeholder="Search models"
            name="model-search"
            aria-label="Search models"
            value={filter.query}
            onInput={(e) => {
              setFilter({ ...filter, query: e.currentTarget.value });
              setLimit(PAGE_SIZE);
            }}
          />
          <select
            class="input"
            name="model-filter"
            aria-label="Filter models"
            value={filter.show}
            onChange={(e) => {
              setFilter({ ...filter, show: e.currentTarget.value as ModelFilter['show'] });
            }}
          >
            <option value="all">All models</option>
            <option value="used">Used by operations</option>
            <option value="unused">Not used by any operation</option>
            <option value="recursive">Recursive</option>
          </select>
          <div class="muted small" aria-live="polite">
            {results.length} of {models.length} models
          </div>
        </div>
        {results.length === 0 ? (
          <Empty>No models match.</Empty>
        ) : (
          <ul class="list">
            {results.slice(0, limit).map((model) => (
              <li key={model.id}>
                <a
                  class={`list-item ${model.id === selected ? 'active' : ''}`}
                  href={href({ page: 'models', id: model.id })}
                  aria-current={model.id === selected ? 'page' : undefined}
                >
                  <span class="row">
                    <strong>{model.name}</strong>
                    {model.used ? null : <Badge tone="warn">unused</Badge>}
                    {model.recursive ? <Badge tone="info">recursive</Badge> : null}
                  </span>
                  <span class="muted small">{model.kind}</span>
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
            Show more
          </button>
        ) : null}
      </aside>
      <div class="detail-pane">
        {selected === undefined ? (
          <Empty>Select a model to inspect its properties, relations and generated code.</Empty>
        ) : (
          <ModelView id={selected} names={names} version={version} />
        )}
      </div>
    </div>
  );
}

function Links({
  links,
  names,
  empty,
}: {
  links: readonly { id: string }[];
  names: ModelNames;
  empty: string;
}) {
  if (links.length === 0) return <span class="muted">{empty}</span>;
  return (
    <span class="wrap">
      {links.map((link) => (
        <ModelLink key={link.id} id={link.id} names={names} />
      ))}
    </span>
  );
}

function ModelView({ id, names, version }: { id: string; names: ModelNames; version: number }) {
  const resource = useResource<ModelDetail>(`/api/model?id=${encodeURIComponent(id)}`, version);
  return (
    <Async resource={resource}>
      {(detail) => {
        const schema = detail.definition.schema;
        return (
          <article class="page">
            <header class="page-header">
              <div class="row">
                <h1>{detail.summary.name}</h1>
                {detail.summary.used ? null : <Badge tone="warn">unused</Badge>}
                {detail.summary.recursive ? <Badge tone="info">recursive</Badge> : null}
                {detail.summary.deprecated ? <Badge tone="warn">deprecated</Badge> : null}
              </div>
              <div class="muted">{detail.summary.kind}</div>
              <Prose text={schema.description ?? schema.title} />
            </header>
            <dl class="meta">
              <dt>Module</dt>
              <dd>
                <code>{detail.summary.module}</code>
              </dd>
              {detail.aliases.length === 0 ? null : (
                <>
                  <dt>Aliases</dt>
                  <dd>{detail.aliases.join(', ')}</dd>
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

            <Section title="Schema">
              {schema.kind === 'enum' ? (
                <div class="wrap">
                  {schema.values.map((value) => (
                    <code key={JSON.stringify(value)} class="pill">
                      {JSON.stringify(value)}
                    </code>
                  ))}
                </div>
              ) : (
                <SchemaView schema={schema} names={names} />
              )}
            </Section>

            <Section title="Relations">
              <dl class="meta">
                <dt>References</dt>
                <dd>
                  <Links links={detail.references} names={names} empty="none" />
                </dd>
                <dt>Referenced by models</dt>
                <dd>
                  <Links links={detail.referencedBy} names={names} empty="none" />
                </dd>
                <dt>Possible duplicates</dt>
                <dd>
                  <Links links={detail.duplicates} names={names} empty="none" />
                </dd>
              </dl>
            </Section>

            <Section title={`Used by operations (${detail.usedBy.length})`}>
              {detail.usedBy.length === 0 ? (
                <Empty>No operation references this model, directly or indirectly.</Empty>
              ) : (
                <ul class="deps">
                  {detail.usedBy.map((op) => (
                    <li key={op.key}>
                      <a href={href({ page: 'operations', key: op.key })} class="row">
                        <MethodBadge method={op.method} />
                        <code>{op.path}</code>
                      </a>
                      <span class="muted small">
                        {op.chain.length > 1
                          ? ` via ${op.chain.slice(0, -1).join(' → ')}`
                          : ' direct'}
                      </span>
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
