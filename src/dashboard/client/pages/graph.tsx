import { ChevronsUpDown, Network } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { GraphResponse, OperationDetail, OperationSummary } from '../../api-types.ts';
import { useResource } from '../api.ts';
import { Async } from '../components/async.tsx';
import { PageHeader } from '../components/page.tsx';
import { ModelLink, type ModelNames } from '../components/schema.tsx';
import { Badge } from '../components/ui/badge.tsx';
import { Card, CardContent, CardHeader } from '../components/ui/card.tsx';
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '../components/ui/command.tsx';
import { MethodBadge } from '../components/ui/method.tsx';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover.tsx';
import { ScrollArea } from '../components/ui/scroll-area.tsx';
import { Empty } from '../components/ui/states.tsx';
import { Table, TableBody, TableHead, TableRow, Td, Th } from '../components/ui/table.tsx';
import { cn } from '../lib/cn.ts';
import { href, navigate } from '../router.ts';

interface Node {
  readonly id: string;
  readonly label: string;
  readonly depth: number;
  readonly model?: string;
}

const NODE_WIDTH = 176;
const NODE_HEIGHT = 34;
const COLUMN_GAP = 56;
const ROW_GAP = 10;
const MAX_NODES = 120;

/** Layered left-to-right drawing of an operation's dependency tree (shortest reference paths). */
function DependencyDiagram({ detail }: { detail: OperationDetail }) {
  const layout = useMemo(() => {
    const nodes = new Map<string, Node>();
    const edges: [string, string][] = [];
    const root = `op:${detail.summary.key}`;
    nodes.set(root, { id: root, label: detail.summary.name, depth: 0 });
    for (const dependency of detail.dependencies.slice(0, MAX_NODES)) {
      const id = `model:${dependency.id}`;
      nodes.set(id, {
        id,
        label: dependency.name,
        depth: dependency.chain.length,
        model: dependency.id,
      });
    }
    const byName = new Map(
      [...nodes.values()].filter((n) => n.model !== undefined).map((n) => [n.label, n.id]),
    );
    for (const dependency of detail.dependencies.slice(0, MAX_NODES)) {
      const parentName = dependency.chain.at(-2);
      const parent = parentName === undefined ? root : (byName.get(parentName) ?? root);
      edges.push([parent, `model:${dependency.id}`]);
    }
    const columns = new Map<number, Node[]>();
    for (const node of nodes.values())
      columns.set(node.depth, [...(columns.get(node.depth) ?? []), node]);
    const positions = new Map<string, { x: number; y: number }>();
    let height = NODE_HEIGHT;
    for (const [depth, column] of columns) {
      column.forEach((node, index) => {
        positions.set(node.id, {
          x: depth * (NODE_WIDTH + COLUMN_GAP),
          y: index * (NODE_HEIGHT + ROW_GAP),
        });
      });
      height = Math.max(height, column.length * (NODE_HEIGHT + ROW_GAP) - ROW_GAP);
    }
    const width = (Math.max(...columns.keys()) + 1) * (NODE_WIDTH + COLUMN_GAP) - COLUMN_GAP;
    return { nodes: [...nodes.values()], edges, positions, width, height };
  }, [detail]);

  if (detail.dependencies.length === 0)
    return <Empty>This operation does not depend on named models.</Empty>;
  return (
    <div className="flex flex-col gap-2">
      {/* Scrollbars stay visible when the diagram is wider or taller than its frame. */}
      <ScrollArea
        orientation="both"
        type="auto"
        className="rounded-lg border border-border bg-surface-sunken"
        viewportClassName="max-h-[min(70dvh,640px)]"
      >
        <svg
          // A group, not an image: the model nodes are links.
          role="group"
          aria-label={`Dependency graph of ${detail.summary.name} with ${detail.dependencies.length} models`}
          // The viewBox adds a 2px margin for strokes; the size includes it so nothing scales.
          width={layout.width + 4}
          height={layout.height + 4}
          viewBox={`-2 -2 ${layout.width + 4} ${layout.height + 4}`}
          className="m-5 block"
        >
          {layout.edges.map(([from, to]) => {
            const a = layout.positions.get(from);
            const b = layout.positions.get(to);
            if (a === undefined || b === undefined) return null;
            const x1 = a.x + NODE_WIDTH;
            const y1 = a.y + NODE_HEIGHT / 2;
            const x2 = b.x;
            const y2 = b.y + NODE_HEIGHT / 2;
            const mid = (x1 + x2) / 2;
            return (
              <path
                key={`${from}-${to}`}
                d={`M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}`}
                fill="none"
                stroke="var(--border-strong)"
                strokeWidth={1.5}
              />
            );
          })}
          {layout.nodes.map((node) => {
            const position = layout.positions.get(node.id);
            if (position === undefined) return null;
            const label = node.label.length > 20 ? `${node.label.slice(0, 19)}…` : node.label;
            const isRoot = node.model === undefined;
            const content = (
              <g transform={`translate(${position.x},${position.y})`} className="group">
                <rect
                  width={NODE_WIDTH}
                  height={NODE_HEIGHT}
                  rx={8}
                  fill={isRoot ? 'var(--marigold)' : 'var(--surface)'}
                  stroke={isRoot ? 'var(--marigold)' : 'var(--border-strong)'}
                  className={isRoot ? '' : 'transition-colors group-hover:fill-[var(--highlight)]'}
                />
                <text
                  x={12}
                  y={NODE_HEIGHT / 2 + 4}
                  fontFamily="var(--font-mono)"
                  fontSize={12}
                  fontWeight={isRoot ? 600 : 500}
                  fill={isRoot ? '#1b1915' : 'var(--foreground)'}
                >
                  {label}
                </text>
              </g>
            );
            return isRoot ? (
              <g key={node.id}>{content}</g>
            ) : (
              <a
                key={node.id}
                href={href({ page: 'models', id: node.model ?? '' })}
                aria-label={node.label}
              >
                {content}
              </a>
            );
          })}
        </svg>
      </ScrollArea>
      {detail.dependencies.length > MAX_NODES ? (
        <p className="text-[12.5px] text-muted-foreground">
          Showing {MAX_NODES} of {detail.dependencies.length} models.
        </p>
      ) : null}
    </div>
  );
}

