import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '../../lib/cn.ts';

export const badgeVariants = cva(
  'inline-flex h-5 shrink-0 items-center gap-1 whitespace-nowrap rounded-[5px] px-1.5 text-[11.5px] leading-none font-medium',
  {
    variants: {
      tone: {
        neutral: 'bg-muted text-muted-foreground',
        outline: 'border border-border-strong text-muted-foreground',
        success: 'bg-success/12 text-success',
        warning: 'bg-warning/14 text-warning',
        danger: 'bg-danger/12 text-danger',
        info: 'bg-info/12 text-info',
        marigold: 'bg-highlight text-marigold-ink',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>['tone']>;

export function Badge({
  className,
  tone,
  ...props
}: ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

/** A small colored dot with a label, used for statuses. */
export function StatusDot({ tone, className }: { tone: BadgeTone; className?: string }) {
  const color = {
    neutral: 'bg-faint-foreground',
    outline: 'bg-faint-foreground',
    success: 'bg-success',
    warning: 'bg-warning',
    danger: 'bg-danger',
    info: 'bg-info',
    marigold: 'bg-marigold',
  }[tone];
  return (
    <span aria-hidden="true" className={cn('relative inline-flex size-2 shrink-0', className)}>
      <span className={cn('absolute inset-0 rounded-full opacity-30', color, 'scale-[1.9]')} />
      <span className={cn('relative size-2 rounded-full', color)} />
    </span>
  );
}
