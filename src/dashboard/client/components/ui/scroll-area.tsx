import { ScrollArea as ScrollAreaPrimitive } from 'radix-ui';
import type { ComponentProps, ReactNode, Ref } from 'react';
import { cn } from '../../lib/cn.ts';
import { styleNonce } from '../../lib/nonce.ts';

type Orientation = 'vertical' | 'horizontal' | 'both';

/**
 * A scroll container with custom overlay scrollbars (the native ones are hidden). The viewport
 * is the element that scrolls: give it a height (`className` on the root for fixed or flex sizes,
 * `viewportClassName` for a `max-h-*`).
 *
 * Vertical areas lay their content out as a block so text can truncate; horizontal areas size the
 * content to its natural width.
 */
export function ScrollArea({
  children,
  className,
  viewportClassName,
  viewportRef,
  viewportProps,
  orientation = 'vertical',
  type = 'hover',
}: {
  children: ReactNode;
  className?: string;
  viewportClassName?: string;
  viewportRef?: Ref<HTMLDivElement>;
  /** Extra attributes for the scrolling element (`tabIndex`, `aria-label`, `id`, …). */
  viewportProps?: Omit<ComponentProps<'div'>, 'className' | 'children' | 'ref'>;
  orientation?: Orientation;
  type?: 'hover' | 'scroll' | 'auto' | 'always';
}) {
  return (
    <ScrollAreaPrimitive.Root
      type={type}
      scrollHideDelay={500}
      className={cn('relative overflow-hidden', className)}
    >
      <ScrollAreaPrimitive.Viewport
        ref={viewportRef}
        disableImplicitContentElement
        className={cn(
          'size-full rounded-[inherit] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25',
          viewportClassName,
        )}
        {...styleNonce()}
        {...viewportProps}
      >
        <ScrollAreaPrimitive.Content
          style={orientation === 'vertical' ? { display: 'block', minWidth: '100%' } : undefined}
        >
          {children}
        </ScrollAreaPrimitive.Content>
      </ScrollAreaPrimitive.Viewport>
      {orientation === 'horizontal' ? null : <ScrollBar orientation="vertical" />}
      {orientation === 'vertical' ? null : <ScrollBar orientation="horizontal" />}
      {orientation === 'both' ? <ScrollAreaPrimitive.Corner /> : null}
    </ScrollAreaPrimitive.Root>
  );
}

function ScrollBar({ orientation }: { orientation: 'vertical' | 'horizontal' }) {
  return (
    <ScrollAreaPrimitive.Scrollbar
      orientation={orientation}
      className={cn(
        'group/scrollbar z-20 flex touch-none p-[2px] select-none data-[state=hidden]:animate-fade-out data-[state=visible]:animate-fade-in',
        orientation === 'vertical' ? 'h-full w-2.5' : 'h-2.5 flex-col',
      )}
    >
      <ScrollAreaPrimitive.Thumb className="relative flex-1 rounded-full bg-faint-foreground/45 transition-colors group-hover/scrollbar:bg-faint-foreground/75 before:absolute before:top-1/2 before:left-1/2 before:size-full before:min-h-6 before:min-w-6 before:-translate-1/2" />
    </ScrollAreaPrimitive.Scrollbar>
  );
}
