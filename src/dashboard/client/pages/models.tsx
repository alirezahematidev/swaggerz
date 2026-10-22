import { Boxes, Code2, GitFork, ListTree, Route } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import type { ModelDetail, ModelSummary } from '../../../service/types.ts';
import { ApiRequestError, useResource } from '../api.ts';
import { Async } from '../components/async.tsx';
import { ChangeBadge } from '../components/change.tsx';
import { CodeViewer } from '../components/code.tsx';
import { MetaList, Mono } from '../components/page.tsx';
import { Prose } from '../components/prose.tsx';
import { ModelLink, SchemaView, type ModelNames } from '../components/schema.tsx';
import { ListItem, ListPane, SplitLayout } from '../components/split.tsx';
import { Badge } from '../components/ui/badge.tsx';
import { Button } from '../components/ui/button.tsx';
import { SearchInput } from '../components/ui/input.tsx';
import { MethodBadge } from '../components/ui/method.tsx';
import { Select } from '../components/ui/select.tsx';
import { Empty } from '../components/ui/states.tsx';
import { TabCount, Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs.tsx';
import { filterModels, type ModelFilter } from '../filters.ts';
import { href } from '../router.ts';

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
  const list = (
    <ListPane
      filters={
        <>
          <div className="flex items-baseline justify-between">
            <h1 className="font-display text-[20px] font-semibold">Models</h1>
            <span className="text-[12px] tabular-nums text-muted-foreground" aria-live="polite">
              {results.length === models.length
                ? models.length
                : `${results.length} of ${models.length}`}
            </span>
          </div>
          <SearchInput
            name="model-search"
            aria-label="Search models"
            placeholder="Search models"
            value={filter.query}
            onChange={(e) => {
              setFilter({ ...filter, query: e.currentTarget.value });
              setLimit(PAGE_SIZE);
            }}
          />
          <Select<ModelFilter['show']>
            size="sm"
            label="Filter models"
            value={filter.show}
            onValueChange={(show) => {
              setFilter({ ...filter, show });
            }}
            options={[
              { value: 'all', label: 'All models', hint: models.length },
              {
                value: 'used',
                label: 'Used by operations',
                hint: models.filter((m) => m.used).length,
              },
              {
                value: 'unused',
                label: 'Not used by any operation',
                hint: models.filter((m) => !m.used).length,
              },
              {
                value: 'recursive',
                label: 'Recursive',
                hint: models.filter((m) => m.recursive).length,
              },
            ]}
          />
        </>
      }
    >
      {results.length === 0 ? (
        <Empty>No models match.</Empty>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {results.slice(0, limit).map((model) => (
            <li key={model.id}>
              <ListItem
                href={href({ page: 'models', id: model.id })}
                active={model.id === selected}
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="mr-0.5 truncate font-mono text-[13px] font-medium">
                    {model.name}
                  </span>
                  <ChangeBadge change={model.change} />
                  {model.used ? null : <Badge tone="warning">unused</Badge>}
                  {model.recursive ? <Badge tone="info">recursive</Badge> : null}
                </span>
                <span className="text-[12px] text-muted-foreground">
                  {model.kind}
                  {model.usedBy > 0
                    ? ` · used by ${model.usedBy} operation${model.usedBy === 1 ? '' : 's'}`
                    : ''}
                </span>
              </ListItem>
            </li>
          ))}
        </ul>
      )}
      {results.length > limit ? (
        <div className="p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => {
              setLimit(limit + PAGE_SIZE);
            }}
          >
            Show more
          </Button>
        </div>
      ) : null}
    </ListPane>
  );
  return (
    <SplitLayout
      list={list}
      selection={selected}
      backHref={href({ page: 'models' })}
      backLabel="All models"
      detail={
        selected === undefined ? (
          <div className="flex min-h-[60vh] items-center justify-center">
            <Empty icon={<Boxes />} className="max-lg:hidden">
              Select a model to inspect its properties, relations and generated code.
            </Empty>
          </div>
        ) : (
          <ModelView id={selected} names={names} version={version} />
        )
      }
    />
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
  if (links.length === 0) return <span className="text-muted-foreground">{empty}</span>;
  return (
    <span className="flex flex-wrap gap-x-3 gap-y-1">
      {links.map((link) => (
        <ModelLink key={link.id} id={link.id} names={names} />
      ))}
    </span>
  );
}

/** Shown when the selected model disappeared in a reload. */
function removed(error: Error): ReactNode {
  if (!(error instanceof ApiRequestError) || error.status !== 404) return undefined;
  return (
    <Empty icon={<Boxes />} className="min-h-[50vh]">
      This model no longer exists in the specification. It was removed or renamed while the
      dashboard was running.
    </Empty>
  );
}

