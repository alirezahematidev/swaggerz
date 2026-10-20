import { Tabs as TabsPrimitive } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '../../lib/cn.ts';
import { ScrollArea } from './scroll-area.tsx';

export const Tabs = TabsPrimitive.Root;
export const TabsContent = ({
  className,
  ...props
}: ComponentProps<typeof TabsPrimitive.Content>) => (
  <TabsPrimitive.Content className={cn('outline-none', className)} {...props} />
);

/**
 * `line`: page sections with an underline (scrolls sideways when it does not fit); `pill`: compact
 * segmented filter.
 */
export function TabsList({
  className,
  variant = 'line',
  ...props
}: ComponentProps<typeof TabsPrimitive.List> & { variant?: 'line' | 'pill' }) {
  const list = (
    <TabsPrimitive.List
      data-variant={variant}
      className={cn(
        'group/tabs flex items-center',
        variant === 'line'
          ? 'w-max min-w-full gap-5 shadow-[inset_0_-1px_0_var(--border)]'
          : 'inline-flex w-fit max-w-full flex-wrap gap-0.5 rounded-lg bg-muted p-0.5',
        className,
      )}
      {...props}
    />
  );
  return variant === 'line' ? (
    <ScrollArea orientation="horizontal" type="scroll">
      {list}
    </ScrollArea>
  ) : (
    list
  );
}

export function TabsTrigger({ className, ...props }: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap text-[13px] font-medium text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/25 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:text-foreground [&_svg]:size-3.5 [&_svg]:shrink-0',
        // Icons give way in narrow containers (the detail pane of the split layout, phones).
        '@max-lg:[&_svg]:hidden',
        'group-data-[variant=line]/tabs:h-9 group-data-[variant=line]/tabs:rounded-t-sm group-data-[variant=line]/tabs:border-b-2 group-data-[variant=line]/tabs:border-transparent group-data-[variant=line]/tabs:focus-visible:ring-inset group-data-[variant=line]/tabs:data-[state=active]:border-marigold',
        'group-data-[variant=pill]/tabs:h-6 group-data-[variant=pill]/tabs:rounded-md group-data-[variant=pill]/tabs:px-2.5 group-data-[variant=pill]/tabs:text-[12.5px] group-data-[variant=pill]/tabs:data-[state=active]:bg-surface group-data-[variant=pill]/tabs:data-[state=active]:shadow-card',
        className,
      )}
      {...props}
    />
  );
}

/** A count shown inside a tab label. */
export function TabCount({ children }: { children: number }) {
  return (
    <span className="rounded-[4px] bg-muted px-1 text-[11px] tabular-nums text-muted-foreground group-data-[variant=pill]/tabs:bg-transparent">
      {children}
    </span>
  );
}
