import { ChevronRight, FileDiff, RefreshCw, Save } from 'lucide-react';
import { useState } from 'react';
import type {
  DiffResponse,
  GenerateResponse,
  PreviewChange,
  PreviewResponse,
} from '../../api-types.ts';
import { api, useResource } from '../api.ts';
import { Async } from '../components/async.tsx';
import { DiagnosticsList } from '../components/diagnostics.tsx';
import { Mono, PageHeader, Stat } from '../components/page.tsx';
import { Badge, type BadgeTone } from '../components/ui/badge.tsx';
import { Button } from '../components/ui/button.tsx';
import { Card, CardContent, CardHeader } from '../components/ui/card.tsx';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../components/ui/collapsible.tsx';
import { ConfirmDialog } from '../components/ui/dialog.tsx';
import { ScrollArea } from '../components/ui/scroll-area.tsx';
import { Empty, ErrorState, Spinner } from '../components/ui/states.tsx';
import { Switch } from '../components/ui/switch.tsx';
import { cn } from '../lib/cn.ts';

const KIND: Record<PreviewChange['kind'], { tone: BadgeTone; symbol: string; label: string }> = {
  create: { tone: 'success', symbol: '+', label: 'New' },
  update: { tone: 'warning', symbol: '~', label: 'Changed' },
  delete: { tone: 'danger', symbol: '−', label: 'Removed' },
  unchanged: { tone: 'neutral', symbol: '=', label: 'Unchanged' },
};

