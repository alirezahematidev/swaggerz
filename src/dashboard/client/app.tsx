import {
  Boxes,
  CircleAlert,
  FileCode2,
  LayoutDashboard,
  Menu,
  Monitor,
  Moon,
  Network,
  RefreshCw,
  Route as RouteIcon,
  ScanSearch,
  Search,
  Sun,
  Unplug,
  CloudOff,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ModelSummary, OperationSummary, OverviewResponse } from '../api-types.ts';
import { api, usePending, useResource } from './api.ts';
import { Async } from './components/async.tsx';
import { Mark } from './components/brand.tsx';
import { ChangeBadge, reloadToast } from './components/change.tsx';
import { Badge, StatusDot, type BadgeTone } from './components/ui/badge.tsx';
import { Button } from './components/ui/button.tsx';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from './components/ui/command.tsx';
import { Dialog, DialogContent } from './components/ui/dialog.tsx';
import { Kbd } from './components/ui/kbd.tsx';
import { MethodBadge } from './components/ui/method.tsx';
import { ScrollArea } from './components/ui/scroll-area.tsx';
import { ErrorState } from './components/ui/states.tsx';
import { Toaster, useToasts } from './components/ui/toast.tsx';
import { ToggleGroup, ToggleGroupItem } from './components/ui/toggle-group.tsx';
import { Tooltip, TooltipProvider } from './components/ui/tooltip.tsx';
import { cn } from './lib/cn.ts';
import { subscribe, type LiveState } from './lib/events.ts';
import { useTheme, type Theme } from './lib/theme.ts';
import { GeneratePage } from './pages/generate.tsx';
import { GraphPage } from './pages/graph.tsx';
import { ModelsPage } from './pages/models.tsx';
import { OperationsPage } from './pages/operations.tsx';
import { Overview } from './pages/overview.tsx';
import { UsagePage } from './pages/usage.tsx';
import { href, navigate, useRoute, type Route } from './router.ts';

type Page = Route['page'];

const NAV: readonly { page: Page; label: string; icon: ReactNode }[] = [
  { page: 'overview', label: 'Overview', icon: <LayoutDashboard /> },
  { page: 'operations', label: 'Operations', icon: <RouteIcon /> },
  { page: 'models', label: 'Models', icon: <Boxes /> },
  { page: 'graph', label: 'Dependencies', icon: <Network /> },
  { page: 'usage', label: 'Usage', icon: <ScanSearch /> },
  { page: 'generate', label: 'Generate', icon: <FileCode2 /> },
];

const GENERATION: Record<
  OverviewResponse['generation']['status'],
  { tone: BadgeTone; label: string }
> = {
  never: { tone: 'warning', label: 'Not generated' },
  'up-to-date': { tone: 'success', label: 'Output up to date' },
  stale: { tone: 'warning', label: 'Output out of date' },
  failed: { tone: 'danger', label: 'Compilation failed' },
};

const LIVE: Record<LiveState | 'off', { tone: BadgeTone; label: string }> = {
  live: { tone: 'success', label: 'Live reload' },
  connecting: { tone: 'warning', label: 'Reconnecting…' },
  offline: { tone: 'neutral', label: 'Disconnected' },
  off: { tone: 'neutral', label: 'Live reload off' },
};

const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform);

/** The first line of a diagnostic message (parsers append a code frame), as a sentence. */
function firstLine(message: string): string {
  const line = (message.split('\n')[0] ?? '').trim().replace(/[:\s]+$/, '');
  return /[.!?]$/.test(line) ? line : `${line}.`;
}

