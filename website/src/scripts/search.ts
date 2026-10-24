/**
 * The search dialog: Pagefind's API (the index Starlight builds) behind a dialog of our own.
 * Focus stays inside while it is open, arrow keys move through the results, and the previously
 * focused element gets focus back when it closes.
 */
interface PagefindResult {
  readonly url: string;
  readonly meta: { readonly title?: string };
  readonly excerpt: string;
  readonly sub_results?: readonly {
    readonly title: string;
    readonly url: string;
    readonly excerpt: string;
  }[];
}

interface Pagefind {
  options(options: { baseUrl: string }): Promise<void>;
  init(): Promise<void>;
  debouncedSearch(
    query: string,
    options?: unknown,
    wait?: number,
  ): Promise<{
    results: readonly { data(): Promise<PagefindResult> }[];
  } | null>;
}

const isMac = (): boolean => /(Mac|iPhone|iPod|iPad)/i.test(navigator.platform);

/** An excerpt as nodes: text and Pagefind's <mark> highlights, nothing else. */
function excerptNodes(html: string): Node[] {
  const template = document.createElement('template');
  template.innerHTML = html;
  const nodes: Node[] = [];
  for (const child of template.content.childNodes) {
    if (child.nodeType === Node.TEXT_NODE)
      nodes.push(document.createTextNode(child.textContent ?? ''));
    else if (child instanceof HTMLElement && child.tagName === 'MARK') {
      const mark = document.createElement('mark');
      mark.textContent = child.textContent;
      nodes.push(mark);
    } else nodes.push(document.createTextNode(child.textContent ?? ''));
  }
  return nodes;
}

/** The element matching `selector` inside `root`; the markup in Search.astro always has it. */
function part<T extends Element>(root: Element, selector: string, type: new () => T): T {
  const element = root.querySelector(selector);
  if (!(element instanceof type)) throw new Error(`Search: missing ${selector}`);
  return element;
}

class Search extends HTMLElement {
  #pagefind: Promise<Pagefind | undefined> | undefined;
  #returnFocus: HTMLElement | null = null;
  #active = -1;
  #query = 0;
  #ready = false;
  #layer!: HTMLElement;
  #input!: HTMLInputElement;
  #results!: HTMLUListElement;
  #status!: HTMLElement;

