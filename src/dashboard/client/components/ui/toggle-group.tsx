import { ToggleGroup as ToggleGroupPrimitive } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '../../lib/cn.ts';

export const ToggleGroup = ({
  className,
  ...props
}: ComponentProps<typeof ToggleGroupPrimitive.Root>) => (
  <ToggleGroupPrimitive.Root
    className={cn('flex flex-wrap items-center gap-1', className)}
    {...props}
  />
);

/**
 * Selected items are styled from `aria-checked`/`aria-pressed` rather than `data-state`, which a
 * wrapping tooltip trigger would overwrite.
 */
export function ToggleGroupItem({
  className,
  ...props
}: ComponentProps<typeof ToggleGroupPrimitive.Item>) {
  return (
    <ToggleGroupPrimitive.Item
      className={cn(
        'inline-flex h-6 cursor-pointer items-center justify-center gap-1 rounded-md border border-border px-2 text-[12px] font-medium text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/25 aria-checked:border-border-strong aria-checked:bg-surface aria-checked:text-foreground aria-checked:shadow-card aria-pressed:border-border-strong aria-pressed:bg-surface aria-pressed:text-foreground aria-pressed:shadow-card [&_svg]:size-3.5',
        className,
      )}
      {...props}
    />
  );
}