function DiffView({ path }: { path: string }) {
  const resource = useResource<DiffResponse>(`/api/diff?path=${encodeURIComponent(path)}`, 0);
  return (
    <Async
      resource={resource}
      loading={
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      }
    >
      {(diff) =>
        diff.hunks.length === 0 ? (
          <Empty>No textual changes.</Empty>
        ) : (
          <ScrollArea
            orientation="both"
            className="rounded-lg border border-border bg-surface-sunken"
            viewportClassName="max-h-[min(70dvh,640px)]"
            viewportProps={{ role: 'region', 'aria-label': `Diff of ${path}`, tabIndex: 0 }}
          >
            {diff.hunks.map((hunk, index) => (
              <table
                key={index}
                className="w-full border-collapse font-mono text-[12px] leading-[1.65]"
              >
                <caption className="border-b border-border bg-muted/60 px-3 py-1 text-left text-[11.5px] text-muted-foreground">
                  @@ −{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
                </caption>
                <tbody>
                  {hunk.lines.map((line, i) => (
                    <tr
                      key={i}
                      className={cn(
                        line.kind === 'add' && 'bg-success/10',
                        line.kind === 'remove' && 'bg-danger/10',
                      )}
                    >
                      <td className="w-12 pr-2 text-right text-faint-foreground/80 select-none">
                        {line.oldLine ?? ''}
                      </td>
                      <td className="w-12 pr-2 text-right text-faint-foreground/80 select-none">
                        {line.newLine ?? ''}
                      </td>
                      <td
                        className={cn(
                          'w-5 text-center select-none',
                          line.kind === 'add' && 'text-success',
                          line.kind === 'remove' && 'text-danger',
                        )}
                      >
                        {line.kind === 'add' ? '+' : line.kind === 'remove' ? '−' : ''}
                      </td>
                      <td className="pr-4 whitespace-pre">{line.text}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}
          </ScrollArea>
        )
      }
    </Async>
  );
}

function FileRow({ change }: { change: PreviewChange }) {
  const [open, setOpen] = useState(false);
  const kind = KIND[change.kind];
  const disabled = change.kind === 'unchanged';
  return (
    <Collapsible open={open} onOpenChange={setOpen} disabled={disabled}>
      <CollapsibleTrigger
        className={cn(
          'group flex w-full cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-left outline-none hover:bg-muted/70 focus-visible:ring-[3px] focus-visible:ring-ring/25 disabled:cursor-default disabled:hover:bg-transparent',
        )}
      >
        <ChevronRight
          className={cn(
            'size-3.5 shrink-0 text-faint-foreground transition-transform group-data-[state=open]:rotate-90',
            disabled && 'invisible',
          )}
        />
        <Badge tone={kind.tone} className="w-5 justify-center px-0 font-mono">
          <span aria-hidden="true">{kind.symbol}</span>
          <span className="sr-only">{kind.label}</span>
        </Badge>
        <code className="min-w-0 flex-1 truncate font-mono text-[12.5px]">{change.path}</code>
        <span className="font-mono text-[12px] tabular-nums">
          {change.additions > 0 ? <span className="text-success">+{change.additions}</span> : null}
          {change.deletions > 0 ? (
            <span className="ml-2 text-danger">−{change.deletions}</span>
          ) : null}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-2.5 pt-1 pb-3">
        {open ? <DiffView path={change.path} /> : null}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function GeneratePage({ onGenerated }: { onGenerated: () => void }) {
  const [preview, setPreview] = useState<PreviewResponse | undefined>();
  const [busy, setBusy] = useState<'preview' | 'write' | undefined>();
  const [error, setError] = useState<Error | undefined>();
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<GenerateResponse | undefined>();
  const [showUnchanged, setShowUnchanged] = useState(false);

  const run = <T,>(
    kind: 'preview' | 'write',
    request: () => Promise<T>,
    done: (value: T) => void,
  ): void => {
    setBusy(kind);
    setError(undefined);
    void (async () => {
      try {
        done(await request());
      } catch (e) {
        setError(e instanceof Error ? e : new Error(String(e)));
      } finally {
        setBusy(undefined);
      }
    })();
  };

  const computePreview = (): void => {
    setResult(undefined);
    run('preview', () => api<PreviewResponse>('/api/preview', { method: 'POST' }), setPreview);
  };

  const pending = preview?.changes.filter((c) => c.kind !== 'unchanged') ?? [];
  const write = (): void => {
    setConfirming(false);
    run(
      'write',
      () => api<GenerateResponse>('/api/generate', { method: 'POST', body: { confirm: true } }),
      (value) => {
        setResult(value);
        setPreview(undefined);
        onGenerated();
      },
    );
  };

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Generate"
        description="Review exactly what would change in the output directory before writing. Only files recorded in the output manifest are ever overwritten or deleted."
        actions={
          <>
            <Button onClick={computePreview} disabled={busy !== undefined}>
              {busy === 'preview' ? (
                <Spinner />
              ) : preview === undefined ? (
                <FileDiff />
              ) : (
                <RefreshCw />
              )}
              {busy === 'preview'
                ? 'Computing…'
                : preview === undefined
                  ? 'Compute preview'
                  : 'Refresh preview'}
            </Button>
            {preview !== undefined && preview.ok && pending.length > 0 ? (
              <Button
                variant="primary"
                disabled={busy !== undefined}
                onClick={() => {
                  setConfirming(true);
                }}
              >
                {busy === 'write' ? <Spinner className="text-primary-foreground" /> : <Save />}
                Write {pending.length} change{pending.length === 1 ? '' : 's'}
              </Button>
            ) : null}
          </>
        }
      />
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Write generated files?"
        description={
          <>
            {pending.length} file{pending.length === 1 ? '' : 's'} in{' '}
            <Mono>{preview?.directory}</Mono> will be created, updated or removed. Files the
            generator does not own are never touched.
          </>
        }
        confirmLabel="Write files"
        onConfirm={write}
      >
        <ul className="mt-4 flex flex-wrap gap-2">
          {(['create', 'update', 'delete'] as const).map((kind) => (
            <li key={kind}>
              <Badge tone={KIND[kind].tone}>
                {pending.filter((c) => c.kind === kind).length} {KIND[kind].label.toLowerCase()}
              </Badge>
            </li>
          ))}
        </ul>
      </ConfirmDialog>
      {error === undefined ? null : <ErrorState error={error} />}
      {result === undefined ? null : result.ok && result.write !== undefined ? (
        <output className="block rounded-lg border border-success/25 bg-success/8 px-4 py-3 text-[13px]">
          <span className="font-medium text-success">Done.</span> {result.write.created.length}{' '}
          created, {result.write.updated.length} updated, {result.write.deleted.length} deleted,{' '}
          {result.write.unchanged.length} unchanged.
        </output>
      ) : (
        <>
          <ErrorState
            error={new Error('Nothing was written. See the diagnostics below.')}
            title="Generation failed"
          />
          <Card>
            <CardHeader title="Diagnostics" />
            <CardContent>
              <DiagnosticsList diagnostics={result.diagnostics} />
            </CardContent>
          </Card>
        </>
      )}
      {preview === undefined ? (
        result === undefined && busy !== 'preview' ? (
          <Card>
            <Empty icon={<FileDiff />} className="py-14">
              Compute a preview to see new, changed and removed files with their diffs.
            </Empty>
          </Card>
        ) : null
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {(['create', 'update', 'delete', 'unchanged'] as const).map((kind) => (
              <div
                key={kind}
                className="rounded-xl border border-border bg-surface p-4 shadow-card"
              >
                <Stat
                  label={KIND[kind].label}
                  value={preview.changes.filter((c) => c.kind === kind).length}
                />
              </div>
            ))}
          </div>
          <Card>
            <CardHeader
              title="Files"
              description={<Mono>{preview.directory}</Mono>}
              actions={
                <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
                  <Switch
                    id="show-unchanged"
                    name="show-unchanged"
                    checked={showUnchanged}
                    onCheckedChange={setShowUnchanged}
                  />
                  <label htmlFor="show-unchanged" className="cursor-pointer">
                    Show unchanged
                  </label>
                </div>
              }
            />
            <CardContent className="px-3">
              {pending.length === 0 && !showUnchanged ? (
                <Empty>The output directory is up to date.</Empty>
              ) : (
                <ul className="flex flex-col">
                  {preview.changes
                    .filter((c) => showUnchanged || c.kind !== 'unchanged')
                    .map((change) => (
                      <li key={change.path}>
                        <FileRow change={change} />
                      </li>
                    ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader title="Diagnostics" />
            <CardContent>
              <DiagnosticsList diagnostics={preview.diagnostics} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
