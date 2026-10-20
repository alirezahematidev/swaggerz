import { cn } from '../lib/cn.ts';

/** Multi-paragraph text from the specification, rendered as plain (escaped) text. */
export function Prose({
  text,
  className,
  size = 'md',
}: {
  text: string | undefined;
  className?: string;
  size?: 'sm' | 'md';
}) {
  if (text === undefined || text.trim() === '') return null;
  return (
    <div
      className={cn(
        'prose flex max-w-3xl flex-col gap-2 font-display text-foreground/85',
        size === 'md' ? 'text-[15.5px] leading-7' : 'text-[14px] leading-6',
        className,
      )}
    >
      {text
        .trim()
        .split(/\n\s*\n/)
        .map((paragraph, index) => (
          <p key={index} className="whitespace-pre-line">
            {paragraph}
          </p>
        ))}
    </div>
  );
}
