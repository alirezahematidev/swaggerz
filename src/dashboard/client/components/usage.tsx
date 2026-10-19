import { useMemo, useState } from 'preact/hooks';
import type { UsageReport } from '../../api-types.ts';
import { api } from '../api.ts';
import { Badge, Empty, ErrorState, Loading, Section } from './ui.tsx';

type StatusFilter = 'all' | 'used' | 'imported' | 'unused' | 'unknown';
type KindFilter = 'all' | 'operation' | 'hook' | 'model' | 'other';

const STATUS_TONE = { used: 'ok', imported: 'info', unused: 'neutral', unknown: 'warn' } as const;

export function UsagePage() {
  const [report, setReport] = useState<UsageReport | undefined>();
  const [error, setError] = useState<Error | undefined>();
  const [scanning, setScanning] = useState(false);
  const [status, setStatus] = useState<StatusFilter>('all');
  const [kind, setKind] = useState<KindFilter>('operation');
  const [query, setQuery] = useState('');

  const scan = (): void => {
    setScanning(true);
    setError(undefined);
    api<UsageReport>('/api/usage', { method: 'POST' })
      .then(setReport, (e: unknown) => {
        setError(e instanceof Error ? e : new Error(String(e)));
      })
      .finally(() => {
        setScanning(false);
      });
  };

  const entries = useMemo(() => {
    if (report === undefined) return [];
    return report.entries.filter((entry) => {
      if (status !== 'all' && entry.status !== status) return false;
      const group =
        entry.kind === 'operation' || entry.kind === 'hook' || entry.kind === 'model'
          ? entry.kind
          : 'other';
      if (kind !== 'all' && group !== kind) return false;
      return (
        query === '' || `${entry.name} ${entry.module}`.toLowerCase().includes(query.toLowerCase())
      );
    });
  }, [report, status, kind, query]);

  const count = (predicate: (e: UsageReport['entries'][number]) => boolean): number =>
    report?.entries.filter(predicate).length ?? 0;

  return (
    <div class="page">
      <header class="page-header">
        <h1>Usage explorer</h1>
        <p class="muted">
          Statically scans your application source for imports of the generated client using the
          TypeScript compiler. It reports what the code imports, not what runs: dynamic imports and
          namespace objects passed around are marked <Badge tone="warn">unknown</Badge> rather than
          unused.
        </p>
        <div class="row">
          <button type="button" class="button primary" onClick={scan} disabled={scanning}>
            {scanning ? 'Scanning…' : report === undefined ? 'Scan project' : 'Scan again'}
          </button>
        </div>
      </header>
      {scanning ? <Loading label="Scanning source files…" /> : null}
      {error === undefined ? null : <ErrorState error={error} />}
      {report === undefined ? null : report.status === 'unavailable' ? (
        <div class="state state-error" role="alert">
          {report.reason}
        </div>
      ) : (
        <>
          <div class="cards">
            <div class="card stat">
              <span class="stat-value">
                {count((e) => e.kind === 'operation' && e.status === 'used')}
              </span>
              <span class="stat-label">Operations used</span>
            </div>
            <div class="card stat">
              <span class="stat-value">
                {count((e) => e.kind === 'operation' && e.status === 'unused')}
              </span>
              <span class="stat-label">Operations not imported</span>
            </div>
            <div class="card stat">
              <span class="stat-value">
                {count((e) => e.kind === 'hook' && e.status === 'used')}
              </span>
              <span class="stat-label">Hooks used</span>
            </div>
            <div class={`card stat ${count((e) => e.status === 'unknown') > 0 ? 'stat-warn' : ''}`}>
              <span class="stat-value">{count((e) => e.status === 'unknown')}</span>
              <span class="stat-label">Undetermined</span>
            </div>
          </div>
          <p class="muted small">
            {report.scannedFiles} {report.scannedFiles === 1 ? 'file' : 'files'} scanned in{' '}
            {report.durationMs} ms with TypeScript {report.typescriptVersion}
            {report.truncated ? ' (file limit reached; results are incomplete)' : ''}.
          </p>
          <Section title="Exports">
            <div class="row filters-row">
              <input
                type="search"
                class="input"
                placeholder="Filter exports"
                name="export-search"
                aria-label="Filter exports"
                value={query}
                onInput={(e) => {
                  setQuery(e.currentTarget.value);
                }}
              />
              <select
                class="input"
                name="kind"
                aria-label="Kind"
                value={kind}
                onChange={(e) => {
                  setKind(e.currentTarget.value as KindFilter);
                }}
              >
                <option value="operation">Operations</option>
                <option value="hook">React Query hooks</option>
                <option value="model">Models</option>
                <option value="other">Other exports</option>
                <option value="all">All kinds</option>
              </select>
              <select
                class="input"
                name="status"
                aria-label="Status"
                value={status}
                onChange={(e) => {
                  setStatus(e.currentTarget.value as StatusFilter);
                }}
              >
                <option value="all">Any status</option>
                <option value="used">Used</option>
                <option value="imported">Imported, not referenced</option>
                <option value="unused">Not imported</option>
                <option value="unknown">Undetermined</option>
              </select>
            </div>
            {entries.length === 0 ? (
              <Empty>No exports match.</Empty>
            ) : (
              <table class="table">
                <thead>
                  <tr>
                    <th scope="col">Export</th>
                    <th scope="col">Status</th>
                    <th scope="col" class="num">
                      References
                    </th>
                    <th scope="col">Imported in</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.slice(0, 500).map((entry) => (
                    <tr key={`${entry.module}:${entry.name}`}>
                      <td>
                        <code>{entry.name}</code>
                        <div class="muted small">
                          {entry.kind} · {entry.module}
                        </div>
                      </td>
                      <td>
                        <Badge tone={STATUS_TONE[entry.status]}>{entry.status}</Badge>
                      </td>
                      <td class="num">{entry.references}</td>
                      <td class="small">
                        {entry.locations.slice(0, 5).map((location) => (
                          <div key={`${location.file}:${location.line}`}>
                            <code>
                              {location.file}
                              {location.line === 0 ? '' : `:${location.line}`}
                            </code>
                          </div>
                        ))}
                        {entry.locations.length > 5 ? (
                          <div class="muted">+{entry.locations.length - 5} more</div>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>
          <Section title={`Undetermined usages (${report.ambiguous.length})`}>
            {report.ambiguous.length === 0 ? (
              <Empty>Every import of the generated client was resolved statically.</Empty>
            ) : (
              <ul class="deps">
                {report.ambiguous.map((item, index) => (
                  <li key={index}>
                    <code>{item.module}</code> — {item.reason}{' '}
                    <span class="muted small">
                      {item.location.file}
                      {item.location.line === 0 ? '' : `:${item.location.line}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </>
      )}
    </div>
  );
}
