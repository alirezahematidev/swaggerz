import { ArrowLeft } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '../lib/cn.ts';
import { ScrollArea } from './ui/scroll-area.tsx';

/**
 * A list/detail layout filling the content area. On wide screens the list and the detail scroll
 * independently; on narrow screens either the list or the selected item is shown, with a link
 * back to the list.
 */
export function SplitLayout({
  list,
  detail,
  selection,
  backHref,
  backLabel,
}: {
  list: ReactNode;
  detail: ReactNode;
  /** Key of the selected item, if any. A new selection starts at the top of the detail. */
  selection: string | undefined;
  backHref: string;
  backLabel: string;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // A newly selected item starts at the top; a live reload of the same item keeps the position.
    if (selection !== undefined) viewport.current?.scrollTo({ top: 0 });
  }, [selection]);
  const hasSelection = selection !== undefined;
  return (
    <div className="h-full lg:grid lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)]">
      <aside
        className={cn(
          'flex h-full min-h-0 min-w-0 flex-col border-border bg-surface/40 lg:border-r',
          hasSelection && 'max-lg:hidden',
        )}
      >
        {list}
      </aside>
      <ScrollArea
        className={cn('h-full min-w-0', !hasSelection && 'max-lg:hidden')}
        viewportRef={viewport}
        viewportProps={{ tabIndex: -1, 'aria-label': 'Details' }}
      >
        <div className="@container min-w-0 px-5 py-6 sm:px-8 lg:px-8 lg:py-9 xl:px-10">
          {hasSelection ? (
            <a
              href={backHref}
              className="mb-4 inline-flex items-center gap-1.5 rounded-sm text-[13px] text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/25 lg:hidden"
            >
              <ArrowLeft className="size-3.5" />
              {backLabel}
            </a>
          ) : null}
          {detail}
        </div>
      </ScrollArea>
    </div>
  );
}

/** The filter header and scrolling list of a list pane. */
export function ListPane({ filters, children }: { filters: ReactNode; children: ReactNode }) {
  return (
    <>
      <div className="flex shrink-0 flex-col gap-2.5 border-b border-border px-4 pt-5 pb-3.5">
        {filters}
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="py-2 pr-3 pl-2">{children}</div>
      </ScrollArea>
    </>
  );
}

export function ListItem({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    // Keep the selected item visible when it is chosen from elsewhere (search, links).
    if (active) ref.current?.scrollIntoView({ block: 'nearest' });
  }, [active]);
  return (
    <a
      ref={ref}
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative flex flex-col gap-0.5 rounded-lg px-3 py-1.5 transition-colors outline-none hover:bg-muted/70 focus-visible:ring-[3px] focus-visible:ring-ring/25 focus-visible:ring-inset',
        active && 'bg-highlight/75 hover:bg-highlight/75',
      )}
    >
      {active ? (
        <span
          aria-hidden="true"
          className="absolute top-2 bottom-2 left-0 w-[3px] rounded-full bg-marigold"
        />
      ) : null}
      {children}
    </a>
  );
}
