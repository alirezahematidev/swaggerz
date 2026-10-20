import { Search } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '../../lib/cn.ts';

const FIELD =
  'h-8 w-full min-w-0 rounded-md border border-input bg-surface px-2.5 text-[13px] text-foreground shadow-card transition-[border-color,box-shadow] outline-none placeholder:text-faint-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25 focus-visible:outline-none disabled:opacity-50';

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input data-slot="input" className={cn(FIELD, className)} {...props} />;
}

/** A search field with a leading icon and an optional trailing hint (e.g. a shortcut). */
export function SearchInput({
  className,
  hint,
  ...props
}: Omit<ComponentProps<'input'>, 'type'> & { hint?: ReactNode }) {
  return (
    <div className={cn('relative', className)}>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-faint-foreground"
      />
      <input
        type="search"
        data-slot="input"
        className={cn(
          FIELD,
          'pl-8 [&::-webkit-search-cancel-button]:hidden',
          hint === undefined ? '' : 'pr-9',
        )}
        {...props}
      />
      {hint === undefined ? null : (
        <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2">
          {hint}
        </span>
      )}
    </div>
  );
}
