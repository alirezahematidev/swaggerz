import { useMemo, useState } from 'preact/hooks';
import type { GraphResponse, OperationDetail, OperationSummary } from '../../api-types.ts';
import { useResource } from '../api.ts';
import { href } from '../router.ts';
import { Async, Badge, Empty, MethodBadge, ModelLink, Section, type ModelNames } from './ui.tsx';

interface Node {
  readonly id: string;
  readonly label: string;
  readonly depth: number;
  readonly model?: string;
}

const NODE_WIDTH = 168;
const NODE_HEIGHT = 30;
const COLUMN_GAP = 64;
const ROW_GAP = 12;
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
    let height = 0;
    for (const [depth, column] of columns) {
      column.forEach((node, index) => {
        positions.set(node.id, {
          x: depth * (NODE_WIDTH + COLUMN_GAP),
          y: index * (NODE_HEIGHT + ROW_GAP),
        });
      });
      height = Math.max(height, column.length * (NODE_HEIGHT + ROW_GAP));
    }
    const width = (Math.max(...columns.keys()) + 1) * (NODE_WIDTH + COLUMN_GAP);
    return { nodes: [...nodes.values()], edges, positions, width, height };
  }, [detail]);

  if (detail.dependencies.length === 0)
    return <Empty>This operation does not depend on named models.</Empty>;
  return (
    <div
      class="diagram"
      role="img"
      aria-label={`Dependency graph of ${detail.summary.name} with ${detail.dependencies.length} models`}
    >
      <svg
        width={layout.width}
        height={Math.max(layout.height, NODE_HEIGHT)}
        viewBox={`-4 -4 ${layout.width + 8} ${Math.max(layout.height, NODE_HEIGHT) + 8}`}
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
              class="edge"
              d={`M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}`}
            />
          );
        })}
        {layout.nodes.map((node) => {
          const position = layout.positions.get(node.id);
          if (position === undefined) return null;
          const label = node.label.length > 22 ? `${node.label.slice(0, 21)}…` : node.label;
          const content = (
            <g transform={`translate(${position.x},${position.y})`}>
              <rect
                class={node.model === undefined ? 'node node-root' : 'node'}
                width={NODE_WIDTH}
                height={NODE_HEIGHT}
                rx={6}
              />
              <text x={10} y={NODE_HEIGHT / 2 + 4} class="node-label">
                {label}
              </text>
              <title>{node.label}</title>
            </g>
          );
          return node.model === undefined ? (
            <g key={node.id}>{content}</g>
          ) : (
            <a key={node.id} href={href({ page: 'models', id: node.model })}>
              {content}
            </a>
          );
        })}
      </svg>
      {detail.dependencies.length > MAX_NODES ? (
        <p class="muted small">
          Showing {MAX_NODES} of {detail.dependencies.length} models.
        </p>
      ) : null}
    </div>
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
        <div class="stack">
          <div class="row">
            <MethodBadge method={detail.summary.method} />
            <code>{detail.summary.path}</code>
            <a href={href({ page: 'operations', key: detail.summary.key })}>open in explorer</a>
          </div>
          <DependencyDiagram detail={detail} />
          <table class="table">
            <thead>
              <tr>
                <th scope="col">Model</th>
                <th scope="col">Why it is included</th>
              </tr>
            </thead>
            <tbody>
              {detail.dependencies.map((dependency) => (
                <tr key={dependency.id}>
                  <td>
                    <ModelLink id={dependency.id} names={names} />
                  </td>
                  <td class="muted">
                    {dependency.chain.length <= 1
                      ? `referenced directly by ${detail.summary.name}`
                      : `${detail.summary.name} → ${dependency.chain.join(' → ')}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Async>
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
  const [query, setQuery] = useState('');
  const matches = operations
    .filter((op) => `${op.name} ${op.path}`.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 50);
  return (
    <div class="page">
      <header class="page-header">
        <h1>Dependency graph</h1>
        <p class="muted">
          How operations depend on models, which models are unused, recursive or possibly
          duplicated.
        </p>
      </header>
      <Section title="Operation dependencies">
        <div class="row">
          <input
            type="search"
            class="input"
            placeholder="Find an operation"
            name="operation-search"
            aria-label="Find an operation"
            value={query}
            onInput={(e) => {
              setQuery(e.currentTarget.value);
            }}
          />
        </div>
        {query === '' ? null : (
          <ul class="list compact">
            {matches.map((op) => (
              <li key={op.key}>
                <a class="list-item" href={href({ page: 'graph', key: op.key })}>
                  <span class="row">
                    <MethodBadge method={op.method} />
                    <code>{op.path}</code>
                    <span class="muted">{op.name}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
        {selected === undefined ? (
          <Empty>Search and select an operation to see its transitive model dependencies.</Empty>
        ) : (
          <OperationDependencies operationKey={selected} names={names} version={version} />
        )}
      </Section>
      <Async resource={graph}>
        {(data) => (
          <div class="grid-2">
            <Section title={`Most referenced models`}>
              <ul class="bars">
                {data.mostUsed
                  .filter((m) => m.count > 0)
                  .map((model) => (
                    <li key={model.id}>
                      <ModelLink id={model.id} names={names} />
                      <span
                        class="bar"
                        style={{
                          width: `${(model.count / Math.max(1, data.mostUsed[0]?.count ?? 1)) * 100}%`,
                        }}
                      />
                      <span class="bar-value">{model.count}</span>
                    </li>
                  ))}
              </ul>
            </Section>
            <Section title={`Unused models (${data.unused.length})`}>
              {data.unused.length === 0 ? (
                <Empty>Every model is reachable from an operation.</Empty>
              ) : (
                <div class="wrap">
                  {data.unused.map((m) => (
                    <ModelLink key={m.id} id={m.id} names={names} />
                  ))}
                </div>
              )}
            </Section>
            <Section title={`Recursive models (${data.recursive.length})`}>
              {data.recursive.length === 0 ? (
                <Empty>No recursive models.</Empty>
              ) : (
                <div class="wrap">
                  {data.recursive.map((m) => (
                    <ModelLink key={m.id} id={m.id} names={names} />
                  ))}
                </div>
              )}
            </Section>
            <Section title={`Possible duplicates (${data.duplicates.length})`}>
              {data.duplicates.length === 0 ? (
                <Empty>No structurally identical models.</Empty>
              ) : (
                <ul class="deps">
                  {data.duplicates.map((group) => (
                    <li key={group.map((g) => g.id).join()}>
                      <Badge tone="warn">same shape</Badge>{' '}
                      {group.map((m) => (
                        <ModelLink key={m.id} id={m.id} names={names} />
                      ))}
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
        )}
      </Async>
    </div>
  );
}