/** Content column of the sidebar: everything aligns to a 12px gutter and a 22px text inset. */
function Sidebar({
  route,
  overview,
  counts,
  changes,
  live,
  theme,
  onTheme,
  onReload,
  reloading,
  onSearch,
  onNavigate,
}: {
  route: Route;
  overview: OverviewResponse | undefined;
  counts: Partial<Record<Page, number>>;
  /** Items marked new or updated, per page. */
  changes: Partial<Record<Page, number>>;
  live: LiveState | 'off';
  theme: Theme;
  onTheme: (theme: Theme) => void;
  onReload: () => void;
  reloading: boolean;
  onSearch: () => void;
  /** Called when a section link is followed (closes the mobile drawer). */
  onNavigate?: () => void;
}) {
  const status = overview === undefined ? undefined : GENERATION[overview.generation.status];
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-[68px] shrink-0 items-center gap-2.5 px-[22px]">
        <Mark className="size-9 -mx-0.5" />
        <span className="font-display text-[19px] leading-none font-semibold">swaggerz</span>
        <span className="mt-0.5 rounded-[4px] border border-border-strong px-1 text-[10px] leading-4 font-medium tracking-wide text-muted-foreground uppercase">
          Dashboard
        </span>
      </div>

      <div className="mx-3 flex min-h-[70px] flex-col justify-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-2.5 shadow-card">
        {overview === undefined ? (
          <>
            <div className="h-5 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-5 w-1/2 animate-pulse rounded bg-muted" />
          </>
        ) : (
          <>
            <div className="line-clamp-2 font-display text-[14.5px] leading-5 font-semibold break-words">
              {overview.title}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone="marigold">{overview.specVersion}</Badge>
              <Badge tone="outline">v{overview.version}</Badge>
            </div>
          </>
        )}
      </div>

      <div className="px-3 pt-3">
        <button
          type="button"
          onClick={onSearch}
          className="flex h-8 w-full cursor-pointer items-center gap-2 rounded-md border border-border bg-surface/70 px-2.5 text-[13px] text-faint-foreground shadow-card transition-colors outline-none hover:border-border-strong hover:text-muted-foreground focus-visible:ring-[3px] focus-visible:ring-ring/25"
        >
          <Search className="size-3.5" />
          <span className="flex-1 text-left">Search</span>
          <Kbd>{isMac ? '⌘' : 'Ctrl'}</Kbd>
          <Kbd>K</Kbd>
        </button>
      </div>

      <ScrollArea className="mt-4 min-h-0 flex-1">
        <nav aria-label="Sections" className="px-3 pb-3">
          <ul className="flex flex-col gap-0.5">
            {NAV.map((item) => {
              const active = route.page === item.page;
              const changed = changes[item.page] ?? 0;
              return (
                <li key={item.page}>
                  <a
                    href={href({ page: item.page })}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13.5px] font-medium text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/25 [&_svg]:size-4 [&_svg]:shrink-0',
                      active &&
                        'bg-surface text-foreground shadow-card hover:bg-surface [&_svg]:text-marigold-ink',
                    )}
                  >
                    {item.icon}
                    <span className="flex-1 truncate">{item.label}</span>
                    {changed === 0 ? null : (
                      <span className="flex items-center gap-1 rounded-[5px] bg-highlight px-1 text-[11px] leading-4 font-medium tabular-nums text-marigold-ink">
                        <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
                        {changed}
                        <span className="sr-only"> changed since the dashboard started</span>
                      </span>
                    )}
                    {counts[item.page] === undefined ? null : (
                      <span className="min-w-[2ch] text-right text-[11.5px] tabular-nums text-faint-foreground">
                        {counts[item.page]}
                      </span>
                    )}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
      </ScrollArea>

      <div className="flex shrink-0 flex-col gap-3 border-t border-border px-3 py-3.5">
        <div className="flex flex-col gap-1.5 px-2.5 text-[12.5px]">
          {status === undefined ? (
            <div className="h-5 w-32 animate-pulse rounded bg-muted" />
          ) : (
            <a
              href={href({ page: 'generate' })}
              onClick={onNavigate}
              className="flex h-5 items-center gap-2 rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/25"
            >
              <StatusDot tone={status.tone} />
              {status.label}
            </a>
          )}
          <output aria-live="polite" className="flex h-5 items-center gap-2 text-muted-foreground">
            <StatusDot tone={LIVE[live].tone} className={live === 'live' ? '' : 'opacity-70'} />
            {LIVE[live].label}
          </output>
        </div>
        <div className="flex items-center justify-between gap-2">
          <Tooltip content="Reload the config and specification from disk">
            <Button size="sm" onClick={onReload} disabled={reloading}>
              <RefreshCw className={cn('size-3.5', reloading && 'animate-spin')} />
              {reloading ? 'Reloading' : 'Reload'}
            </Button>
          </Tooltip>
          <ToggleGroup
            type="single"
            aria-label="Theme"
            value={theme}
            className="gap-0.5 rounded-lg bg-muted p-0.5"
            onValueChange={(value) => {
              if (value === 'system' || value === 'light' || value === 'dark') onTheme(value);
            }}
          >
            {(
              [
                ['system', 'System theme', <Monitor key="m" />],
                ['light', 'Light theme', <Sun key="s" />],
                ['dark', 'Dark theme', <Moon key="d" />],
              ] as const
            ).map(([value, label, icon]) => (
              <Tooltip key={value} content={label}>
                <ToggleGroupItem
                  value={value}
                  aria-label={label}
                  className="h-6 w-7 border-transparent px-0"
                >
                  {icon}
                </ToggleGroupItem>
              </Tooltip>
            ))}
          </ToggleGroup>
        </div>
      </div>
    </div>
  );
}

