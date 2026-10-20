import { CircleAlert, Info, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import type { Diagnostic } from '../../api-types.ts';
import { cn } from '../lib/cn.ts';
import { Empty } from './ui/states.tsx';
import { TabCount, Tabs, TabsList, TabsTrigger } from './ui/tabs.tsx';

type Severity = 'all' | 'error' | 'warning' | 'info';

const ICON = {
  error: <CircleAlert className="size-4 text-danger" />,
  warning: <TriangleAlert className="size-4 text-warning" />,
  info: <Info className="size-4 text-info" />,
} as const;

export function DiagnosticsList({
  diagnostics,
  limit = 200,
}: {
  diagnostics: readonly Diagnostic[];
  limit?: number;
}) {
  const [severity, setSeverity] = useState<Severity>('all');
  if (diagnostics.length === 0)
    return <Empty>No diagnostics. The specification was processed cleanly.</Empty>;
  const count = (s: Diagnostic['severity']): number =>
    diagnostics.filter((d) => d.severity === s).length;
  const shown = diagnostics.filter((d) => severity === 'all' || d.severity === severity);
  return (
    <div className="flex flex-col gap-3">
      <Tabs
        value={severity}
        onValueChange={(value) => {
          if (value === 'all' || value === 'error' || value === 'warning' || value === 'info')
            setSeverity(value);
        }}
      >
        <TabsList variant="pill" aria-label="Severity">
          <TabsTrigger value="all">
            All <TabCount>{diagnostics.length}</TabCount>
          </TabsTrigger>
          <TabsTrigger value="error">
            Errors <TabCount>{count('error')}</TabCount>
          </TabsTrigger>
          <TabsTrigger value="warning">
            Warnings <TabCount>{count('warning')}</TabCount>
          </TabsTrigger>
          <TabsTrigger value="info">
            Notes <TabCount>{count('info')}</TabCount>
          </TabsTrigger>
        </TabsList>
      </Tabs>
      {shown.length === 0 ? (
        <Empty>Nothing at this severity.</Empty>
      ) : (
        <ul className="flex flex-col divide-y divide-border/70">
          {shown.slice(0, limit).map((d, i) => (
            <li key={i} className={cn('diagnostic flex gap-3 py-3', `diagnostic-${d.severity}`)}>
              <span className="mt-0.5 shrink-0">{ICON[d.severity]}</span>
              <div className="flex min-w-0 flex-col gap-1">
                <div className="text-[13.5px] leading-5">{d.message}</div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
                  <code className="font-mono">{d.code}</code>
                  {d.location === undefined ? null : (
                    <span className="font-mono break-all">
                      {d.location.file.split('/').at(-1)}
                      {d.location.line === undefined ? '' : `:${d.location.line}`}
                      {d.location.pointer === undefined || d.location.pointer === ''
                        ? ''
                        : ` #${d.location.pointer}`}
                    </span>
                  )}
                  {d.operation === undefined ? null : <span>in {d.operation}</span>}
                </div>
                {d.hint === undefined ? null : (
                  <div className="mt-0.5 rounded-md border-l-2 border-marigold bg-highlight/60 px-2.5 py-1.5 text-[12.5px] text-foreground/85">
                    {d.hint}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {shown.length > limit ? (
        <p className="text-[12.5px] text-muted-foreground">
          Showing {limit} of {shown.length}.
        </p>
      ) : null}
    </div>
  );
}