  connectedCallback(): void {
    // connectedCallback runs again if the element moves; set up once.
    if (this.#ready) return;
    this.#ready = true;
    const trigger = part(this, '[data-search-open]', HTMLButtonElement);
    this.#layer = part(this, '[data-search-layer]', HTMLElement);
    this.#input = part(this, '[data-search-input]', HTMLInputElement);
    this.#results = part(this, '[data-search-results]', HTMLUListElement);
    this.#status = part(this, '[data-search-status]', HTMLElement);
    trigger.dataset.shortcut = isMac() ? '⌘K' : 'Ctrl K';
    trigger.setAttribute('aria-keyshortcuts', isMac() ? 'Meta+K' : 'Control+K');

    trigger.addEventListener('click', () => this.open());
    this.#layer
      .querySelectorAll('[data-search-close]')
      .forEach((element) => element.addEventListener('click', () => this.close()));
    // The header's backdrop blur makes it the containing block of fixed descendants, which
    // would confine the dialog to the header; it lives at the end of the body instead.
    document.body.append(this.#layer);
    this.#input.addEventListener('input', () => void this.search(this.#input.value));
    this.#layer.addEventListener('keydown', (event) => this.onKey(event));
    document.addEventListener('keydown', (event) => {
      const typing =
        event.target instanceof HTMLElement &&
        (event.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName));
      if (
        (event.key === 'k' && (event.metaKey || event.ctrlKey)) ||
        (event.key === '/' && !typing)
      ) {
        event.preventDefault();
        if (this.#layer.hidden) this.open();
        else this.close();
      }
    });
  }

  open(): void {
    this.#returnFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.#layer.hidden = false;
    document.documentElement.classList.add('search-open');
    this.#input.focus();
    this.#input.select();
    this.#pagefind ??= this.#load();
    if (this.#input.value === '')
      this.#status.textContent = 'Type to search the guides, the references and the diagnostics.';
  }

  close(): void {
    this.#layer.hidden = true;
    document.documentElement.classList.remove('search-open');
    this.#returnFocus?.focus();
  }

  async #load(): Promise<Pagefind | undefined> {
    try {
      const url = `${this.dataset.base ?? '/'}pagefind/pagefind.js`;
      const pagefind = (await import(/* @vite-ignore */ url)) as Pagefind;
      await pagefind.options({ baseUrl: this.dataset.base ?? '/' });
      await pagefind.init();
      return pagefind;
    } catch {
      this.#status.textContent = 'Search works in the built site; this one has no index.';
      return undefined;
    }
  }

  async search(query: string): Promise<void> {
    const id = ++this.#query;
    const pagefind = await this.#pagefind;
    if (pagefind === undefined) return;
    if (query.trim() === '') {
      this.#render([]);
      this.#status.textContent = 'Type to search the guides, the references and the diagnostics.';
      return;
    }
    const response = await pagefind.debouncedSearch(query, {}, 120);
    if (response === null || id !== this.#query) return;
    const results = await Promise.all(response.results.slice(0, 8).map((result) => result.data()));
    if (id !== this.#query) return;
    this.#render(results);
    this.#status.textContent =
      results.length === 0
        ? `Nothing matches “${query}”.`
        : `${response.results.length} ${response.results.length === 1 ? 'page' : 'pages'} match.`;
  }

  #render(results: readonly PagefindResult[]): void {
    const list = this.#results;
    list.replaceChildren();
    this.#active = -1;
    results.forEach((result, index) => {
      const item = document.createElement('li');
      item.setAttribute('role', 'option');
      item.id = `search-option-${index}`;
      const link = document.createElement('a');
      link.href = result.url;
      link.tabIndex = -1;
      const title = document.createElement('span');
      title.className = 'search-result-title';
      title.textContent = result.meta.title ?? result.url;
      const excerpt = document.createElement('span');
      excerpt.className = 'search-result-excerpt';
      excerpt.append(...excerptNodes(result.excerpt));
      link.append(title, excerpt);
      item.append(link);
      // The page's own title comes back as a section (#_top): that is the result itself.
      const sections = (result.sub_results ?? [])
        .filter((sub) => sub.url !== result.url && !sub.url.endsWith('#_top'))
        .slice(0, 2);
      if (sections.length > 0) {
        const nested = document.createElement('ul');
        nested.className = 'search-result-sections';
        for (const section of sections) {
          const entry = document.createElement('li');
          const anchor = document.createElement('a');
          anchor.href = section.url;
          anchor.tabIndex = -1;
          anchor.textContent = section.title;
          entry.append(anchor);
          nested.append(entry);
        }
        item.append(nested);
      }
      item.addEventListener('pointermove', () => this.#select(index));
      list.append(item);
    });
    this.#input.setAttribute('aria-expanded', String(results.length > 0));
    if (results.length > 0) this.#select(0);
  }

  #select(index: number): void {
    const items = [...this.#results.children] as HTMLElement[];
    if (items.length === 0) return;
    this.#active = (index + items.length) % items.length;
    items.forEach((item, i) => item.setAttribute('aria-selected', String(i === this.#active)));
    const current = items[this.#active];
    if (current !== undefined) {
      this.#input.setAttribute('aria-activedescendant', current.id);
      current.scrollIntoView({ block: 'nearest' });
    }
  }

  onKey(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      this.#select(this.#active + (event.key === 'ArrowDown' ? 1 : -1));
    } else if (event.key === 'Enter') {
      const link = this.#results.children[this.#active]?.querySelector('a');
      if (link instanceof HTMLAnchorElement) {
        event.preventDefault();
        location.href = link.href;
      }
    } else if (event.key === 'Tab') {
      // Keep focus inside the dialog: the field and the close button.
      const focusable = [
        this.#input,
        this.#layer.querySelector<HTMLElement>('.search-escape'),
      ].filter((element): element is HTMLElement => element !== null);
      const index = focusable.indexOf(document.activeElement as HTMLElement);
      event.preventDefault();
      focusable[(index + (event.shiftKey ? -1 : 1) + focusable.length) % focusable.length]?.focus();
    }
  }
}

export function setUpSearch(): void {
  if (customElements.get('sz-search') === undefined) customElements.define('sz-search', Search);
}
