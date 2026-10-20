import { CircleAlert, Inbox, LoaderCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn.ts';

export function Spinner({ className }: { className?: string }) {
  return (
    <LoaderCircle
      aria-hidden="true"
      className={cn('size-4 animate-spin text-faint-foreground', className)}
    />
  );
}

/** A loading message; it fades in after a short delay so fast loads do not flash it. */
export function Loading({ label = 'Loading…', className }: { label?: string; className?: string }) {
  return (
    <output
      aria-live="polite"
      className={cn(
        'flex animate-[fade-in_200ms_ease-out_250ms_both] items-center gap-2.5 py-10 text-[13px] text-muted-foreground',
        className,
      )}
    >
      <Spinner />
      {label}
    </output>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn('animate-pulse rounded-md bg-muted', className)} />;
}

export function ErrorState({
  error,
  title = 'Something went wrong',
}: {
  error: Error;
  title?: string;
}) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-lg border border-danger/25 bg-danger/8 px-4 py-3 text-[13px]"
    >
      <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-danger" />
      <div className="min-w-0">
        <div className="font-medium text-danger">{title}</div>
        <div className="break-words text-foreground/80">{error.message}</div>
      </div>
    </div>
  );
}

export function Empty({
  children,
  icon,
  className,
}: {
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 px-6 py-10 text-center text-[13px] text-muted-foreground',
        className,
      )}
    >
      <span className="text-faint-foreground [&_svg]:size-5">{icon ?? <Inbox />}</span>
      <div className="max-w-sm text-balance">{children}</div>
    </div>
  );
}
