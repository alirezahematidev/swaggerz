import type { ComponentProps } from 'react';
import { cn } from '../../lib/cn.ts';
import { ScrollArea } from './scroll-area.tsx';

/** A table that scrolls sideways (with custom scrollbars) when it is wider than its container. */
export function Table({ className, ...props }: ComponentProps<'table'>) {
  return (
    <ScrollArea orientation="horizontal" className="w-full">
      <table className={cn('w-full border-collapse text-left text-[13px]', className)} {...props} />
    </ScrollArea>
  );
}

export function TableHead({ className, ...props }: ComponentProps<'thead'>) {
  return <thead className={cn('[&_tr]:border-b [&_tr]:border-border', className)} {...props} />;
}

export function TableBody({ className, ...props }: ComponentProps<'tbody'>) {
  return <tbody className={cn('[&_tr:last-child]:border-0', className)} {...props} />;
}

export function TableRow({ className, ...props }: ComponentProps<'tr'>) {
  return <tr className={cn('border-b border-border/70 align-top', className)} {...props} />;
}

export function Th({ className, ...props }: ComponentProps<'th'>) {
  return (
    <th
      className={cn(
        'h-8 px-3 text-[11px] font-medium tracking-wider whitespace-nowrap text-faint-foreground uppercase first:pl-0 last:pr-0',
        className,
      )}
      {...props}
    />
  );
}

export function Td({ className, ...props }: ComponentProps<'td'>) {
  return <td className={cn('px-3 py-2.5 first:pl-0 last:pr-0', className)} {...props} />;
}