function OperationPicker({
  operations,
  selected,
}: {
  operations: readonly OperationSummary[];
  selected: OperationSummary | undefined;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Choose an operation"
          className="flex h-10 w-full max-w-xl cursor-pointer items-center gap-2.5 rounded-lg border border-input bg-surface px-3 text-left shadow-card outline-none hover:border-border-strong focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25"
        >
          {selected === undefined ? (
            <span className="flex-1 text-[13px] text-faint-foreground">Choose an operation…</span>
          ) : (
            <>
              <MethodBadge method={selected.method} size="sm" />
              <code className="flex-1 truncate font-mono text-[12.5px]">{selected.path}</code>
              <span className="hidden truncate text-[12px] text-muted-foreground sm:inline">
                {selected.name}
              </span>
            </>
          )}
          <ChevronsUpDown className="size-3.5 shrink-0 text-faint-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(36rem,calc(100vw-2rem))] p-0">
        <Command>
          <CommandInput placeholder="Search operations" />
          <CommandList>
            <CommandEmpty>No operations found.</CommandEmpty>
            {operations.map((op) => (
              <CommandItem
                key={op.key}
                value={`${op.method} ${op.path} ${op.name}`}
                onSelect={() => {
                  setOpen(false);
                  navigate({ page: 'graph', key: op.key });
                }}
              >
                <MethodBadge method={op.method} size="sm" />
                <code className="min-w-0 flex-1 truncate font-mono text-[12.5px]">{op.path}</code>
                <span className="truncate text-[12px] text-muted-foreground">{op.name}</span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function OperationDependencies({
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
  return (
    <Async resource={resource}>
      {(detail) => (
        <div className="flex flex-col gap-5">
          <DependencyDiagram detail={detail} />
          {detail.dependencies.length === 0 ? null : (
            <Table>
              <TableHead>
                <TableRow>
                  <Th className="w-[30%]">Model</Th>
                  <Th>Why it is included</Th>
                </TableRow>
              </TableHead>
              <TableBody>
                {detail.dependencies.map((dependency) => (
                  <TableRow key={dependency.id}>
                    <Td>
                      <ModelLink id={dependency.id} names={names} />
                    </Td>
                    <Td className="font-mono text-[12px] text-muted-foreground">
                      {dependency.chain.length <= 1
                        ? `referenced directly by ${detail.summary.name}`
                        : `${detail.summary.name} → ${dependency.chain.join(' → ')}`}
                    </Td>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}
    </Async>
  );
}

function ModelCloud({
  models,
  names,
  empty,
}: {
  models: readonly { id: string }[];
  names: ModelNames;
  empty: string;
}) {
  if (models.length === 0) return <p className="text-[13px] text-muted-foreground">{empty}</p>;
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1.5">
      {models.map((m) => (
        <ModelLink key={m.id} id={m.id} names={names} />
      ))}
    </div>
  );
}

export function GraphPage({
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
  const graph = useResource<GraphResponse>('/api/graph', version);
  const current = operations.find((op) => op.key === selected);
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Dependencies"
        description="How operations depend on models, and which models are unused, recursive or possibly duplicated."
      />
      <Card>
        <CardHeader
          title="Operation dependencies"
          description="Every model an operation pulls in, with the reference chain that explains it."
          actions={
            current === undefined ? null : (
              <a
                href={href({ page: 'operations', key: current.key })}
                className="text-[13px] text-muted-foreground underline decoration-border-strong underline-offset-4 hover:text-foreground"
              >
                Open in explorer
              </a>
            )
          }
        />
        <CardContent className="flex flex-col gap-5">
          <OperationPicker operations={operations} selected={current} />
          {selected === undefined ? (
            <Empty icon={<Network />}>
              Choose an operation to see its transitive model dependencies.
            </Empty>
          ) : (
            <OperationDependencies operationKey={selected} names={names} version={version} />
          )}
        </CardContent>
      </Card>
      <Async resource={graph}>
        {(data) => {
          const top = data.mostUsed.filter((m) => m.count > 0);
          const max = Math.max(1, top[0]?.count ?? 1);
          return (
            <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
              <Card>
                <CardHeader
                  title="Most referenced models"
                  description="By the number of operations that use them."
                />
                <CardContent>
                  {top.length === 0 ? (
                    <p className="text-[13px] text-muted-foreground">
                      No operation references a model.
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-2.5">
                      {top.map((model) => (
                        <li
                          key={model.id}
                          className="grid grid-cols-[minmax(0,180px)_1fr_auto] items-center gap-3"
                        >
                          <ModelLink id={model.id} names={names} className="truncate" />
                          <span className="h-1.5 overflow-hidden rounded-full bg-muted">
                            <span
                              className="block h-full rounded-full bg-marigold"
                              style={{ width: `${(model.count / max) * 100}%` }}
                            />
                          </span>
                          <span className="w-8 text-right font-mono text-[12.5px] tabular-nums">
                            {model.count}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
              <div className="grid grid-cols-1 gap-4">
                <Card>
                  <CardHeader
                    title="Unused models"
                    actions={
                      <Badge tone={data.unused.length > 0 ? 'warning' : 'success'}>
                        {data.unused.length}
                      </Badge>
                    }
                  />
                  <CardContent>
                    <ModelCloud
                      models={data.unused}
                      names={names}
                      empty="Every model is reachable from an operation."
                    />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader
                    title="Recursive models"
                    actions={<Badge tone="info">{data.recursive.length}</Badge>}
                  />
                  <CardContent>
                    <ModelCloud
                      models={data.recursive}
                      names={names}
                      empty="No recursive models."
                    />
                  </CardContent>
                </Card>
              </div>
              <Card className="xl:col-span-2">
                <CardHeader
                  title="Possible duplicates"
                  description="Models with structurally identical schemas."
                  actions={
                    <Badge tone={data.duplicates.length > 0 ? 'warning' : 'success'}>
                      {data.duplicates.length}
                    </Badge>
                  }
                />
                <CardContent>
                  {data.duplicates.length === 0 ? (
                    <p className="text-[13px] text-muted-foreground">
                      No structurally identical models.
                    </p>
                  ) : (
                    <ul className="flex flex-col divide-y divide-border/70">
                      {data.duplicates.map((group) => (
                        <li
                          key={group.map((g) => g.id).join()}
                          className={cn('flex flex-wrap items-center gap-3 py-2.5')}
                        >
                          <Badge tone="warning">same shape</Badge>
                          {group.map((m) => (
                            <ModelLink key={m.id} id={m.id} names={names} />
                          ))}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          );
        }}
      </Async>
    </div>
  );
}
