import { ScanSearch } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { UsageReport } from '../../../service/types.ts';
import { api } from '../api.ts';
import { PageHeader, Stat } from '../components/page.tsx';
import { Badge, type BadgeTone } from '../components/ui/badge.tsx';
import { Button } from '../components/ui/button.tsx';
import { Card, CardContent, CardHeader } from '../components/ui/card.tsx';
import { SearchInput } from '../components/ui/input.tsx';
import { Select } from '../components/ui/select.tsx';
import { Empty, ErrorState, Loading, Spinner } from '../components/ui/states.tsx';
import { Table, TableBody, TableHead, TableRow, Td, Th } from '../components/ui/table.tsx';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs.tsx';

type StatusFilter = 'all' | 'used' | 'imported' | 'unused' | 'unknown';
type KindFilter = 'all' | 'operation' | 'hook' | 'model' | 'other';

const STATUS: Record<UsageReport['entries'][number]['status'], { tone: BadgeTone; label: string }> =
  {
    used: { tone: 'success', label: 'used' },
    imported: { tone: 'info', label: 'imported' },
    unused: { tone: 'neutral', label: 'not imported' },
    unknown: { tone: 'warning', label: 'undetermined' },
  };

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
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Usage"
        description={
          <>
            Statically scans your application source for imports of the generated client. It reports
            what the code imports, not what runs: dynamic imports and namespace objects that escape
            analysis are marked <em>undetermined</em> rather than unused.
          </>
        }
        actions={
          <Button variant="primary" onClick={scan} disabled={scanning}>
            {scanning ? <Spinner className="text-primary-foreground" /> : <ScanSearch />}
            {scanning ? 'Scanning…' : report === undefined ? 'Scan project' : 'Scan again'}
          </Button>
        }
      />
      {error === undefined ? null : <ErrorState error={error} />}
      {report === undefined ? (
        scanning ? (
          <Loading label="Scanning source files…" />
        ) : (
          <Card>
            <Empty icon={<ScanSearch />} className="py-14">
              Scan the project to see which operations, hooks and models your code uses.
            </Empty>
          </Card>
        )
      ) : report.status === 'unavailable' ? (
        <ErrorState
          error={new Error(report.reason ?? 'Usage scanning is unavailable.')}
          title="Usage scanning is unavailable"
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {[
              [
                'Operations used',
                count((e) => e.kind === 'operation' && e.status === 'used'),
                undefined,
              ],
              [
                'Operations not imported',
                count((e) => e.kind === 'operation' && e.status === 'unused'),
                undefined,
              ],
              ['Hooks used', count((e) => e.kind === 'hook' && e.status === 'used'), undefined],
              ['Undetermined', count((e) => e.status === 'unknown'), 'warning' as const],
            ].map(([label, value, tone]) => (
              <div
                key={String(label)}
                className="rounded-xl border border-border bg-surface p-4 shadow-card"
              >
                <Stat
                  label={label}
                  value={value}
                  {...(tone === 'warning' && Number(value) > 0 ? { tone: 'warning' as const } : {})}
                />
              </div>
            ))}
          </div>
          <p className="-mt-4 text-[12.5px] text-muted-foreground">
            {report.scannedFiles} {report.scannedFiles === 1 ? 'file' : 'files'} scanned in{' '}
            {report.durationMs} ms
            {report.scanner === undefined ? '' : ` with ${report.scanner}`}
            {report.truncated ? ' (file limit reached; results are incomplete)' : ''}.
          </p>
          <Card>
            <CardHeader title="Exports" description={`${entries.length} shown`} />
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <SearchInput
                  className="w-full sm:w-64"
                  name="export-search"
                  aria-label="Filter exports"
                  placeholder="Filter exports"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.currentTarget.value);
                  }}
                />
                <Tabs
                  value={kind}
                  onValueChange={(value) => {
                    if (['all', 'operation', 'hook', 'model', 'other'].includes(value))
                      setKind(value as KindFilter);
                  }}
                >
                  <TabsList variant="pill" aria-label="Kind">
                    <TabsTrigger value="operation">Operations</TabsTrigger>
                    <TabsTrigger value="hook">Hooks</TabsTrigger>
                    <TabsTrigger value="model">Models</TabsTrigger>
                    <TabsTrigger value="other">Other</TabsTrigger>
                    <TabsTrigger value="all">All</TabsTrigger>
                  </TabsList>
                </Tabs>
                <Select<StatusFilter>
                  className="w-48"
                  label="Status"
                  value={status}
                  onValueChange={setStatus}
                  options={[
                    { value: 'all', label: 'Any status' },
                    { value: 'used', label: 'Used' },
                    { value: 'imported', label: 'Imported, not referenced' },
                    { value: 'unused', label: 'Not imported' },
                    { value: 'unknown', label: 'Undetermined' },
                  ]}
                />
              </div>
              {entries.length === 0 ? (
                <Empty>No exports match.</Empty>
              ) : (
                <Table>
                  <TableHead>
                    <TableRow>
                      <Th>Export</Th>
                      <Th>Status</Th>
                      <Th className="text-right">References</Th>
                      <Th>Imported in</Th>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {entries.slice(0, 500).map((entry) => (
                      <TableRow key={`${entry.module}:${entry.name}`}>
                        <Td>
                          <code className="font-mono text-[12.5px] font-medium">{entry.name}</code>
                          <div className="mt-0.5 text-[12px] text-muted-foreground">
                            {entry.kind} · <span className="font-mono">{entry.module}</span>
                          </div>
                        </Td>
                        <Td>
                          <Badge tone={STATUS[entry.status].tone}>
                            {STATUS[entry.status].label}
                          </Badge>
                        </Td>
                        <Td className="text-right font-mono text-[12.5px] tabular-nums">
                          {entry.references}
                        </Td>
                        <Td className="text-[12px]">
                          {entry.locations.slice(0, 4).map((location) => (
                            <div
                              key={`${location.file}:${location.line}`}
                              className="font-mono break-all"
                            >
                              {location.file}
                              {location.line === 0 ? (
                                ''
                              ) : (
                                <span className="text-faint-foreground">:{location.line}</span>
                              )}
                            </div>
                          ))}
                          {entry.locations.length > 4 ? (
                            <div className="text-muted-foreground">
                              +{entry.locations.length - 4} more
                            </div>
                          ) : null}
                        </Td>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader
              title="Undetermined usages"
              actions={
                <Badge tone={report.ambiguous.length > 0 ? 'warning' : 'success'}>
                  {report.ambiguous.length}
                </Badge>
              }
            />
            <CardContent>
              {report.ambiguous.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">
                  Every import of the generated client was resolved statically.
                </p>
              ) : (
                <ul className="flex flex-col divide-y divide-border/70">
                  {report.ambiguous.map((item, index) => (
                    <li
                      key={index}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-[13px]"
                    >
                      <code className="font-mono text-[12.5px]">{item.module}</code>
                      <span className="text-muted-foreground">{item.reason}</span>
                      <span className="ml-auto font-mono text-[12px] text-faint-foreground">
                        {item.location.file}
                        {item.location.line === 0 ? '' : `:${item.location.line}`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
