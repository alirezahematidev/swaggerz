import { render } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import type { ModelSummary, OperationSummary, OverviewResponse } from '../api-types.ts';
import { api, initToken, useResource } from './api.ts';
import { GeneratePage } from './components/generate.tsx';
import { GraphPage } from './components/graph.tsx';
import { ModelsPage } from './components/models.tsx';
import { OperationsPage } from './components/operations.tsx';
import { Overview } from './components/overview.tsx';
import { Async, Badge, ErrorState } from './components/ui.tsx';
import { UsagePage } from './components/usage.tsx';
import { href, useRoute, type Route } from './router.ts';

type Theme = 'system' | 'light' | 'dark';

function useTheme(): [Theme, (theme: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const stored = localStorage.getItem('swaggerz-dashboard-theme');
      return stored === 'light' || stored === 'dark' ? stored : 'system';
    } catch {
      return 'system';
    }
  });
  useEffect(() => {
    if (theme === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('swaggerz-dashboard-theme', theme);
    } catch {
      // Preference is not persisted when storage is unavailable.
    }
  }, [theme]);
  return [theme, setTheme];
}

const NAV: readonly { page: Route['page']; label: string }[] = [
  { page: 'overview', label: 'Overview' },
  { page: 'operations', label: 'Operations' },
  { page: 'models', label: 'Models' },
  { page: 'graph', label: 'Dependencies' },
  { page: 'usage', label: 'Usage' },
  { page: 'generate', label: 'Generate' },
];

function App() {
  const route = useRoute();
  const [version, setVersion] = useState(0);
  const [reloading, setReloading] = useState(false);
  const [reloadError, setReloadError] = useState<Error | undefined>();
  const [theme, setTheme] = useTheme();
  const overview = useResource<OverviewResponse>('/api/overview', version);
  const operations = useResource<OperationSummary[]>('/api/operations', version);
  const models = useResource<ModelSummary[]>('/api/models', version);
  const names = useMemo(
    () => new Map(models.state === 'ready' ? models.data.map((m) => [m.id, m.name]) : []),
    [models],
  );

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

  const counts: Partial<Record<Route['page'], number>> = {
    ...(operations.state === 'ready' ? { operations: operations.data.length } : {}),
    ...(models.state === 'ready' ? { models: models.data.length } : {}),
  };

  return (
    <div class="app">
      <a class="skip" href="#main">
        Skip to content
      </a>
      <header class="topbar">
        <a class="brand" href={href({ page: 'overview' })}>
          <span class="logo" aria-hidden="true">
            {'{}'}
          </span>
          swaggerz
        </a>
        {overview.state === 'ready' ? (
          <span class="api-title">
            {overview.data.title} <Badge>{overview.data.specVersionRaw}</Badge>
          </span>
        ) : null}
        <span class="spacer" />
        <button
          type="button"
          class="button ghost"
          onClick={reload}
          disabled={reloading}
          title="Reload the config and specification from disk"
        >
          {reloading ? 'Reloading…' : 'Reload'}
        </button>
        <select
          class="input theme"
          name="theme"
          aria-label="Theme"
          value={theme}
          onChange={(e) => {
            setTheme(e.currentTarget.value as Theme);
          }}
        >
          <option value="system">System theme</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </header>
      <nav class="sidebar" aria-label="Sections">
        {NAV.map((item) => (
          <a
            key={item.page}
            href={href({ page: item.page })}
            class={route.page === item.page ? 'nav-item active' : 'nav-item'}
            aria-current={route.page === item.page ? 'page' : undefined}
          >
            {item.label}
            {counts[item.page] === undefined ? null : (
              <span class="count">{counts[item.page]}</span>
            )}
          </a>
        ))}
      </nav>
      <main id="main" class="main" tabIndex={-1}>
        {reloadError === undefined ? null : <ErrorState error={reloadError} />}
        {route.page === 'overview' ? (
          <Async resource={overview}>{(data) => <Overview data={data} />}</Async>
        ) : null}
        {route.page === 'operations' ? (
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
        ) : null}
        {route.page === 'models' ? (
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
        ) : null}
        {route.page === 'graph' ? (
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
        ) : null}
        {route.page === 'usage' ? <UsagePage /> : null}
        {route.page === 'generate' ? (
          <GeneratePage
            onGenerated={() => {
              setVersion((v) => v + 1);
            }}
          />
        ) : null}
      </main>
    </div>
  );
}

const root = document.getElementById('app');
if (root !== null) {
  if (initToken() === undefined) {
    root.textContent =
      'Missing session token. Open the dashboard using the link printed by the CLI.';
  } else {
    root.textContent = '';
    render(<App />, root);
  }
}
