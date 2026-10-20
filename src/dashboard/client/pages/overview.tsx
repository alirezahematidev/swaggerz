import { ArrowUpRight, Boxes, FileCode2, Route, ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import type { ChangedItem, OverviewResponse, SessionInfo } from '../../api-types.ts';
import { ChangeBadge } from '../components/change.tsx';
import { DiagnosticsList } from '../components/diagnostics.tsx';
import { MetaList, Mono, PageHeader, Stat } from '../components/page.tsx';
import { Prose } from '../components/prose.tsx';
import { Badge, StatusDot, type BadgeTone } from '../components/ui/badge.tsx';
import { Card, CardContent, CardHeader } from '../components/ui/card.tsx';
import { MethodBadge, methodColor } from '../components/ui/method.tsx';
import { Table, TableBody, TableHead, TableRow, Td, Th } from '../components/ui/table.tsx';
import { cn } from '../lib/cn.ts';
import { href } from '../router.ts';

const STATUS: Record<OverviewResponse['generation']['status'], { tone: BadgeTone; label: string }> =
  {
    never: { tone: 'warning', label: 'Not generated yet' },
    'up-to-date': { tone: 'success', label: 'Up to date' },
    stale: { tone: 'warning', label: 'Out of date' },
    failed: { tone: 'danger', label: 'Compilation failed' },
  };

function StatCard({
  link,
  icon,
  children,
}: {
  link?: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  const body = (
    <>
      <span className="absolute top-4 right-4 text-faint-foreground transition-colors group-hover:text-foreground [&_svg]:size-4">
        {link === undefined ? icon : <ArrowUpRight />}
      </span>
      {children}
    </>
  );
  const className =
    'group relative block rounded-xl border border-border bg-surface p-4 shadow-card transition-[border-color,box-shadow]';
  return link === undefined ? (
    <div className={className}>{body}</div>
  ) : (
    <a href={link} className={cn(className, 'hover:border-border-strong')}>
      {body}
    </a>
  );
}

const CHANGE_LIMIT = 12;

function ChangeList({
  title,
  items,
  link,
}: {
  title: string;
  items: readonly ChangedItem[];
  link: (item: ChangedItem) => string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <h3 className="text-[11px] font-medium tracking-wider text-faint-foreground uppercase">
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">No changes.</p>
      ) : (
        <ul className="flex flex-col">
          {items.slice(0, CHANGE_LIMIT).map((item) => {
            const method = item.label?.split(' ')[0];
            const label = (
              <>
                {method === undefined ? null : <MethodBadge method={method} size="sm" />}
                <span className="truncate font-mono text-[12.5px]">
                  {item.label?.slice(method?.length ?? 0).trim() ?? item.name}
                </span>
              </>
            );
            return (
              <li
                key={item.id}
                className="flex min-h-9 items-center gap-2.5 border-b border-border/60 last:border-0"
              >
                <ChangeBadge change={item.change} className="w-[74px] justify-center" />
                {item.change === 'removed' ? (
                  <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
                    {label}
                  </span>
                ) : (
                  <a
                    href={link(item)}
                    className="flex min-w-0 items-center gap-2 rounded-sm outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/25"
                  >
                    {label}
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {items.length > CHANGE_LIMIT ? (
        <p className="text-[12.5px] text-muted-foreground">
          and {items.length - CHANGE_LIMIT} more
        </p>
      ) : null}
    </div>
  );
}

function SessionChanges({ session }: { session: SessionInfo }) {
  const { operations, models } = session.changes;
  if (operations.length === 0 && models.length === 0 && session.lastReload === undefined)
    return null;
  const time = (iso: string): string =>
    new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return (
    <Card>
      <CardHeader
        title="Changes since the dashboard started"
        description={
          <>
            Started at {time(session.startedAt)}
            {session.lastReload === undefined
              ? ''
              : ` · last reload at ${time(session.lastReload.at)}${session.lastReload.files.length === 0 ? '' : ` (${session.lastReload.files.join(', ')})`}`}
            . Marks reset when the dashboard restarts.
          </>
        }
      />
      <CardContent className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
        <ChangeList
          title="Operations"
          items={operations}
          link={(item) => href({ page: 'operations', key: item.id })}
        />
        <ChangeList
          title="Models"
          items={models}
          link={(item) => href({ page: 'models', id: item.id })}
        />
      </CardContent>
    </Card>
  );
}

export function Overview({ data }: { data: OverviewResponse }) {
  const errors = data.diagnostics.filter((d) => d.severity === 'error').length;
  const warnings = data.diagnostics.filter((d) => d.severity === 'warning').length;
  const unresolved = data.diagnostics.filter((d) => d.code.startsWith('ref/'));
  const unsupported = data.diagnostics.filter((d) =>
    /unsupported|foreign-keyword|ignored|skipped|assertion/.test(d.code),
  );
  const status = STATUS[data.generation.status];
  const methods = Object.entries(data.methods).sort(([, a], [, b]) => b - a);
  const totalMethods = methods.reduce((sum, [, count]) => sum + count, 0);
  const maxTag = Math.max(1, ...data.tags.map((tag) => tag.count));

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={
          <>
            <span>{data.specVersion}</span>
            <span className="text-faint-foreground">·</span>
            <span className="font-mono">{data.specVersionRaw}</span>
            <span className="text-faint-foreground">·</span>
            <span>API v{data.version}</span>
          </>
        }
        title={data.title}
      >
        <Prose text={data.description} />
        {data.servers.length === 0 ? null : (
          <div className="flex flex-wrap items-center gap-2">
            {data.servers.map((server) => (
              <Mono key={server} className="text-muted-foreground">
                {server}
              </Mono>
            ))}
          </div>
        )}
      </PageHeader>

      {data.session.failure === undefined ? null : (
        <Card className="border-danger/30">
          <CardHeader
            title="The latest change could not be loaded"
            description={`${data.session.failure.message}. The dashboard shows the last version that loaded until the problem is fixed.`}
          />
          <CardContent>
            <DiagnosticsList diagnostics={data.session.failure.diagnostics} />
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard link={href({ page: 'operations' })} icon={<Route />}>
          <Stat
            label="Operations"
            value={data.counts.operations}
            caption={`${data.counts.tags} tags · ${data.counts.deprecated} deprecated`}
          />
        </StatCard>
        <StatCard link={href({ page: 'models' })} icon={<Boxes />}>
          <Stat label="Models" value={data.counts.models} caption="Named schemas" />
        </StatCard>
        <StatCard link={href({ page: 'generate' })} icon={<FileCode2 />}>
          <Stat
            label="Generated files"
            value={data.counts.files}
            caption={`${data.config.language} · ${data.config.adapter}`}
          />
        </StatCard>
        <StatCard icon={<ShieldCheck />}>
          <Stat
            label="Diagnostics"
            value={
              <span>
                {errors}
                <span className="text-faint-foreground"> / </span>
                {warnings}
              </span>
            }
            caption="errors / warnings"
            {...(errors > 0
              ? { tone: 'danger' as const }
              : warnings > 0
                ? { tone: 'warning' as const }
                : {})}
          />
        </StatCard>
      </div>

      <SessionChanges session={data.session} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-2">
          <CardHeader title="HTTP methods" description={`${totalMethods} operations`} />
          <CardContent className="flex flex-col gap-4">
            <div
              className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted"
              role="img"
              aria-label={methods.map(([m, c]) => `${m} ${c}`).join(', ')}
            >
              {methods.map(([method, count]) => (
                <span
                  key={method}
                  className="h-full first:rounded-l-full last:rounded-r-full"
                  style={{
                    width: `${(count / Math.max(1, totalMethods)) * 100}%`,
                    background: methodColor(method),
                  }}
                />
              ))}
            </div>
            <ul
              className="grid grid-cols-2 gap-x-6 gap-y-2"
              aria-label="Operations per HTTP method"
            >
              {methods.map(([method, count]) => (
                <li key={method} className="flex items-center justify-between gap-3">
                  <MethodBadge method={method} />
                  <span className="font-mono text-[12.5px] tabular-nums text-muted-foreground">
                    {count}
                    <span className="ml-2 text-faint-foreground">
                      {Math.round((count / Math.max(1, totalMethods)) * 100)}%
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="xl:col-span-3">
          <CardHeader
            title="Generation"
            actions={
              <Badge tone={status.tone} className="h-6 gap-1.5 px-2">
                <StatusDot tone={status.tone} />
                {status.label}
                {data.generation.status === 'stale' ? (
                  <span className="font-normal opacity-80">
                    · {data.generation.staleFiles} files differ
                  </span>
                ) : null}
              </Badge>
            }
          />
          <CardContent>
            <MetaList
              items={[
                [
                  'Output',
                  <span key="o" className="flex flex-wrap items-center gap-1.5">
                    <Mono>{data.config.output}</Mono>
                    <Badge tone="outline">{data.config.language}</Badge>
                    <Badge tone="outline">{data.config.adapter}</Badge>
                    {data.config.reactQuery ? <Badge tone="outline">React Query</Badge> : null}
                    {data.config.validation === 'zod' ? <Badge tone="outline">Zod</Badge> : null}
                  </span>,
                ],
                ['Input', <Mono key="i">{data.config.input}</Mono>],
                data.config.configFile !== undefined && [
                  'Config',
                  <Mono key="c">{data.config.configFile}</Mono>,
                ],
                [
                  'Manifest',
                  `${data.generation.manifestFiles} files${data.generation.generatorVersion === undefined ? '' : ` · generator ${data.generation.generatorVersion}`}`,
                ],
                data.generation.lastRun !== undefined && [
                  'Last run',
                  <span key="l" className="flex flex-wrap items-center gap-1.5">
                    <Badge tone={data.generation.lastRun.ok ? 'success' : 'danger'}>
                      {data.generation.lastRun.ok ? 'succeeded' : 'failed'}
                    </Badge>
                    {data.generation.lastRun.summary}
                    <span className="text-muted-foreground">
                      · {new Date(data.generation.lastRun.at).toLocaleTimeString()}
                    </span>
                  </span>,
                ],
                [
                  'Live reload',
                  data.session.watching.length === 0 ? (
                    <span key="w" className="text-muted-foreground">
                      off
                    </span>
                  ) : (
                    <span key="w" className="flex flex-wrap gap-1">
                      {data.session.watching.map((file) => (
                        <Mono key={file}>{file}</Mono>
                      ))}
                      <Mono>{`${data.config.output}/`}</Mono>
                    </span>
                  ),
                ],
                [
                  'Timings',
                  <span
                    key="t"
                    className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[12px] text-muted-foreground"
                  >
                    {Object.entries(data.timings).map(([stage, ms]) => (
                      <span key={stage}>
                        {stage} <span className="text-foreground">{ms} ms</span>
                      </span>
                    ))}
                  </span>,
                ],
              ]}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader title="Tags" description={`${data.tags.length} groups`} />
          <CardContent>
            {data.tags.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">
                The specification declares no tags.
              </p>
            ) : (
              <Table>
                <TableHead>
                  <TableRow>
                    <Th>Tag</Th>
                    <Th className="w-[40%]">Operations</Th>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.tags.map((tag) => (
                    <TableRow key={tag.name}>
                      <Td>
                        {/* Nested tags (OpenAPI 3.2) are indented under their parent. */}
                        <div style={{ paddingLeft: `${tag.depth * 18}px` }}>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {tag.depth > 0 ? (
                              <span aria-hidden="true" className="text-faint-foreground">
                                ↳
                              </span>
                            ) : null}
                            <span className="font-medium">{tag.summary ?? tag.name}</span>
                            {tag.summary === undefined ? null : (
                              <code className="font-mono text-[11.5px] text-muted-foreground">
                                {tag.name}
                              </code>
                            )}
                            {tag.kind === undefined ? null : <Badge>{tag.kind}</Badge>}
                          </div>
                          {tag.description === undefined ? null : (
                            <div className="mt-0.5 text-[12.5px] text-muted-foreground">
                              {tag.description}
                            </div>
                          )}
                        </div>
                      </Td>
                      <Td>
                        <div className="flex items-center gap-2.5">
                          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                            <span
                              className="block h-full rounded-full bg-marigold"
                              style={{ width: `${(tag.count / maxTag) * 100}%` }}
                            />
                          </span>
                          <span className="w-8 text-right font-mono text-[12.5px] tabular-nums">
                            {tag.count}
                          </span>
                        </div>
                      </Td>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader title="Specification health" />
          <CardContent>
            <ul className="flex flex-col divide-y divide-border/70 text-[13px]">
              {[
                ['Unresolved references', unresolved.length, 'danger'] as const,
                ['Unsupported or ignored constructs', unsupported.length, 'warning'] as const,
                ['Deprecated operations', data.counts.deprecated, 'neutral'] as const,
              ].map(([label, count, tone]) => (
                <li
                  key={label}
                  className="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0"
                >
                  <span className="text-muted-foreground">{label}</span>
                  {count === 0 && tone !== 'neutral' ? (
                    <Badge tone="success">none</Badge>
                  ) : (
                    <Badge tone={count === 0 ? 'neutral' : tone}>{count}</Badge>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Diagnostics"
          description="Problems found while reading and compiling the specification."
        />
        <CardContent>
          <DiagnosticsList diagnostics={data.diagnostics} />
        </CardContent>
      </Card>
    </div>
  );
}
