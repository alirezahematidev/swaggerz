import type { ReactNode } from 'react';
import { cn } from '../lib/cn.ts';

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  children,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn('flex flex-col gap-3', className)}>
      {eyebrow === undefined ? null : (
        <div className="flex flex-wrap items-center gap-2 text-[12px] font-medium tracking-wide text-muted-foreground">
          {eyebrow}
        </div>
      )}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <h1 className="min-w-0 font-display text-[30px] leading-[1.15] font-semibold text-balance break-words sm:text-[34px]">
          {title}
        </h1>
        {actions === undefined ? null : (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>
      {description === undefined ? null : (
        <div className="max-w-3xl font-display text-[16px] leading-7 text-muted-foreground">
          {description}
        </div>
      )}
      {children}
    </header>
  );
}

/** A labelled metric. */
export function Stat({
  label,
  value,
  caption,
  tone,
}: {
  label: ReactNode;
  value: ReactNode;
  caption?: ReactNode;
  tone?: 'warning' | 'danger';
}) {
  return (
    <div className="flex h-full flex-col gap-1">
      <span className="text-[11.5px] font-medium tracking-wider text-faint-foreground uppercase">
        {label}
      </span>
      <span
        className={cn(
          'font-display text-[32px] leading-none font-semibold tabular-nums',
          tone === 'warning' && 'text-warning',
          tone === 'danger' && 'text-danger',
        )}
      >
        {value}
      </span>
      {caption === undefined ? null : (
        <span className="text-[12.5px] text-muted-foreground">{caption}</span>
      )}
    </div>
  );
}

/**
 * Label/value pairs: two columns when the container is wide enough, otherwise each label sits
 * above its value.
 */
export function MetaList({
  items,
  className,
}: {
  items: readonly (readonly [ReactNode, ReactNode] | false)[];
  className?: string;
}) {
  return (
    <div className="@container">
      <dl
        className={cn(
          'flex flex-col gap-3 text-[13px] @md:grid @md:grid-cols-[minmax(110px,max-content)_minmax(0,1fr)] @md:gap-x-5 @md:gap-y-2.5',
          className,
        )}
      >
        {items
          .filter((item): item is readonly [ReactNode, ReactNode] => item !== false)
          .map(([label, value], index) => (
            <div key={index} className="flex min-w-0 flex-col gap-1 @md:contents">
              <dt className="text-[12px] text-muted-foreground @md:pt-px @md:text-[13px]">
                {label}
              </dt>
              <dd className="min-w-0 break-words">{value}</dd>
            </div>
          ))}
      </dl>
    </div>
  );
}

export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <code
      className={cn('rounded-[4px] bg-muted px-1 py-px text-[12px] text-foreground', className)}
    >
      {children}
    </code>
  );
}
