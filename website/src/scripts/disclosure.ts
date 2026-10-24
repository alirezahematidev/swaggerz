/**
 * Disclosures without <details>: a button with `aria-expanded` that shows or hides the panel it
 * controls. Inline panels are `hidden="until-found"`, so the browser's find-in-page still reaches
 * their text and opens them, as does following a link to them. Popovers
 * (`data-disclosure="popover"`) also close on Escape, on a click outside and when a link inside
 * them is followed.
 */
function setUp(root: HTMLElement): void {
  const button = root.querySelector<HTMLButtonElement>(
    ':scope > [data-disclosure-button], :scope > * > [data-disclosure-button]',
  );
  const panel =
    button === null ? null : document.getElementById(button.getAttribute('aria-controls') ?? '');
  if (button === null || panel === null) return;
  const popover = root.dataset.disclosure === 'popover';
  const isOpen = (): boolean => button.getAttribute('aria-expanded') === 'true';
  const set = (open: boolean): void => {
    button.setAttribute('aria-expanded', String(open));
    if (open) panel.removeAttribute('hidden');
    else panel.setAttribute('hidden', popover ? '' : 'until-found');
    root.toggleAttribute('data-open', open);
    root.dispatchEvent(new CustomEvent('sz-toggle', { detail: open }));
  };
  button.addEventListener('click', () => set(!isOpen()));

  if (!popover) {
    panel.addEventListener('beforematch', () => set(true));
    const reveal = (): void => {
      const id = decodeURIComponent(location.hash.slice(1));
      const target = id === '' ? null : document.getElementById(id);
      if (target !== null && (target === root || root.contains(target)) && !isOpen()) set(true);
    };
    addEventListener('hashchange', reveal);
    reveal();
    return;
  }

  root.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isOpen()) {
      set(false);
      button.focus();
    }
  });
  document.addEventListener('pointerdown', (event) => {
    if (isOpen() && event.target instanceof Node && !root.contains(event.target)) set(false);
  });
  panel.addEventListener('click', (event) => {
    if (event.target instanceof Element && event.target.closest('a') !== null) set(false);
  });
}

export function setUpDisclosures(): void {
  document.querySelectorAll<HTMLElement>('[data-disclosure]:not([data-ready])').forEach((root) => {
    root.setAttribute('data-ready', '');
    setUp(root);
  });
}
