import type { ComponentProps } from 'react';
import { cn } from '../../lib/cn.ts';

export function Kbd({ className, ...props }: ComponentProps<'kbd'>) {
  return (
    <kbd
      className={cn(
        'inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[4px] border border-border-strong bg-surface-sunken px-1 font-sans text-[10.5px] font-medium text-muted-foreground',
        className,
      )}
      {...props}
    />
  );
}
