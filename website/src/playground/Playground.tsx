/**
 * The playground: a specification on the left, the client swaggerz generates for it on the
 * right, compiled in a worker by the same pipeline as the CLI. Nothing leaves the browser; the
 * state is kept in the URL fragment so a link reproduces it.
 */
import { ChevronDown, Download, FileUp, Link2, RotateCcw } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { CodeBlock } from '../../../src/dashboard/client/components/code.tsx';
import { Button } from '../../../src/dashboard/client/components/ui/button.tsx';
import { ScrollArea } from '../../../src/dashboard/client/components/ui/scroll-area.tsx';
import { Spinner } from '../../../src/dashboard/client/components/ui/states.tsx';
import { Switch } from '../../../src/dashboard/client/components/ui/switch.tsx';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '../../../src/dashboard/client/components/ui/toggle-group.tsx';
import { Tooltip, TooltipProvider } from '../../../src/dashboard/client/components/ui/tooltip.tsx';
import { cn } from '../../../src/dashboard/client/lib/cn.ts';
import type { BrowserCompileResult, BrowserDiagnostic } from '../../playground/compiler.ts';
import type { UserConfig } from '../../../src/config/types.ts';
import { highlightLine, type TokenKind } from './highlight.ts';
import { SAMPLES } from './samples.ts';
import {
  decodeState,
  DEFAULT_OPTIONS,
  encodeState,
  type PlaygroundOptions,
  type PlaygroundState,
} from './share.ts';
import type { CompileRequest, CompileResponse } from './worker.ts';
import { createZip } from './zip.ts';
import './playground.css';

const CONFIG_FILE = 'swaggerz.config.ts';
const OUTPUT_PREFIX = 'src/generated/api';

function toConfig(state: PlaygroundState): UserConfig {
  const { options } = state;
  const features: NonNullable<UserConfig['features']> = {
    ...(options.hooks === 'none'
      ? {}
      : options.hooks === 'swr'
        ? { swr: true }
        : { query: options.hooks === 'react' ? true : { framework: options.hooks } }),
    ...(options.validation === 'none' ? {} : { validation: options.validation }),
  };
  return {
    spec: { version: 'auto', input: `./${state.fileName}` },
    ...(options.language === 'javascript' ? { output: { language: 'javascript' } } : {}),
    ...(options.adapter === 'axios' ? { client: { adapter: 'axios' } } : {}),
    ...(Object.keys(features).length === 0 ? {} : { features }),
    ...(options.dates === 'Date' || options.readWrite === 'merged'
      ? {
          types: {
            ...(options.dates === 'Date' ? { dates: 'Date' as const } : {}),
            ...(options.readWrite === 'merged' ? { readWrite: 'merged' as const } : {}),
          },
        }
      : {}),
  };
}

/** The config file that reproduces the playground's options. */
function configSource(config: UserConfig): string {
  const literal = (value: unknown, indent: string): string => {
    if (Array.isArray(value)) return `[${value.map((item) => literal(item, indent)).join(', ')}]`;
    if (typeof value === 'object' && value !== null) {
      const inner = `${indent}  `;
      const entries = Object.entries(value).map(
        ([key, item]) => `${inner}${key}: ${literal(item, inner)},`,
      );
      return `{\n${entries.join('\n')}\n${indent}}`;
    }
    return typeof value === 'string' ? `'${value}'` : String(value);
  };
  return `import { defineConfig } from 'swaggerz';\n\nexport default defineConfig(${literal(
    { ...config, output: { directory: `./${OUTPUT_PREFIX}`, ...config.output } },
    '',
  )});\n`;
}

const count = (n: number, noun: string): string =>
  `${n.toLocaleString('en-US')} ${noun}${n === 1 ? '' : 's'}`;

const SEVERITY_CLASS: Record<string, string> = {
  error: 'text-danger',
  warning: 'text-warning',
  info: 'text-info',
};

