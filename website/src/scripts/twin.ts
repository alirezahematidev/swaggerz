/**
 * Twin panels: tabs, the narrow-screen side switch, and linked highlighting between the
 * specification and the generated code. Line numbers in the pairs are 1-based and inclusive.
 */
type Range = readonly [number, number];
interface Pair {
  readonly label: string;
  readonly spec: readonly Range[];
  readonly code: readonly Range[];
}

const reducedMotion = (): boolean => matchMedia('(prefers-reduced-motion: reduce)').matches;

function lines(panel: Element | null): HTMLElement[] {
  return panel === null ? [] : [...panel.querySelectorAll<HTMLElement>('.ec-line')];
}

function pairsOf(panel: Element | null): Pair[] {
  const raw = panel?.getAttribute('data-pairs');
  if (raw === null || raw === undefined) return [];
  try {
    return JSON.parse(raw) as Pair[];
  } catch {
    return [];
  }
}

const size = (ranges: readonly Range[]): number =>
  ranges.reduce((total, [from, to]) => total + (to - from + 1), 0);
const contains = (ranges: readonly Range[], line: number): boolean =>
  ranges.some(([from, to]) => line >= from && line <= to);

/** The most specific pair covering a line on one side. */
function pairAt(pairs: readonly Pair[], side: 'spec' | 'code', line: number): Pair | undefined {
  let best: Pair | undefined;
  for (const pair of pairs) {
    if (!contains(pair[side], line)) continue;
    if (best === undefined || size(pair[side]) < size(best[side])) best = pair;
  }
  return best;
}

function reveal(panel: HTMLElement, line: HTMLElement | undefined): void {
  if (line === undefined) return;
  const top = line.offsetTop;
  const visible =
    top >= panel.scrollTop && top <= panel.scrollTop + panel.clientHeight - line.offsetHeight;
  if (visible) return;
  panel.scrollTo({
    top: Math.max(0, top - panel.clientHeight / 3),
    behavior: reducedMotion() ? 'auto' : 'smooth',
  });
}

function setUpTabs(list: Element, onChange: () => void): void {
  const tabs = [...list.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
  const select = (tab: HTMLButtonElement): void => {
    for (const other of tabs) {
      const selected = other === tab;
      other.setAttribute('aria-selected', String(selected));
      other.tabIndex = selected ? 0 : -1;
      const panel = document.getElementById(other.getAttribute('aria-controls') ?? '');
      if (panel !== null) panel.toggleAttribute('data-active', selected);
    }
    onChange();
  };
  for (const tab of tabs) {
    tab.addEventListener('click', () => select(tab));
    tab.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
      event.preventDefault();
      const step = event.key === 'ArrowRight' ? 1 : -1;
      const next = tabs[(tabs.indexOf(tab) + step + tabs.length) % tabs.length];
      if (next !== undefined) {
        next.focus();
        select(next);
      }
    });
  }
}

function setUpTwin(twin: HTMLElement): void {
  const specPane = twin.querySelector<HTMLElement>('[data-pane="spec"]');
  const codePane = twin.querySelector<HTMLElement>('[data-pane="code"]');
  const status = twin.querySelector<HTMLElement>('.twin-status');
  if (specPane === null || codePane === null) return;
  const activePanel = (pane: HTMLElement): HTMLElement | null =>
    pane.querySelector<HTMLElement>('.twin-panel[data-active]');

  const codeTabs = [...codePane.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
  const clear = (): void => {
    twin.querySelectorAll('[data-linked]').forEach((line) => line.removeAttribute('data-linked'));
    for (const tab of codeTabs) tab.removeAttribute('data-has-link');
    twin.removeAttribute('data-linking');
    if (status !== null) status.textContent = '';
  };

  const link = (side: 'spec' | 'code', line: number): void => {
    const specPanel = activePanel(specPane);
    const codePanel = activePanel(codePane);
    // Only the specification that was compiled (the first file) has pairs.
    if (specPanel === null || codePanel === null || !specPanel.hasAttribute('data-primary')) return;
    const pair = pairAt(pairsOf(codePanel), side, line);
    clear();
    // Point at the other generated files that have a counterpart for this line.
    if (side === 'spec') {
      for (const tab of codeTabs) {
        const panel = document.getElementById(tab.getAttribute('aria-controls') ?? '');
        if (panel !== codePanel && pairAt(pairsOf(panel), 'spec', line) !== undefined) {
          tab.setAttribute('data-has-link', '');
        }
      }
    }
    if (pair === undefined) return;
    const specLines = lines(specPanel);
    const codeLines = lines(codePanel);
    for (const [from, to] of pair.spec) {
      for (let n = from; n <= to; n++) specLines[n - 1]?.setAttribute('data-linked', '');
    }
    for (const [from, to] of pair.code) {
      for (let n = from; n <= to; n++) codeLines[n - 1]?.setAttribute('data-linked', '');
    }
    twin.setAttribute('data-linking', '');
    if (status !== null) status.textContent = pair.label;
    const [other, otherLines, ranges] =
      side === 'spec' ? [codePanel, codeLines, pair.code] : [specPanel, specLines, pair.spec];
    reveal(other, otherLines[(ranges[0]?.[0] ?? 1) - 1]);
  };

  const onPointer = (side: 'spec' | 'code') => (event: Event) => {
    const target = event.target instanceof Element ? event.target.closest('.ec-line') : null;
    if (!(target instanceof HTMLElement)) return;
    const panel = target.closest('.twin-panel');
    const index = lines(panel).indexOf(target);
    if (index !== -1) link(side, index + 1);
  };
  specPane.addEventListener('pointerover', onPointer('spec'));
  codePane.addEventListener('pointerover', onPointer('code'));
  specPane.addEventListener('pointerleave', clear);
  codePane.addEventListener('pointerleave', clear);

  const path = twin.querySelector<HTMLElement>('[data-twin-path]');
  const showPath = (): void => {
    const file = activePanel(codePane)?.dataset.file;
    if (path !== null && file !== undefined) path.textContent = file;
  };
  twin.querySelectorAll('.twin-tabs').forEach((list) =>
    setUpTabs(list, () => {
      clear();
      showPath();
    }),
  );

  // Narrow screens: one side at a time.
  const sideTabs = [...twin.querySelectorAll<HTMLButtonElement>('[data-side-tab]')];
  for (const tab of sideTabs) {
    tab.addEventListener('click', () => {
      const side = tab.dataset.sideTab ?? 'spec';
      twin.dataset.side = side;
      for (const other of sideTabs) other.setAttribute('aria-selected', String(other === tab));
    });
  }
  twin.setAttribute('data-ready', '');
}

export function setUpTwins(): void {
  document.querySelectorAll<HTMLElement>('figure.twin:not([data-ready])').forEach(setUpTwin);
}
