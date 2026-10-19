import { useState } from 'preact/hooks';
import type { DiffResponse, GenerateResponse, PreviewResponse } from '../../api-types.ts';
import { api, useResource } from '../api.ts';
import { Async, Badge, DiagnosticsList, Empty, ErrorState, Loading, Section } from './ui.tsx';

const KIND_TONE = { create: 'ok', update: 'warn', delete: 'danger', unchanged: 'neutral' } as const;
const KIND_SYMBOL = { create: '+', update: '~', delete: '−', unchanged: '=' } as const;

function DiffView({ path }: { path: string }) {
  const resource = useResource<DiffResponse>(`/api/diff?path=${encodeURIComponent(path)}`, 0);
  return (
    <Async resource={resource}>
      {(diff) =>
        diff.hunks.length === 0 ? (
          <Empty>No textual changes.</Empty>
        ) : (
          <div class="diff" role="region" aria-label={`Diff of ${path}`}>
            {diff.hunks.map((hunk, index) => (
              <table key={index} class="diff-hunk">
                <caption class="muted small">
                  @@ −{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
                </caption>
                <tbody>
                  {hunk.lines.map((line, i) => (
                    <tr key={i} class={`diff-${line.kind}`}>
                      <td class="ln">{line.oldLine ?? ''}</td>
                      <td class="ln">{line.newLine ?? ''}</td>
                      <td class="sign">
                        {line.kind === 'add' ? '+' : line.kind === 'remove' ? '−' : ' '}
                      </td>
                      <td class="text">{line.text}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}
          </div>
        )
      }
    </Async>
  );
}

export function GeneratePage({ onGenerated }: { onGenerated: () => void }) {
  const [preview, setPreview] = useState<PreviewResponse | undefined>();
  const [busy, setBusy] = useState<'preview' | 'write' | undefined>();
  const [error, setError] = useState<Error | undefined>();
  const [open, setOpen] = useState<string | undefined>();
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
    request()
      .then(done, (e: unknown) => {
        setError(e instanceof Error ? e : new Error(String(e)));
      })
      .finally(() => {
        setBusy(undefined);
      });
  };

  const computePreview = (): void => {
    setOpen(undefined);
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
    <div class="page">
      <header class="page-header">
        <h1>Generation preview</h1>
        <p class="muted">
          Review exactly what would change in the output directory before writing. Only files
          recorded in the output manifest are ever overwritten or deleted.
        </p>
        <div class="row">
          <button
            type="button"
            class="button"
            onClick={computePreview}
            disabled={busy !== undefined}
          >
            {busy === 'preview'
              ? 'Computing…'
              : preview === undefined
                ? 'Compute preview'
                : 'Refresh preview'}
          </button>
          {preview !== undefined && preview.ok && pending.length > 0 && !confirming ? (
            <button
              type="button"
              class="button primary"
              onClick={() => {
                setConfirming(true);
              }}
            >
              Write {pending.length} change{pending.length === 1 ? '' : 's'}…
            </button>
          ) : null}
          {confirming ? (
            <span class="confirm" role="group" aria-label="Confirm generation">
              <span>Write files to {preview?.directory}?</span>
              <button
                type="button"
                class="button danger"
                onClick={write}
                disabled={busy !== undefined}
              >
                Confirm
              </button>
              <button
                type="button"
                class="button ghost"
                onClick={() => {
                  setConfirming(false);
                }}
              >
                Cancel
              </button>
            </span>
          ) : null}
        </div>
      </header>
      {busy === 'write' ? <Loading label="Writing files…" /> : null}
      {error === undefined ? null : <ErrorState error={error} />}
      {result === undefined ? null : (
        <div class={`state ${result.ok ? 'state-ok' : 'state-error'}`} role="status">
          {result.ok && result.write !== undefined
            ? `Done: ${result.write.created.length} created, ${result.write.updated.length} updated, ${result.write.deleted.length} deleted, ${result.write.unchanged.length} unchanged.`
            : 'Generation failed; nothing was written. See diagnostics below.'}
        </div>
      )}
      {result !== undefined && !result.ok ? (
        <DiagnosticsList diagnostics={result.diagnostics} />
      ) : null}
      {preview === undefined ? null : (
        <>
          <div class="cards">
            {(['create', 'update', 'delete', 'unchanged'] as const).map((kind) => (
              <div key={kind} class="card stat">
                <span class="stat-value">
                  {preview.changes.filter((c) => c.kind === kind).length}
                </span>
                <span class="stat-label">
                  {kind === 'create'
                    ? 'New'
                    : kind === 'update'
                      ? 'Changed'
                      : kind === 'delete'
                        ? 'Removed'
                        : 'Unchanged'}
                </span>
              </div>
            ))}
          </div>
          <Section
            title={`Files in ${preview.directory}`}
            actions={
              <label class="small">
                <input
                  name="show-unchanged"
                  type="checkbox"
                  checked={showUnchanged}
                  onChange={(e) => {
                    setShowUnchanged(e.currentTarget.checked);
                  }}
                />{' '}
                show unchanged
              </label>
            }
          >
            {pending.length === 0 && !showUnchanged ? (
              <Empty>The output directory is up to date.</Empty>
            ) : (
              <ul class="files">
                {preview.changes
                  .filter((c) => showUnchanged || c.kind !== 'unchanged')
                  .map((change) => (
                    <li key={change.path}>
                      <button
                        type="button"
                        class="file-row"
                        aria-expanded={open === change.path}
                        disabled={change.kind === 'unchanged'}
                        onClick={() => {
                          setOpen(open === change.path ? undefined : change.path);
                        }}
                      >
                        <Badge tone={KIND_TONE[change.kind]}>{KIND_SYMBOL[change.kind]}</Badge>
                        <code>{change.path}</code>
                        <span class="muted small">
                          {change.additions > 0 ? `+${change.additions} ` : ''}
                          {change.deletions > 0 ? `−${change.deletions}` : ''}
                        </span>
                      </button>
                      {open === change.path ? <DiffView path={change.path} /> : null}
                    </li>
                  ))}
              </ul>
            )}
          </Section>
          <Section title="Diagnostics">
            <DiagnosticsList diagnostics={preview.diagnostics} />
          </Section>
        </>
      )}
    </div>
  );
}
