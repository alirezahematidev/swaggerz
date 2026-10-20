import type { ComponentProps, ReactNode } from 'react';
import { cn } from '../../lib/cn.ts';

export function Card({ className, ...props }: ComponentProps<'section'>) {
  return (
    <section
      className={cn('min-w-0 rounded-xl border border-border bg-surface shadow-card', className)}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  description,
  actions,
  className,
  id,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <header
      className={cn(
        'flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-5 pt-4',
        className,
      )}
    >
      <div className="min-w-0">
        <h2 id={id} className="font-display text-[17px] leading-7 font-semibold">
          {title}
        </h2>
        {description === undefined ? null : (
          <p className="text-[13px] text-muted-foreground">{description}</p>
        )}
      </div>
      {/* As tall as the title line, so badges and buttons center on it. */}
      {actions === undefined ? null : (
        <div className="flex min-h-7 items-center gap-2">{actions}</div>
      )}
    </header>
  );
}

export function CardContent({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('px-5 pt-3 pb-5', className)} {...props} />;
}
