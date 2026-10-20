import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import { Select as SelectPrimitive } from 'radix-ui';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '../../lib/cn.ts';
import { styleNonce } from '../../lib/nonce.ts';

export interface SelectOption<T extends string> {
  readonly value: T;
  readonly label: ReactNode;
  readonly hint?: ReactNode;
}

/** A custom select: a button that opens a keyboard-navigable list (Radix Select). */
export function Select<T extends string>({
  value,
  onValueChange,
  options,
  label,
  className,
  size = 'md',
}: {
  value: T;
  onValueChange: (value: T) => void;
  options: readonly SelectOption<T>[];
  /** Accessible name. */
  label: string;
  className?: string;
  size?: 'sm' | 'md';
}) {
  return (
    <SelectPrimitive.Root
      value={value}
      onValueChange={(next) => {
        const option = options.find((candidate) => candidate.value === next);
        if (option !== undefined) onValueChange(option.value);
      }}
    >
      <SelectPrimitive.Trigger
        aria-label={label}
        className={cn(
          'inline-flex w-full min-w-0 cursor-pointer items-center justify-between gap-2 rounded-md border border-input bg-surface px-2.5 text-[13px] text-foreground shadow-card transition-[border-color,box-shadow] outline-none hover:border-border-strong focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25 data-[state=open]:border-ring',
          size === 'sm' ? 'h-7' : 'h-8',
          className,
        )}
      >
        <span className="truncate">
          <SelectPrimitive.Value />
        </span>
        <SelectPrimitive.Icon asChild>
          <ChevronDown className="size-3.5 shrink-0 text-faint-foreground" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={6}
          className="z-50 max-h-[min(var(--radix-select-content-available-height),360px)] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg border border-border bg-surface p-1 text-foreground shadow-pop data-[state=open]:animate-in"
        >
          <SelectPrimitive.ScrollUpButton className="flex h-5 cursor-default items-center justify-center text-faint-foreground">
            <ChevronUp className="size-3.5" />
          </SelectPrimitive.ScrollUpButton>
          <SelectPrimitive.Viewport {...styleNonce()}>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value} hint={option.hint}>
                {option.label}
              </SelectItem>
            ))}
          </SelectPrimitive.Viewport>
          <SelectPrimitive.ScrollDownButton className="flex h-5 cursor-default items-center justify-center text-faint-foreground">
            <ChevronDown className="size-3.5" />
          </SelectPrimitive.ScrollDownButton>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

function SelectItem({
  children,
  hint,
  className,
  ...props
}: ComponentProps<typeof SelectPrimitive.Item> & { hint?: ReactNode }) {
  return (
    <SelectPrimitive.Item
      className={cn(
        'relative flex w-full cursor-pointer items-center gap-2 rounded-md py-1.5 pr-8 pl-2 text-[13px] outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-muted',
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      {hint === undefined ? null : (
        <span className="ml-auto text-xs text-faint-foreground tabular-nums">{hint}</span>
      )}
      <SelectPrimitive.ItemIndicator className="absolute right-2 inline-flex">
        <Check className="size-3.5 text-marigold-ink" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}
