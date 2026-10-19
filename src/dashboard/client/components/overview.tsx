import type { OverviewResponse } from '../../api-types.ts';
import { href } from '../router.ts';
import { Badge, DiagnosticsList, MethodBadge, Prose, Section } from './ui.tsx';

const STATUS_TEXT = {
  never: { tone: 'warn', label: 'Not generated yet' },
  'up-to-date': { tone: 'ok', label: 'Up to date' },
  stale: { tone: 'warn', label: 'Out of date' },
  failed: { tone: 'danger', label: 'Compilation failed' },
} as const;

export function Overview({ data }: { data: OverviewResponse }) {
  const methodTotal = Math.max(1, ...Object.values(data.methods));
  const errors = data.diagnostics.filter((d) => d.severity === 'error').length;
  const warnings = data.diagnostics.filter((d) => d.severity === 'warning').length;
  const unresolved = data.diagnostics.filter((d) => d.code.startsWith('ref/'));
  const unsupported = data.diagnostics.filter((d) =>
    /unsupported|foreign-keyword|ignored|skipped/.test(d.code),
  );
  const status = STATUS_TEXT[data.generation.status];
  return (
    <div class="page">
      <header class="page-header">
        <h1>{data.title}</h1>
        <div class="row">
          <Badge>v{data.version}</Badge>
          <Badge tone="info">
            {data.specVersion} ({data.specVersionRaw})
          </Badge>
          {data.servers[0] === undefined ? null : <code class="muted">{data.servers[0]}</code>}
        </div>
        <Prose text={data.description} />
      </header>

      <div class="cards">
        <a class="card stat" href={href({ page: 'operations' })}>
          <span class="stat-value">{data.counts.operations}</span>
          <span class="stat-label">Operations</span>
        </a>
        <a class="card stat" href={href({ page: 'models' })}>
          <span class="stat-value">{data.counts.models}</span>
          <span class="stat-label">Models</span>
        </a>
        <a class="card stat" href={href({ page: 'generate' })}>
          <span class="stat-value">{data.counts.files}</span>
          <span class="stat-label">Generated files</span>
        </a>
        <div class={`card stat ${errors > 0 ? 'stat-danger' : warnings > 0 ? 'stat-warn' : ''}`}>
          <span class="stat-value">
            {errors} / {warnings}
          </span>
          <span class="stat-label">Errors / warnings</span>
        </div>
      </div>

      <div class="grid-2">
        <Section title="HTTP methods">
          <ul class="bars" aria-label="Operations per HTTP method">
            {Object.entries(data.methods)
              .sort(([, a], [, b]) => b - a)
              .map(([method, count]) => (
                <li key={method}>
                  <MethodBadge method={method} />
                  <span class="bar" style={{ width: `${(count / methodTotal) * 100}%` }} />
                  <span class="bar-value">{count}</span>
                </li>
              ))}
          </ul>
        </Section>
        <Section title="Generation">
          <dl class="meta">
            <dt>Status</dt>
            <dd>
              <Badge tone={status.tone}>{status.label}</Badge>
              {data.generation.status === 'stale' ? (
                <span class="muted"> {data.generation.staleFiles} files differ</span>
              ) : null}
            </dd>
            <dt>Output</dt>
            <dd>
              <code>{data.config.output}</code> · {data.config.language} · {data.config.adapter}
              {data.config.reactQuery ? ' · React Query' : ''}
            </dd>
            <dt>Manifest</dt>
            <dd>
              {data.generation.manifestFiles} files
              {data.generation.generatorVersion === undefined
                ? ''
                : ` · generator ${data.generation.generatorVersion}`}
            </dd>
            {data.generation.lastRun === undefined ? null : (
              <>
                <dt>Last run</dt>
                <dd>
                  <Badge tone={data.generation.lastRun.ok ? 'ok' : 'danger'}>
                    {data.generation.lastRun.ok ? 'succeeded' : 'failed'}
                  </Badge>{' '}
                  {data.generation.lastRun.summary} ·{' '}
                  {new Date(data.generation.lastRun.at).toLocaleTimeString()}
                </dd>
              </>
            )}
            <dt>Input</dt>
            <dd>
              <code>{data.config.input}</code>
            </dd>
            {data.config.configFile === undefined ? null : (
              <>
                <dt>Config</dt>
                <dd>
                  <code>{data.config.configFile}</code>
                </dd>
              </>
            )}
            <dt>Timings</dt>
            <dd class="muted">
              {Object.entries(data.timings)
                .map(([stage, ms]) => `${stage} ${ms} ms`)
                .join(' · ')}
            </dd>
          </dl>
        </Section>
      </div>

      <div class="grid-2">
        <Section title={`Tags (${data.tags.length})`}>
          <table class="table">
            <thead>
              <tr>
                <th scope="col">Tag</th>
                <th scope="col" class="num">
                  Operations
                </th>
              </tr>
            </thead>
            <tbody>
              {data.tags.map((tag) => (
                <tr key={tag.name}>
                  <td>
                    <strong>{tag.name}</strong>
                    {tag.description === undefined ? null : (
                      <div class="muted small">{tag.description}</div>
                    )}
                  </td>
                  <td class="num">{tag.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
        <Section title="Compatibility">
          <dl class="meta">
            <dt>Unresolved references</dt>
            <dd>
              {unresolved.length === 0 ? (
                <Badge tone="ok">none</Badge>
              ) : (
                <Badge tone="danger">{unresolved.length}</Badge>
              )}
            </dd>
            <dt>Unsupported or ignored constructs</dt>
            <dd>
              {unsupported.length === 0 ? (
                <Badge tone="ok">none</Badge>
              ) : (
                <Badge tone="warn">{unsupported.length}</Badge>
              )}
            </dd>
            <dt>Deprecated operations</dt>
            <dd>{data.counts.deprecated}</dd>
          </dl>
        </Section>
      </div>

      <Section title="Diagnostics">
        <DiagnosticsList diagnostics={data.diagnostics} />
      </Section>
    </div>
  );
}