/** Choices as words, the selected one underlined in marigold: no boxes, no gray fills. */
const CHOICE =
  'h-7 rounded-none border-0 px-0 text-[12.5px] text-muted-foreground shadow-none hover:bg-transparent hover:text-foreground aria-checked:border-0 aria-checked:bg-transparent! aria-checked:text-foreground aria-checked:shadow-[inset_0_-2px_0_var(--marigold)]! aria-pressed:border-0 aria-pressed:bg-transparent! aria-pressed:shadow-none!';

/** Ghost buttons without the gray hover fill. */
const QUIET = 'hover:bg-transparent hover:text-foreground';

function defaultFile(files: readonly { path: string }[]): string | undefined {
  const operation = files.find(
    (file) =>
      file.path.includes('/') &&
      !/^(runtime|models|react-query|vue-query|svelte-query|solid-query|swr|zod|valibot|arktype|dates|webhooks|callbacks)\//.test(
        file.path,
      ),
  );
  return (operation ?? files[0])?.path;
}

type Pane = 'spec' | 'output' | 'problems';

interface Choice<T extends string> {
  readonly value: T;
  readonly label: string;
}

function Options<T extends string>({
  label,
  value,
  choices,
  onChange,
}: {
  label: string;
  value: T;
  choices: readonly Choice<T>[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      <ToggleGroup
        type="single"
        value={value}
        aria-label={label}
        className="gap-3"
        onValueChange={(next) => {
          if (next !== '') onChange(next as T);
        }}
      >
        {choices.map((choice) => (
          <ToggleGroupItem key={choice.value} value={choice.value} className={CHOICE}>
            {choice.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

const TOKEN_CLASS: Record<Exclude<TokenKind, 'text'>, string> = {
  key: 'text-code-keyword',
  string: 'text-code-string',
  number: 'text-code-number',
  literal: 'text-code-type',
  comment: 'text-code-comment',
  punct: 'text-muted-foreground',
};

/** Above this many lines the editor shows plain text: highlighting would slow typing down. */
const HIGHLIGHT_LIMIT = 6000;

const Line = memo(function Line({ text }: { text: string }) {
  return (
    <>
      {highlightLine(text).map((token, index) =>
        token.kind === 'text' ? (
          token.text
        ) : (
          <span key={index} className={TOKEN_CLASS[token.kind]}>
            {token.text}
          </span>
        ),
      )}
      {'\n'}
    </>
  );
});

/**
 * A textarea over a highlighted copy of its text: the textarea's own text is transparent, so
 * what shows is the copy, while typing, selection and the caret stay the browser's.
 */
function SpecEditor({
  value,
  onChange,
  jumpTo,
}: {
  value: string;
  onChange: (value: string) => void;
  jumpTo: { line: number; token: number } | undefined;
}) {
  const area = useRef<HTMLTextAreaElement>(null);
  const gutter = useRef<HTMLDivElement>(null);
  const mirror = useRef<HTMLElement>(null);
  const lines = useMemo(() => value.split('\n'), [value]);
  const highlighted = lines.length <= HIGHLIGHT_LIMIT;

  useEffect(() => {
    const element = area.current;
    if (jumpTo === undefined || element === null) return;
    const all = element.value.split('\n');
    const offset = all
      .slice(0, jumpTo.line - 1)
      .reduce((total, line) => total + line.length + 1, 0);
    element.focus();
    element.setSelectionRange(offset, offset + (all[jumpTo.line - 1]?.length ?? 0));
    const lineHeight = Number.parseFloat(getComputedStyle(element).lineHeight) || 20;
    element.scrollTop = Math.max(0, (jumpTo.line - 4) * lineHeight);
  }, [jumpTo]);

  const sync = (element: HTMLTextAreaElement): void => {
    if (gutter.current !== null) {
      gutter.current.style.transform = `translateY(${-element.scrollTop}px)`;
    }
    if (mirror.current !== null) {
      mirror.current.style.transform = `translate(${-element.scrollLeft}px, ${-element.scrollTop}px)`;
    }
  };

  return (
    <div className="relative flex min-h-0 flex-1 overflow-hidden bg-surface">
      <div
        aria-hidden="true"
        className="sz-editor-text pointer-events-none w-12 shrink-0 overflow-hidden border-r border-border py-3 pr-2.5 text-right text-muted-foreground select-none"
      >
        <div ref={gutter}>
          {lines.map((_, index) => (
            <div key={index}>{index + 1}</div>
          ))}
        </div>
      </div>
      <div className="relative min-w-0 flex-1">
        {highlighted && (
          <pre
            aria-hidden="true"
            className="sz-editor-text pointer-events-none absolute inset-0 m-0 overflow-hidden text-foreground"
          >
            <code ref={mirror} className="block w-max min-w-full px-3 py-3">
              {lines.map((line, index) => (
                <Line key={index} text={line} />
              ))}
            </code>
          </pre>
        )}
        <textarea
          ref={area}
          value={value}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          aria-label="Specification"
          onChange={(event) => onChange(event.target.value)}
          onScroll={(event) => sync(event.currentTarget)}
          className={cn(
            'sz-editor-text absolute inset-0 h-full w-full resize-none overflow-auto bg-transparent px-3 py-3 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25 focus-visible:ring-inset',
            highlighted ? 'sz-editor-input' : 'text-foreground',
          )}
          wrap="off"
        />
      </div>
    </div>
  );
}

function FileList({
  files,
  selected,
  onSelect,
}: {
  files: readonly string[];
  selected: string | undefined;
  onSelect: (path: string) => void;
}) {
  const groups = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const file of files) {
      const directory = file.includes('/') ? file.slice(0, file.lastIndexOf('/')) : '';
      map.set(directory, [...(map.get(directory) ?? []), file]);
    }
    return [...map.entries()].sort(([a], [b]) =>
      a === '' ? -1 : b === '' ? 1 : a.localeCompare(b),
    );
  }, [files]);
  return (
    <ScrollArea className="min-h-0 flex-1" viewportProps={{ 'aria-label': 'Generated files' }}>
      <nav aria-label="Generated files" className="py-2">
        {groups.map(([directory, entries]) => (
          <div key={directory || '.'} className="mb-1.5">
            {directory !== '' && (
              <p className="px-3 pt-1.5 pb-0.5 font-mono text-[11px] text-muted-foreground">
                {directory}/
              </p>
            )}
            <ul>
              {entries.map((file) => (
                <li key={file}>
                  <button
                    type="button"
                    onClick={() => onSelect(file)}
                    aria-current={file === selected ? 'true' : undefined}
                    className={cn(
                      'block min-h-6 w-full cursor-pointer truncate py-1 pr-3 text-left font-mono text-[12px] text-foreground/80 hover:bg-marigold/10 hover:text-foreground',
                      directory === '' ? 'pl-3' : 'pl-5',
                      file === selected &&
                        'bg-highlight text-foreground shadow-[inset_2px_0_0_var(--marigold)]',
                    )}
                  >
                    {directory === '' ? file : file.slice(directory.length + 1)}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </ScrollArea>
  );
}

function Diagnostics({
  diagnostics,
  onJump,
}: {
  diagnostics: readonly BrowserDiagnostic[];
  onJump: (line: number) => void;
}) {
  if (diagnostics.length === 0) {
    return (
      <p className="px-4 py-3 text-[13px] text-muted-foreground">
        No problems. The specification compiled cleanly.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-border">
      {diagnostics.map((diagnostic, index) => {
        const line = diagnostic.location?.line;
        return (
          <li key={index} className="px-4 py-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  'text-[12.5px] font-semibold tracking-wide [font-variant-caps:all-small-caps]',
                  SEVERITY_CLASS[diagnostic.severity] ?? 'text-muted-foreground',
                )}
              >
                {diagnostic.severity}
              </span>
              <code className="text-[12px] text-foreground">{diagnostic.code}</code>
              {line !== undefined && (
                <button
                  type="button"
                  onClick={() => onJump(line)}
                  className="cursor-pointer font-mono text-[11.5px] text-marigold-ink underline decoration-border-strong underline-offset-2 hover:decoration-marigold"
                >
                  line {line}
                  {diagnostic.location?.column === undefined
                    ? ''
                    : `:${diagnostic.location.column}`}
                </button>
              )}
            </div>
            <p className="mt-1 text-[13px] leading-5 text-foreground/90">{diagnostic.message}</p>
            {diagnostic.hint !== undefined && (
              <p className="mt-0.5 text-[12.5px] leading-5 text-muted-foreground">
                {diagnostic.hint}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export default function Playground() {
  const [state, setState] = useState<PlaygroundState | undefined>(undefined);
  const [result, setResult] = useState<BrowserCompileResult | undefined>(undefined);
  const [elapsed, setElapsed] = useState<number | undefined>(undefined);
  const [failure, setFailure] = useState<string | undefined>(undefined);
  const [pending, setPending] = useState(false);
  const [selected, setSelected] = useState<string | undefined>(undefined);
  const [pane, setPane] = useState<Pane>('spec');
  const [jumpTo, setJumpTo] = useState<{ line: number; token: number } | undefined>(undefined);
  const [copied, setCopied] = useState(false);
  // Phones show the options behind a button, so the editor starts on the first screen.
  const [optionsOpen, setOptionsOpen] = useState(false);
  const worker = useRef<Worker | null>(null);
  const latest = useRef(0);
  const upload = useRef<HTMLInputElement>(null);

  // Restore a shared state from the fragment, or start from the first sample.
  useEffect(() => {
    const sample = SAMPLES[0];
    decodeState(location.hash).then(
      (shared) => {
        setState(
          shared ??
            (sample === undefined
              ? undefined
              : { fileName: sample.fileName, spec: sample.spec, options: DEFAULT_OPTIONS }),
        );
      },
      () => undefined,
    );
  }, []);

  useEffect(() => {
    const instance = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    instance.addEventListener('message', (event: MessageEvent<CompileResponse>) => {
      const response = event.data;
      if (response.id !== latest.current) return;
      setPending(false);
      if ('error' in response) {
        setFailure(response.error);
        return;
      }
      setFailure(undefined);
      setResult(response.result);
      setElapsed(response.elapsed);
    });
    worker.current = instance;
    return () => instance.terminate();
  }, []);

  const config = useMemo(() => (state === undefined ? undefined : toConfig(state)), [state]);

  // Compile shortly after the last change.
  useEffect(() => {
    if (state === undefined || config === undefined || worker.current === null) return undefined;
    setPending(true);
    const timer = setTimeout(() => {
      latest.current += 1;
      const request: CompileRequest = {
        id: latest.current,
        input: { files: { [state.fileName]: state.spec }, config, lint: state.options.lint },
      };
      worker.current?.postMessage(request);
    }, 220);
    return () => clearTimeout(timer);
  }, [state, config]);

  // Keep the fragment in step, so reloading or sharing the address reproduces the playground.
  useEffect(() => {
    if (state === undefined) return undefined;
    const timer = setTimeout(() => {
      encodeState(state).then(
        (encoded) => history.replaceState(null, '', `#${encoded}`),
        () => undefined,
      );
    }, 500);
    return () => clearTimeout(timer);
  }, [state]);

  const files = useMemo(() => {
    if (result === undefined || config === undefined) return [];
    return [{ path: CONFIG_FILE, content: configSource(config) }, ...result.files];
  }, [result, config]);

  // The chosen file while it exists, otherwise a representative one (an operation module).
  const shownPath =
    selected !== undefined && files.some((file) => file.path === selected)
      ? selected
      : (defaultFile(result?.files ?? []) ?? CONFIG_FILE);

  const setOptions = useCallback((patch: Partial<PlaygroundOptions>) => {
    setState((current) =>
      current === undefined ? current : { ...current, options: { ...current.options, ...patch } },
    );
  }, []);

  const loadSample = (id: string): void => {
    const sample = SAMPLES.find((candidate) => candidate.id === id);
    if (sample === undefined) return;
    setState((current) => ({
      fileName: sample.fileName,
      spec: sample.spec,
      options: current?.options ?? DEFAULT_OPTIONS,
    }));
    setSelected(undefined);
  };

  const onUpload = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    if (file === undefined) return;
    file.text().then(
      (text) => {
        const fileName = /\.json$/i.test(file.name) ? 'openapi.json' : 'openapi.yaml';
        setState((current) => ({
          fileName,
          spec: text,
          options: current?.options ?? DEFAULT_OPTIONS,
        }));
        setSelected(undefined);
      },
      () => undefined,
    );
    event.target.value = '';
  };

  const copyLink = (): void => {
    if (state === undefined) return;
    encodeState(state).then(
      async (encoded) => {
        const url = `${location.origin}${location.pathname}#${encoded}`;
        history.replaceState(null, '', `#${encoded}`);
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => undefined,
    );
  };

  const download = (): void => {
    if (result === undefined || state === undefined || config === undefined) return;
    createZip([
      { path: CONFIG_FILE, content: configSource(config) },
      { path: state.fileName, content: state.spec },
      ...result.files.map((file) => ({
        path: `${OUTPUT_PREFIX}/${file.path}`,
        content: file.content,
      })),
    ]).then(
      (blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'swaggerz-playground.zip';
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
      () => undefined,
    );
  };

  if (state === undefined) {
    return (
      <div className="flex h-[60vh] items-center justify-center gap-2 text-muted-foreground">
        <Spinner /> Loading the compiler…
      </div>
    );
  }

  const diagnostics = result?.diagnostics ?? [];
  const errors = diagnostics.filter((d) => d.severity === 'error').length;
  const warnings = diagnostics.filter((d) => d.severity === 'warning').length;
  const shown = files.find((file) => file.path === shownPath);
  const { options } = state;
  const summary = [
    options.language === 'typescript' ? 'TypeScript' : 'JavaScript',
    options.adapter,
    options.hooks === 'none'
      ? 'no hooks'
      : options.hooks === 'swr'
        ? 'SWR'
        : `${options.hooks} hooks`,
    options.validation === 'none' ? undefined : options.validation,
  ]
    .filter((part) => part !== undefined)
    .join(' · ');

  return (
    <TooltipProvider delayDuration={300}>
      <div className="sz-playground flex min-h-0 flex-1 flex-col">
        <button
          type="button"
          aria-expanded={optionsOpen}
          aria-controls="playground-options"
          onClick={() => setOptionsOpen((open) => !open)}
          className="flex h-11 w-full cursor-pointer items-center gap-2 border-b border-border px-4 text-left text-[13px] lg:hidden"
        >
          <span className="font-medium text-foreground">Options</span>
          <span className="min-w-0 truncate text-muted-foreground">{summary}</span>
          <ChevronDown
            className={cn(
              'ml-auto size-4 shrink-0 text-muted-foreground transition-transform',
              optionsOpen && 'rotate-180',
            )}
          />
        </button>
        <div
          id="playground-options"
          className={cn(
            'flex-wrap items-end gap-x-7 gap-y-3 border-b border-border px-4 py-3 lg:flex',
            optionsOpen ? 'flex' : 'hidden',
          )}
        >
          <Options
            label="Language"
            value={options.language}
            onChange={(language) => setOptions({ language })}
            choices={[
              { value: 'typescript', label: 'TypeScript' },
              { value: 'javascript', label: 'JavaScript' },
            ]}
          />
          <Options
            label="Transport"
            value={options.adapter}
            onChange={(adapter) => setOptions({ adapter })}
            choices={[
              { value: 'fetch', label: 'fetch' },
              { value: 'axios', label: 'axios' },
            ]}
          />
          <Options
            label="Hooks"
            value={options.hooks}
            onChange={(hooks) => setOptions({ hooks })}
            choices={[
              { value: 'none', label: 'None' },
              { value: 'react', label: 'React' },
              { value: 'vue', label: 'Vue' },
              { value: 'svelte', label: 'Svelte' },
              { value: 'solid', label: 'Solid' },
              { value: 'swr', label: 'SWR' },
            ]}
          />
          <Options
            label="Validation"
            value={options.validation}
            onChange={(validation) => setOptions({ validation })}
            choices={[
              { value: 'none', label: 'None' },
              { value: 'zod', label: 'Zod' },
              { value: 'valibot', label: 'Valibot' },
              { value: 'arktype', label: 'ArkType' },
            ]}
          />
          <Options
            label="Dates"
            value={options.dates}
            onChange={(dates) => setOptions({ dates })}
            choices={[
              { value: 'string', label: 'string' },
              { value: 'Date', label: 'Date' },
            ]}
          />
          <Options
            label="Read / write"
            value={options.readWrite}
            onChange={(readWrite) => setOptions({ readWrite })}
            choices={[
              { value: 'split', label: 'Split' },
              { value: 'merged', label: 'Merged' },
            ]}
          />
          <div className="flex items-center gap-2 pb-0.5 text-[12.5px] text-foreground">
            <Switch
              id="playground-lint"
              checked={options.lint}
              onCheckedChange={(lint) => setOptions({ lint })}
            />
            <label htmlFor="playground-lint">Lint</label>
          </div>
        </div>

        <div className="flex h-10 items-center border-b border-border px-4 lg:hidden">
          <ToggleGroup
            type="single"
            value={pane}
            aria-label="Pane"
            className="h-full gap-5"
            onValueChange={(next) => {
              if (next !== '') setPane(next as Pane);
            }}
          >
            <ToggleGroupItem value="spec" className={cn(CHOICE, 'h-full')}>
              Specification
            </ToggleGroupItem>
            <ToggleGroupItem value="output" className={cn(CHOICE, 'h-full')}>
              Output
            </ToggleGroupItem>
            <ToggleGroupItem value="problems" className={cn(CHOICE, 'h-full')}>
              Problems{diagnostics.length > 0 ? ` (${diagnostics.length})` : ''}
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <section
            aria-label="Specification"
            className={cn(
              'min-h-0 flex-col border-border lg:flex lg:border-r',
              pane === 'spec' || pane === 'problems' ? 'flex' : 'hidden',
            )}
          >
            <div className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1.5 border-b border-border px-3 py-2">
              <code className="text-[12px] text-muted-foreground">{state.fileName}</code>
              <Button
                variant="ghost"
                size="sm"
                className={cn('ml-auto', QUIET)}
                onClick={() => upload.current?.click()}
              >
                <FileUp className="size-3.5" />
                Open a file
              </Button>
              <input
                ref={upload}
                type="file"
                accept=".yaml,.yml,.json"
                className="hidden"
                onChange={onUpload}
              />
              <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-[11.5px] text-muted-foreground">Start from</span>
                <ToggleGroup
                  type="single"
                  aria-label="Samples"
                  value=""
                  className="gap-x-3 gap-y-0.5"
                  onValueChange={(id) => loadSample(id)}
                >
                  {SAMPLES.map((sample) => (
                    <ToggleGroupItem
                      key={sample.id}
                      value={sample.id}
                      className={cn(
                        CHOICE,
                        'h-6 text-[12px] text-marigold-ink underline decoration-border-strong underline-offset-[3px] hover:decoration-marigold',
                      )}
                    >
                      {sample.label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
            </div>
            <div
              className={cn(
                'min-h-0 flex-1 flex-col',
                pane === 'problems' ? 'hidden lg:flex' : 'flex',
              )}
            >
              <SpecEditor
                value={state.spec}
                jumpTo={jumpTo}
                onChange={(spec) =>
                  setState((current) => (current === undefined ? current : { ...current, spec }))
                }
              />
            </div>
            <div
              className={cn(
                'shrink-0 flex-col border-t border-border lg:flex lg:max-h-[38%]',
                pane === 'problems' ? 'flex min-h-0 flex-1' : 'hidden',
              )}
            >
              <div className="flex h-9 shrink-0 items-center gap-2 px-4 text-[12.5px]">
                <span className="font-medium text-foreground">Problems</span>
                {errors > 0 && <span className="text-danger">{count(errors, 'error')}</span>}
                {warnings > 0 && <span className="text-warning">{count(warnings, 'warning')}</span>}
                {diagnostics.length - errors - warnings > 0 && (
                  <span className="text-info">
                    {count(diagnostics.length - errors - warnings, 'note')}
                  </span>
                )}
              </div>
              <ScrollArea className="min-h-0 flex-1" viewportProps={{ 'aria-label': 'Problems' }}>
                <Diagnostics
                  diagnostics={diagnostics}
                  onJump={(line) => {
                    setPane('spec');
                    setJumpTo({ line, token: Date.now() });
                  }}
                />
              </ScrollArea>
            </div>
          </section>

          <section
            aria-label="Generated code"
            className={cn('min-h-0 flex-col lg:flex', pane === 'output' ? 'flex' : 'hidden')}
          >
            <div className="flex h-10 shrink-0 items-center gap-3 border-b border-border px-3 text-[12.5px]">
              <span className="flex items-center gap-2 text-muted-foreground" aria-live="polite">
                {pending ? <Spinner className="size-3.5" /> : null}
                {failure !== undefined
                  ? 'The compiler stopped unexpectedly'
                  : result === undefined
                    ? 'Compiling…'
                    : result.ok
                      ? `${count(result.files.length, 'file')} · ${count(result.operations, 'operation')} · ${count(result.models, 'model')}${elapsed === undefined ? '' : ` · ${Math.round(elapsed)} ms`}`
                      : 'Nothing generated: fix the errors'}
              </span>
              <div className="ml-auto flex items-center gap-1">
                <Button variant="ghost" size="sm" className={QUIET} onClick={copyLink}>
                  <Link2 className="size-3.5" />
                  {copied ? 'Copied' : 'Share link'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className={QUIET}
                  onClick={download}
                  disabled={result === undefined || !result.ok}
                >
                  <Download className="size-3.5" />
                  .zip
                </Button>
                <Tooltip content="Reset to the defaults" side="bottom">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className={QUIET}
                    aria-label="Reset to the defaults"
                    onClick={() => {
                      setState(undefined);
                      history.replaceState(null, '', location.pathname);
                      const sample = SAMPLES[0];
                      if (sample !== undefined)
                        setState({
                          fileName: sample.fileName,
                          spec: sample.spec,
                          options: DEFAULT_OPTIONS,
                        });
                    }}
                  >
                    <RotateCcw className="size-3.5" />
                  </Button>
                </Tooltip>
              </div>
            </div>
            {failure !== undefined ? (
              <p className="px-4 py-3 text-[13px] text-danger">{failure}</p>
            ) : (
              <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[14rem_minmax(0,1fr)]">
                <div className="flex min-h-0 max-h-56 flex-col border-b border-border md:max-h-none md:border-r md:border-b-0">
                  <FileList
                    files={files.map((file) => file.path)}
                    selected={shownPath}
                    onSelect={setSelected}
                  />
                </div>
                <div className="min-h-0 p-3">
                  {shown !== undefined && (
                    <CodeBlock
                      code={shown.content}
                      label={
                        shown.path === CONFIG_FILE
                          ? `${CONFIG_FILE} (these options)`
                          : `${OUTPUT_PREFIX}/${shown.path}`
                      }
                      className="flex h-full flex-col bg-surface [&>div:last-child]:min-h-0 [&>div:last-child]:flex-1"
                      maxHeight="h-full"
                    />
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </TooltipProvider>
  );
}
