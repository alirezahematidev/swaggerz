import { cn } from '../../lib/cn.ts';

const METHOD_CLASS: Record<string, string> = {
  GET: 'text-method-get bg-method-get/12',
  POST: 'text-method-post bg-method-post/14',
  PUT: 'text-method-put bg-method-put/13',
  PATCH: 'text-method-patch bg-method-patch/13',
  DELETE: 'text-method-delete bg-method-delete/12',
};

/** A fixed-width pill with the HTTP method in its earth-tone color. */
export function MethodBadge({
  method,
  size = 'md',
  className,
}: {
  method: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const upper = method.toUpperCase();
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-[5px] font-mono font-semibold tracking-wide',
        size === 'sm' && 'h-[18px] w-[46px] text-[9.5px]',
        size === 'md' && 'h-5 w-[52px] text-[10.5px]',
        size === 'lg' && 'h-7 px-2.5 text-[12px]',
        METHOD_CLASS[upper] ?? 'bg-method-other/12 text-method-other',
        className,
      )}
    >
      {upper}
    </span>
  );
}

/** Text color of a method, for charts. */
export function methodColor(method: string): string {
  const upper = method.toUpperCase();
  return (
    {
      GET: 'var(--method-get)',
      POST: 'var(--method-post)',
      PUT: 'var(--method-put)',
      PATCH: 'var(--method-patch)',
      DELETE: 'var(--method-delete)',
    }[upper] ?? 'var(--method-other)'
  );
}
