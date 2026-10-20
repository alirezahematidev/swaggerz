import { Command as CommandPrimitive } from 'cmdk';
import { Search } from 'lucide-react';
import type { ComponentProps } from 'react';
import { cn } from '../../lib/cn.ts';
import { ScrollArea } from './scroll-area.tsx';

export function Command({ className, ...props }: ComponentProps<typeof CommandPrimitive>) {
  return (
    <CommandPrimitive
      className={cn('flex h-full w-full flex-col overflow-hidden text-foreground', className)}
      {...props}
    />
  );
}

export function CommandInput({
  className,
  ...props
}: ComponentProps<typeof CommandPrimitive.Input>) {
  return (
    <div className="flex items-center gap-2 border-b border-border px-3.5">
      <Search aria-hidden="true" className="size-4 shrink-0 text-faint-foreground" />
      <CommandPrimitive.Input
        className={cn(
          'h-11 w-full bg-transparent text-[14px] outline-none placeholder:text-faint-foreground focus-visible:outline-none',
          className,
        )}
        {...props}
      />
    </div>
  );
}

/** The result list; it scrolls (with custom scrollbars) past `max-h`. */
export function CommandList({ className, ...props }: ComponentProps<typeof CommandPrimitive.List>) {
  return (
    <ScrollArea viewportClassName="max-h-[min(60vh,420px)] scroll-py-1.5">
      <CommandPrimitive.List className={cn('p-1.5', className)} {...props} />
    </ScrollArea>
  );
}

export function CommandEmpty(props: ComponentProps<typeof CommandPrimitive.Empty>) {
  return (
    <CommandPrimitive.Empty
      className="py-8 text-center text-[13px] text-muted-foreground"
      {...props}
    />
  );
}

export function CommandGroup({
  className,
  ...props
}: ComponentProps<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      className={cn(
        'overflow-hidden p-0.5 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-faint-foreground [&_[cmdk-group-heading]]:uppercase',
        className,
      )}
      {...props}
    />
  );
}

export function CommandItem({ className, ...props }: ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      className={cn(
        'flex min-h-8 cursor-pointer items-center gap-2.5 rounded-md px-2 py-1 text-[13px] outline-none select-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 data-[selected=true]:bg-muted [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground',
        className,
      )}
      {...props}
    />
  );
}
