import { Code2, FileInput, FileOutput, Network, Route } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { OperationDetail, OperationIR, OperationSummary } from '../../../service/types.ts';
import { ApiRequestError, useResource } from '../api.ts';
import { Async } from '../components/async.tsx';
import { ChangeBadge } from '../components/change.tsx';
import { CodeViewer } from '../components/code.tsx';
import { MetaList, Mono } from '../components/page.tsx';
import { Prose } from '../components/prose.tsx';
import { ModelLink, SchemaView, TypeCell, type ModelNames } from '../components/schema.tsx';
import { ListItem, ListPane, SplitLayout } from '../components/split.tsx';
import { Badge, type BadgeTone } from '../components/ui/badge.tsx';
import { Button } from '../components/ui/button.tsx';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../components/ui/collapsible.tsx';
import { CopyButton } from '../components/ui/copy-button.tsx';
import { SearchInput } from '../components/ui/input.tsx';
import { Kbd } from '../components/ui/kbd.tsx';
import { MethodBadge } from '../components/ui/method.tsx';
import { ScrollArea } from '../components/ui/scroll-area.tsx';
import { Select } from '../components/ui/select.tsx';
import { Empty } from '../components/ui/states.tsx';
import { Table, TableBody, TableHead, TableRow, Td, Th } from '../components/ui/table.tsx';
import { TabCount, Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs.tsx';
import { ToggleGroup, ToggleGroupItem } from '../components/ui/toggle-group.tsx';
import { filterOperations, type OperationFilter } from '../filters.ts';
import { href } from '../router.ts';

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'TRACE', 'QUERY'];
const PAGE_SIZE = 200;
type Deprecated = OperationFilter['deprecated'];
type ResponseLike = OperationIR['responses'][number];
type Location = OperationIR['parameters'][number]['in'];

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
        ...new Set(
          operations.flatMap((op) => [
            ...(op.tags.length === 0 ? ['default'] : op.tags),
            ...(op.tagAncestors ?? []),
          ]),
        ),
      ].sort((a, b) => a.localeCompare(b)),
    [operations],
  );
  // The standard methods in their usual order, then others (OpenAPI 3.2 additionalOperations).
  const methods = useMemo(
    () => [
      ...METHODS.filter((m) => operations.some((op) => op.method === m)),
      ...[...new Set(operations.map((op) => op.method))]
        .filter((m) => !METHODS.includes(m))
        .sort((a, b) => a.localeCompare(b)),
    ],
    [operations],
  );
  const results = useMemo(() => filterOperations(operations, filter), [operations, filter]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      const target = event.target;
      const typing =
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (event.key === '/' && !typing && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        search.current?.focus();
      }
    };
    addEventListener('keydown', onKey);
    return () => {
      removeEventListener('keydown', onKey);
    };
  }, []);

  const list = (
    <ListPane
      filters={
        <>
          <div className="flex items-baseline justify-between">
            <h1 className="font-display text-[20px] font-semibold">Operations</h1>
            <span className="text-[12px] tabular-nums text-muted-foreground" aria-live="polite">
              {results.length === operations.length
                ? operations.length
                : `${results.length} of ${operations.length}`}
            </span>
          </div>
          <SearchInput
            ref={search}
            name="operation-search"
            aria-label="Search operations"
            placeholder="Search paths, names, tags, models"
            value={filter.query}
            hint={<Kbd>/</Kbd>}
            onChange={(e) => {
              setFilter({ ...filter, query: e.currentTarget.value });
              setLimit(PAGE_SIZE);
            }}
          />
          <ToggleGroup
            type="multiple"
            aria-label="Filter by method"
            value={[...filter.methods]}
            onValueChange={(value) => {
              setFilter({ ...filter, methods: value });
            }}
          >
            {methods.map((method) => (
              <ToggleGroupItem key={method} value={method} className="font-mono text-[11px]">
                {method}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <div className="grid grid-cols-2 gap-2">
            <Select
              size="sm"
              label="Filter by tag"
              value={filter.tag === '' ? '*' : filter.tag}
              onValueChange={(value) => {
                setFilter({ ...filter, tag: value === '*' ? '' : value });
              }}
              options={[
                { value: '*', label: 'All tags' },
                ...tags.map((tag) => ({ value: tag, label: tag })),
              ]}
            />
            <Select<Deprecated>
              size="sm"
              label="Deprecated operations"
              value={filter.deprecated}
              onValueChange={(value) => {
                setFilter({ ...filter, deprecated: value });
              }}
              options={[
                { value: 'all', label: 'Any status' },
                { value: 'hide', label: 'Hide deprecated' },
                { value: 'only', label: 'Only deprecated' },
              ]}
            />
          </div>
        </>
      }
    >
      {results.length === 0 ? (
        <Empty>No operations match the filters.</Empty>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {results.slice(0, limit).map((op) => (
            <li key={op.key}>
              <ListItem
                href={href({ page: 'operations', key: op.key })}
                active={op.key === selected}
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <MethodBadge method={op.method} size="sm" />
                  <code className="truncate font-mono text-[12.5px] text-foreground">
                    {op.path}
                  </code>
                </span>
                <span className="flex min-w-0 items-center gap-1.5 pl-[56px] text-[12px] text-muted-foreground">
                  <span className="mr-0.5 truncate">{op.name}</span>
                  <ChangeBadge change={op.change} />
                  {op.deprecated ? <Badge tone="warning">deprecated</Badge> : null}
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
            Show more ({results.length - limit} remaining)
          </Button>
        </div>
      ) : null}
    </ListPane>
  );

  return (
    <SplitLayout
      list={list}
      selection={selected}
      backHref={href({ page: 'operations' })}
      backLabel="All operations"
      detail={
        selected === undefined ? (
          <div className="flex min-h-[60vh] items-center justify-center">
            <Empty icon={<Route />} className="max-lg:hidden">
              Select an operation to inspect its parameters, schemas, dependencies and generated
              code.
            </Empty>
          </div>
        ) : (
          <OperationView operationKey={selected} names={names} version={version} />
        )
      }
    />
  );
}

const LOCATIONS: readonly Location[] = ['path', 'query', 'querystring', 'header', 'cookie'];

function statusTone(status: string): BadgeTone {
  if (status.startsWith('2')) return 'success';
  if (status.startsWith('3')) return 'info';
  if (status === 'default') return 'neutral';
  return status.startsWith('4') ? 'warning' : 'danger';
}

function Examples({
  examples,
}: {
  examples: readonly { name?: string; value?: unknown; summary?: string }[];
}) {
  const withValues = examples.filter((example) => example.value !== undefined);
  if (withValues.length === 0) return null;
  return (
    <Collapsible className="mt-3">
      <CollapsibleTrigger className="group inline-flex cursor-pointer items-center gap-1.5 text-[12.5px] font-medium text-muted-foreground hover:text-foreground">
        <span className="inline-block transition-transform group-data-[state=open]:rotate-90">
          ›
        </span>
        Examples ({withValues.length})
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 flex flex-col gap-2">
        {withValues.map((example, index) => (
          <div key={index} className="flex flex-col gap-1">
            {example.name === undefined ? null : (
              <div className="text-[12px] text-muted-foreground">
                {example.summary ?? example.name}
              </div>
            )}
            <ScrollArea
              orientation="both"
              className="rounded-lg border border-border bg-surface-sunken"
              viewportClassName="max-h-80"
            >
              <pre className="p-3 text-[12px] leading-relaxed">
                {JSON.stringify(example.value, null, 2)}
              </pre>
            </ScrollArea>
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

function Section({
  title,
  children,
  aside,
}: {
  title: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-[17px] font-semibold">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Parameters({ operation, names }: { operation: OperationIR; names: ModelNames }) {
  if (operation.parameters.length === 0)
    return <p className="text-[13px] text-muted-foreground">No parameters.</p>;
  return (
    <div className="flex flex-col gap-5">
      {LOCATIONS.filter((location) => operation.parameters.some((p) => p.in === location)).map(
        (location) => (
          <div key={location}>
            <div className="mb-1 text-[11px] font-medium tracking-wider text-faint-foreground uppercase">
              {location}
            </div>
            <Table>
              <TableHead>
                <TableRow>
                  <Th className="w-[30%]">Name</Th>
                  <Th className="w-[30%]">Type</Th>
                  <Th>Description</Th>
                </TableRow>
              </TableHead>
              <TableBody>
                {operation.parameters
                  .filter((p) => p.in === location)
                  .map((parameter) => (
                    <TableRow key={parameter.name}>
                      <Td>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <code className="font-mono text-[12.5px] font-semibold">
                            {parameter.name}
                            {parameter.required ? (
                              <span className="required ml-0.5 text-danger">
                                <span aria-hidden="true">*</span>
                                <span className="sr-only"> (required)</span>
                              </span>
                            ) : null}
                          </code>
                          {parameter.deprecated ? <Badge tone="warning">deprecated</Badge> : null}
                        </div>
                        {location === 'querystring' ? (
                          <div className="mt-1 text-[12px] break-all text-muted-foreground">
                            as{' '}
                            <code className="font-mono">
                              {parameter.contentType ?? 'application/x-www-form-urlencoded'}
                            </code>
                          </div>
                        ) : parameter.style !==
                          (location === 'query' || location === 'cookie' ? 'form' : 'simple') ? (
                          <div className="mt-1 text-[12px] text-muted-foreground">
                            style {parameter.style}
                          </div>
                        ) : null}
                      </Td>
                      <Td>
                        <TypeCell schema={parameter.schema} names={names} />
                      </Td>
                      <Td className="text-muted-foreground">{parameter.description ?? ''}</Td>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        ),
      )}
    </div>
  );
}

function RequestBody({ operation, names }: { operation: OperationIR; names: ModelNames }) {
  const body = operation.requestBody;
  const [mediaType, setMediaType] = useState(body?.contents[0]?.mediaType ?? '');
  if (body === undefined) return null;
  const media = body.contents.find((c) => c.mediaType === mediaType) ?? body.contents[0];
  return (
    <Section
      title="Request body"
      aside={
        <span className="flex items-center gap-2">
          {body.required ? <Badge tone="danger">required</Badge> : <Badge>optional</Badge>}
          {body.contents.length > 1 ? (
            <Select
              size="sm"
              label="Request media type"
              className="w-auto min-w-[200px]"
              value={media?.mediaType ?? ''}
              onValueChange={setMediaType}
              options={body.contents.map((c) => ({ value: c.mediaType, label: c.mediaType }))}
            />
          ) : (
            <Mono>{media?.mediaType}</Mono>
          )}
        </span>
      }
    >
      <Prose text={body.description} size="sm" />
      {media === undefined ? null : (
        <div className="rounded-xl border border-border bg-surface px-4 py-2 shadow-card">
          <SchemaView schema={media.schema} names={names} />
          <Examples examples={media.examples} />
        </div>
      )}
    </Section>
  );
}

function Responses({
  responses,
  names,
}: {
  responses: readonly ResponseLike[];
  names: ModelNames;
}) {
  if (responses.length === 0) return <Empty>No responses are declared.</Empty>;
  return (
    <div className="flex flex-col gap-3">
      {responses.map((response) => (
        <article
          key={response.status}
          className="rounded-xl border border-border bg-surface shadow-card"
        >
          <header className="flex flex-wrap items-center gap-2.5 border-b border-border/70 px-4 py-2.5">
            <Badge tone={statusTone(response.status)} className="h-6 px-2 font-mono text-[12px]">
              {response.status}
            </Badge>
            <span className="text-[13.5px]">{response.description ?? ''}</span>
          </header>
          <div className="flex flex-col gap-4 px-4 py-3">
            {response.headers.length === 0 ? null : (
              <Table>
                <TableHead>
                  <TableRow>
                    <Th>Header</Th>
                    <Th>Type</Th>
                    <Th>Description</Th>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {response.headers.map((header) => (
                    <TableRow key={header.name}>
                      <Td>
                        <code className="font-mono text-[12.5px]">{header.name}</code>
                      </Td>
                      <Td>
                        <TypeCell schema={header.schema} names={names} />
                      </Td>
                      <Td className="text-muted-foreground">{header.description ?? ''}</Td>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {response.contents.length === 0 ? (
              <p className="text-[12.5px] text-muted-foreground">No body.</p>
            ) : (
              response.contents.map((content) => (
                <div key={content.mediaType}>
                  <div className="mb-1">
                    <Mono className="text-muted-foreground">{content.mediaType}</Mono>
                  </div>
                  <SchemaView schema={content.schema} names={names} />
                  <Examples examples={content.examples} />
                </div>
              ))
            )}
          </div>
        </article>
      ))}
    </div>
  );
}

/** Shown when the selected operation disappeared in a reload. */
function removed(error: Error): ReactNode {
  if (!(error instanceof ApiRequestError) || error.status !== 404) return undefined;
  return (
    <Empty icon={<Route />} className="min-h-[50vh]">
      This operation no longer exists in the specification. It was removed or renamed while the
      dashboard was running.
    </Empty>
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
  const [tab, setTab] = useState('request');
  return (
    <Async resource={resource} error={removed}>
      {(detail) => {
        const op = detail.operation;
        return (
          <article className="flex max-w-5xl flex-col gap-7">
            <header className="flex flex-col gap-3">
              <div className="flex min-w-0 flex-wrap items-center gap-3">
                <MethodBadge method={detail.summary.method} size="lg" />
                <h1 className="min-w-0 font-mono text-[19px] leading-7 font-medium break-all">
                  {op.path}
                </h1>
                <CopyButton value={op.path} label="Copy path" />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Mono className="text-[12.5px]">{detail.summary.name}()</Mono>
                <ChangeBadge change={detail.summary.change} />
                {op.deprecated ? <Badge tone="warning">deprecated</Badge> : null}
                {op.tags.map((tag) => (
                  <Badge key={tag} tone="outline">
                    {tag}
                  </Badge>
                ))}
              </div>
              {op.summary === undefined ? null : (
                <p className="font-display text-[19px] leading-8 text-foreground">{op.summary}</p>
              )}
              <Prose text={op.description} />
            </header>

            <div className="rounded-xl border border-border bg-surface px-5 py-4 shadow-card">
              <MetaList
                items={[
                  [
                    'Operation ID',
                    op.operationId === undefined ? (
                      <span key="id" className="text-muted-foreground">
                        none (name derived from the path)
                      </span>
                    ) : (
                      <Mono key="id">{op.operationId}</Mono>
                    ),
                  ],
                  ['Module', <Mono key="m">{detail.summary.module}</Mono>],
                  [
                    'Types',
                    <span key="t" className="flex flex-wrap gap-1">
                      {Object.values(detail.typeNames).map((name) => (
                        <Mono key={name}>{name}</Mono>
                      ))}
                    </span>,
                  ],
                  detail.hooks.length > 0 && [
                    detail.hooksLabel ?? 'Hooks',
                    <span key="h" className="flex flex-wrap gap-1">
                      {detail.hooks.map((hook) => (
                        <Mono key={hook}>{hook}</Mono>
                      ))}
                    </span>,
                  ],
                  [
                    'Authentication',
                    detail.security.length === 0 ? (
                      <span key="auth" className="text-muted-foreground">
                        none
                      </span>
                    ) : (
                      <span key="auth" className="flex flex-wrap gap-1">
                        {detail.security.map((scheme) => (
                          <Badge key={scheme.key} tone="info">
                            {scheme.key} · {scheme.type}
                          </Badge>
                        ))}
                      </span>
                    ),
                  ],
                  detail.request.mediaType !== undefined && [
                    'Request',
                    <Mono key="r">{detail.request.mediaType}</Mono>,
                  ],
                  detail.request.accept !== undefined && [
                    'Accept',
                    <Mono key="a">{detail.request.accept}</Mono>,
                  ],
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
              <TabsList aria-label="Operation details">
                <TabsTrigger value="request">
                  <FileInput /> Request
                </TabsTrigger>
                <TabsTrigger value="responses">
                  <FileOutput /> Responses <TabCount>{op.responses.length}</TabCount>
                </TabsTrigger>
                <TabsTrigger value="models">
                  <Network /> Models <TabCount>{detail.dependencies.length}</TabCount>
                </TabsTrigger>
                <TabsTrigger value="code">
                  <Code2 /> Code
                </TabsTrigger>
              </TabsList>
              <TabsContent value="request" className="flex flex-col gap-7">
                <Section title="Parameters">
                  <Parameters operation={op} names={names} />
                </Section>
                <RequestBody key={op.key} operation={op} names={names} />
              </TabsContent>
              <TabsContent value="responses">
                <Responses responses={op.responses} names={names} />
              </TabsContent>
              <TabsContent value="models">
                {detail.dependencies.length === 0 ? (
                  <Empty>This operation does not reference named models.</Empty>
                ) : (
                  <ul className="flex flex-col divide-y divide-border/70 rounded-xl border border-border bg-surface px-4 shadow-card">
                    {detail.dependencies.map((dep) => (
                      <li
                        key={dep.id}
                        className="flex flex-wrap items-center justify-between gap-2 py-2.5"
                      >
                        <ModelLink id={dep.id} names={names} />
                        <span className="text-[12.5px] text-muted-foreground">
                          {dep.chain.length > 1
                            ? `via ${dep.chain.slice(0, -1).join(' → ')}`
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