function CommandPalette({
  open,
  onOpenChange,
  operations,
  models,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  operations: readonly OperationSummary[];
  models: readonly ModelSummary[];
}) {
  const [query, setQuery] = useState('');
  const change = (next: boolean): void => {
    if (!next) setQuery('');
    onOpenChange(next);
  };
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term !== '');
  const matches = (text: string): boolean => terms.every((term) => text.includes(term));
  const pages = NAV.filter((item) => matches(item.label.toLowerCase()));
  const ops = operations
    .filter((op) =>
      matches(
        `${op.method} ${op.path} ${op.name} ${op.operationId ?? ''} ${op.tags.join(' ')}`.toLowerCase(),
      ),
    )
    .slice(0, terms.length === 0 ? 8 : 40);
  const found = models
    .filter((model) => matches(model.name.toLowerCase()))
    .slice(0, terms.length === 0 ? 6 : 30);
  const go = (route: Route): void => {
    change(false);
    navigate(route);
  };
  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogContent
        title="Search"
        hideTitle
        showClose={false}
        className="top-[14vh] max-w-xl overflow-hidden p-0"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search pages, operations and models"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>Nothing matches “{query}”.</CommandEmpty>
            {pages.length === 0 ? null : (
              <CommandGroup heading="Pages">
                {pages.map((item) => (
                  <CommandItem
                    key={item.page}
                    value={`page:${item.page}`}
                    onSelect={() => go({ page: item.page })}
                  >
                    {item.icon}
                    {item.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {ops.length === 0 ? null : (
              <CommandGroup heading="Operations">
                {ops.map((op) => (
                  <CommandItem
                    key={op.key}
                    value={`op:${op.key}`}
                    onSelect={() => go({ page: 'operations', key: op.key })}
                  >
                    <MethodBadge method={op.method} size="sm" />
                    <code className="min-w-0 flex-1 truncate font-mono text-[12.5px]">
                      {op.path}
                    </code>
                    <ChangeBadge change={op.change} />
                    <span className="max-w-[40%] truncate text-[12px] text-muted-foreground">
                      {op.name}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {found.length === 0 ? null : (
              <CommandGroup heading="Models">
                {found.map((model) => (
                  <CommandItem
                    key={model.id}
                    value={`model:${model.id}`}
                    onSelect={() => go({ page: 'models', id: model.id })}
                  >
                    <Boxes />
                    <span className="min-w-0 flex-1 truncate font-mono text-[12.5px]">
                      {model.name}
                    </span>
                    <ChangeBadge change={model.change} />
                    <span className="text-[12px] text-muted-foreground">{model.kind}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
          <div className="flex items-center gap-3 border-t border-border px-3.5 py-2 text-[11.5px] text-faint-foreground">
            <span className="flex items-center gap-1">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd> navigate
            </span>
            <span className="flex items-center gap-1">
              <Kbd>↵</Kbd> open
            </span>
            <span className="flex items-center gap-1">
              <Kbd>esc</Kbd> close
            </span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

/** A thin bar at the top of the content while requests are in flight (shown after a delay). */
function ProgressBar() {
  const busy = usePending();
  if (!busy) return null;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 z-30 h-0.5 animate-[fade-in_160ms_ease-out_220ms_both] overflow-hidden"
    >
      <div className="h-full w-1/3 animate-progress rounded-full bg-marigold" />
    </div>
  );
}

function Banner({
  tone,
  icon,
  title,
  children,
}: {
  tone: 'danger' | 'warning' | 'neutral';
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div
      role="alert"
      className={cn(
        'flex shrink-0 items-start gap-3 border-b px-5 py-2.5 text-[13px] sm:px-8 lg:px-10 [&_svg]:mt-0.5 [&_svg]:size-4 [&_svg]:shrink-0',
        tone === 'danger'
          ? 'border-danger/25 bg-danger/8 [&_svg]:text-danger'
          : tone === 'warning'
            ? 'border-warning/25 bg-warning/8 [&_svg]:text-warning'
            : 'border-border bg-muted/60 [&_svg]:text-muted-foreground',
      )}
    >
      {icon}
      <div className="min-w-0">
        <span className="font-medium text-foreground">{title}</span>{' '}
        <span className="break-words text-foreground/80">{children}</span>
      </div>
    </div>
  );
}

export function App() {
  const route = useRoute();
  const [version, setVersion] = useState(0);
  const [reloading, setReloading] = useState(false);
  const [reloadError, setReloadError] = useState<Error | undefined>();
  const [theme, setTheme] = useTheme();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [live, setLive] = useState<LiveState>('connecting');
  const { toasts, push, dismiss } = useToasts();
  const content = useRef<HTMLDivElement>(null);
  const overview = useResource<OverviewResponse>('/api/overview', version);
  const operations = useResource<OperationSummary[]>('/api/operations', version);
  const models = useResource<ModelSummary[]>('/api/models', version);
  const names = useMemo(
    () => new Map(models.state === 'ready' ? models.data.map((m) => [m.id, m.name]) : []),
    [models],
  );
  const revision = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (overview.state === 'ready' && overview.stale !== true)
      revision.current = overview.data.session.revision;
  }, [overview]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    addEventListener('keydown', onKey);
    return () => {
      removeEventListener('keydown', onKey);
    };
  }, []);

  // Live reload: refetch whatever is on screen when the server reports a change.
  useEffect(
    () =>
      subscribe((event) => {
        if (event.type === 'hello') {
          // After a reconnect, refetch if anything changed while disconnected.
          if (revision.current !== undefined && event.revision !== revision.current)
            setVersion((v) => v + 1);
          return;
        }
        setVersion((v) => v + 1);
        if (event.type === 'reload') push(reloadToast(event));
      }, setLive),
    [push],
  );

  useEffect(() => {
    const title = overview.state === 'ready' ? overview.data.title : 'swaggerz';
    const page = NAV.find((item) => item.page === route.page)?.label ?? '';
    document.title = `${page} · ${title} · swaggerz`;
  }, [overview, route.page]);

  const reload = (): void => {
    setReloading(true);
    setReloadError(undefined);
    api<OverviewResponse>('/api/reload', { method: 'POST' })
      .then(
        () => {
          setVersion((v) => v + 1);
        },
        (error: unknown) => {
          setReloadError(error instanceof Error ? error : new Error(String(error)));
        },
      )
      .finally(() => {
        setReloading(false);
      });
  };

  const session = overview.state === 'ready' ? overview.data.session : undefined;
  const changed = (items: readonly { change: string }[] | undefined): number =>
    items?.filter((item) => item.change !== 'removed').length ?? 0;
  const counts: Partial<Record<Page, number>> = {
    ...(operations.state === 'ready' ? { operations: operations.data.length } : {}),
    ...(models.state === 'ready' ? { models: models.data.length } : {}),
  };
  const sidebar = (
    <Sidebar
      route={route}
      overview={overview.state === 'ready' ? overview.data : undefined}
      counts={counts}
      changes={{
        operations: changed(session?.changes.operations),
        models: changed(session?.changes.models),
      }}
      live={session !== undefined && session.watching.length === 0 ? 'off' : live}
      theme={theme}
      onTheme={setTheme}
      onReload={reload}
      reloading={reloading}
      onSearch={() => {
        setNavOpen(false);
        setPaletteOpen(true);
      }}
      onNavigate={() => {
        setNavOpen(false);
      }}
    />
  );
  const split = route.page === 'operations' || route.page === 'models';

  let page: ReactNode;
  switch (route.page) {
    case 'overview':
      page = <Async resource={overview}>{(data) => <Overview data={data} />}</Async>;
      break;
    case 'operations':
      page = (
        <Async resource={operations}>
          {(data) => (
            <OperationsPage
              operations={data}
              names={names}
              version={version}
              {...(route.key === undefined ? {} : { selected: route.key })}
            />
          )}
        </Async>
      );
      break;
    case 'models':
      page = (
        <Async resource={models}>
          {(data) => (
            <ModelsPage
              models={data}
              names={names}
              version={version}
              {...(route.id === undefined ? {} : { selected: route.id })}
            />
          )}
        </Async>
      );
      break;
    case 'graph':
      page = (
        <Async resource={operations}>
          {(data) => (
            <GraphPage
              operations={data}
              names={names}
              version={version}
              {...(route.key === undefined ? {} : { selected: route.key })}
            />
          )}
        </Async>
      );
      break;
    case 'usage':
      page = <UsagePage />;
      break;
    case 'generate':
      page = (
        <GeneratePage
          onGenerated={() => {
            setVersion((v) => v + 1);
          }}
        />
      );
      break;
  }

  return (
    <TooltipProvider delayDuration={350} skipDelayDuration={150}>
      <a
        href="#main"
        onClick={(event) => {
          // The hash is the router's; focus the content instead of navigating.
          event.preventDefault();
          (content.current ?? document.getElementById('main'))?.focus();
        }}
        className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <div className="flex h-dvh overflow-hidden">
        <aside className="hidden w-[252px] shrink-0 border-r border-border bg-sidebar lg:block">
          {sidebar}
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-13 shrink-0 items-center gap-2 border-b border-border bg-background px-3 lg:hidden">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Open navigation"
              onClick={() => setNavOpen(true)}
            >
              <Menu />
            </Button>
            <Mark className="size-8" />
            <span className="font-display text-[17px] font-semibold">swaggerz</span>
            <span className="flex-1" />
            <Button
              variant="ghost"
              size="icon"
              aria-label="Search"
              onClick={() => setPaletteOpen(true)}
            >
              <Search />
            </Button>
          </header>
          {live === 'offline' && session !== undefined && session.watching.length > 0 ? (
            <Banner tone="neutral" icon={<Unplug />} title="Disconnected.">
              The dashboard server stopped or was restarted, so this page no longer updates. Start
              it again and open the new link from the terminal.
            </Banner>
          ) : null}
          {session?.failure === undefined ? null : (
            <Banner
              tone="danger"
              icon={<CircleAlert />}
              title="The latest change could not be loaded."
            >
              {firstLine(session.failure.diagnostics[0]?.message ?? session.failure.message)}
              {session.failure.diagnostics.length > 1
                ? ` (+${session.failure.diagnostics.length - 1} more)`
                : ''}{' '}
              Showing the last version that loaded.
            </Banner>
          )}
          {session?.unreachable === undefined ? null : (
            <Banner
              tone="warning"
              icon={<CloudOff />}
              title={`Cannot reach ${session.unreachable[0]?.url ?? 'the specification'}${session.unreachable.length > 1 ? ` (+${session.unreachable.length - 1} more)` : ''}.`}
            >
              {firstLine(session.unreachable[0]?.error ?? '')} Polling goes on; showing the last
              version that loaded.
            </Banner>
          )}
          {reloadError === undefined ? null : (
            <div className="shrink-0 px-5 pt-4 sm:px-8 lg:px-10">
              <ErrorState error={reloadError} title="Reload failed" />
            </div>
          )}
          <main id="main" className="relative min-h-0 flex-1">
            <ProgressBar />
            {split ? (
              page
            ) : (
              <ScrollArea
                key={route.page}
                className="h-full"
                viewportRef={content}
                viewportProps={{ tabIndex: -1, 'aria-label': 'Content' }}
              >
                <div className="mx-auto max-w-[1180px] px-5 py-7 sm:px-8 lg:px-10 lg:py-10">
                  {page}
                </div>
              </ScrollArea>
            )}
          </main>
        </div>
      </div>
      <Dialog open={navOpen} onOpenChange={setNavOpen}>
        <DialogContent
          title="Navigation"
          hideTitle
          // Centered on the brand row (68px tall).
          closeClassName="top-5"
          className="top-0 left-0 h-dvh w-[280px] max-w-[85vw] translate-x-0 rounded-none rounded-r-xl border-y-0 border-l-0 bg-sidebar p-0"
        >
          {sidebar}
        </DialogContent>
      </Dialog>
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        operations={operations.state === 'ready' ? operations.data : []}
        models={models.state === 'ready' ? models.data : []}
      />
      <Toaster toasts={toasts} onDismiss={dismiss} />
    </TooltipProvider>
  );
}