function ModelView({ id, names, version }: { id: string; names: ModelNames; version: number }) {
  const resource = useResource<ModelDetail>(`/api/model?id=${encodeURIComponent(id)}`, version);
  const [tab, setTab] = useState('schema');
  return (
    <Async resource={resource} error={removed}>
      {(detail) => {
        const schema = detail.definition.schema;
        return (
          <article className="flex max-w-5xl flex-col gap-7">
            <header className="flex flex-col gap-3">
              <div className="text-[12px] font-medium tracking-wide text-muted-foreground">
                {detail.summary.kind}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="font-display text-[30px] leading-tight font-semibold break-all">
                  {detail.summary.name}
                </h1>
                <ChangeBadge change={detail.summary.change} />
                {detail.summary.used ? null : <Badge tone="warning">unused</Badge>}
                {detail.summary.recursive ? <Badge tone="info">recursive</Badge> : null}
                {detail.summary.deprecated ? <Badge tone="warning">deprecated</Badge> : null}
              </div>
              <Prose text={schema.description ?? schema.title} />
            </header>
            <div className="rounded-xl border border-border bg-surface px-5 py-4 shadow-card">
              <MetaList
                items={[
                  ['Module', <Mono key="m">{detail.summary.module}</Mono>],
                  detail.aliases.length > 0 && ['Aliases', detail.aliases.join(', ')],
                  [
                    'Source',
                    <span key="s" className="flex flex-wrap items-center gap-2">
                      <Mono>
                        {detail.source.file}
                        {detail.source.line === undefined ? '' : `:${detail.source.line}`}
                      </Mono>
                      <span className="font-mono text-[12px] break-all text-faint-foreground">
                        #{detail.source.pointer}
                      </span>
                    </span>,
                  ],
                ]}
              />
            </div>
            <Tabs value={tab} onValueChange={setTab} className="flex flex-col gap-5">
              <TabsList aria-label="Model details">
                <TabsTrigger value="schema">
                  <ListTree /> Schema
                </TabsTrigger>
                <TabsTrigger value="relations">
                  <GitFork /> Relations
                </TabsTrigger>
                <TabsTrigger value="usage">
                  <Route /> Used by <TabCount>{detail.usedBy.length}</TabCount>
                </TabsTrigger>
                <TabsTrigger value="code">
                  <Code2 /> Code
                </TabsTrigger>
              </TabsList>
              <TabsContent value="schema">
                <div className="rounded-xl border border-border bg-surface px-4 py-2 shadow-card">
                  {schema.kind === 'enum' ? (
                    <div className="flex flex-wrap gap-1.5 py-2">
                      {schema.values.map((value) => (
                        <Mono key={JSON.stringify(value)} className="text-code-string">
                          {JSON.stringify(value)}
                        </Mono>
                      ))}
                    </div>
                  ) : (
                    <SchemaView schema={schema} names={names} />
                  )}
                </div>
              </TabsContent>
              <TabsContent value="relations">
                <div className="rounded-xl border border-border bg-surface px-5 py-4 shadow-card">
                  <MetaList
                    items={[
                      [
                        'References',
                        <Links key="r" links={detail.references} names={names} empty="none" />,
                      ],
                      [
                        'Referenced by',
                        <Links key="b" links={detail.referencedBy} names={names} empty="none" />,
                      ],
                      [
                        'Possible duplicates',
                        <Links key="d" links={detail.duplicates} names={names} empty="none" />,
                      ],
                    ]}
                  />
                </div>
              </TabsContent>
              <TabsContent value="usage">
                {detail.usedBy.length === 0 ? (
                  <Empty>No operation references this model, directly or indirectly.</Empty>
                ) : (
                  <ul className="flex flex-col divide-y divide-border/70 rounded-xl border border-border bg-surface px-4 shadow-card">
                    {detail.usedBy.map((op) => (
                      <li
                        key={op.key}
                        className="flex flex-wrap items-center justify-between gap-2 py-2.5"
                      >
                        <a
                          href={href({ page: 'operations', key: op.key })}
                          className="flex min-w-0 items-center gap-2.5 hover:underline"
                        >
                          <MethodBadge method={op.method} size="sm" />
                          <code className="truncate font-mono text-[12.5px]">{op.path}</code>
                        </a>
                        <span className="text-[12.5px] text-muted-foreground">
                          {op.chain.length > 1
                            ? `via ${op.chain.slice(0, -1).join(' → ')}`
                            : 'direct'}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>
              <TabsContent value="code">
                <CodeViewer variants={detail.code} />
              </TabsContent>
            </Tabs>
          </article>
        );
      }}
    </Async>
  );
}
