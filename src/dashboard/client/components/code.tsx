import { useMemo, useState } from 'react';
import type { CodeVariant } from '../../api-types.ts';
import { tokenize, type TokenKind } from '../filters.ts';
import { cn } from '../lib/cn.ts';
import { CopyButton } from './ui/copy-button.tsx';
import { ScrollArea } from './ui/scroll-area.tsx';
import { Select } from './ui/select.tsx';
import { Empty } from './ui/states.tsx';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs.tsx';

const TOKEN_CLASS: Record<Exclude<TokenKind, 'text'>, string> = {
  comment: 'text-code-comment italic',
  string: 'text-code-string',
  keyword: 'text-code-keyword',
  number: 'text-code-number',
  type: 'text-code-type',
};

/** Highlighted source with line numbers. Text is rendered as text nodes, never as HTML. */
export function CodeBlock({
  code,
  label,
  className,
  maxHeight = 'max-h-[min(560px,70dvh)]',
}: {
  code: string;
  label: string;
  className?: string;
  maxHeight?: string;
}) {
  const lines = useMemo(() => {
    const result: { kind: TokenKind; text: string }[][] = [[]];
    for (const token of tokenize(code)) {
      const parts = token.text.split('\n');
      parts.forEach((part, index) => {
        if (index > 0) result.push([]);
        if (part !== '') result.at(-1)?.push({ kind: token.kind, text: part });
      });
    }
    if (result.length > 1 && result.at(-1)?.length === 0) result.pop();
    return result;
  }, [code]);
  const gutter = String(lines.length).length;
  return (
    <div
      className={cn('overflow-hidden rounded-lg border border-border bg-surface-sunken', className)}
    >
      <div className="flex h-9 items-center justify-between gap-3 border-b border-border bg-surface/60 pr-1.5 pl-3.5">
        <code className="truncate text-[12px] text-muted-foreground">{label}</code>
        <CopyButton value={code} label="Copy code" />
      </div>
      <ScrollArea
        orientation="both"
        viewportClassName={maxHeight}
        // Scrollable code must be reachable with the keyboard.
        viewportProps={{ tabIndex: 0, role: 'region', 'aria-label': label }}
      >
        <pre className="py-3 text-[12.5px] leading-[1.7]">
          <code className="grid min-w-max">
            {lines.map((tokens, index) => (
              <span key={index} className="flex pr-6">
                <span
                  aria-hidden="true"
                  className="sticky left-0 shrink-0 bg-surface-sunken pr-4 pl-4 text-right text-faint-foreground/70 select-none"
                  style={{ width: `${gutter + 3}ch` }}
                >
                  {index + 1}
                </span>
                <span className="whitespace-pre">
                  {tokens.map((token, i) =>
                    token.kind === 'text' ? (
                      token.text
                    ) : (
                      <span key={i} className={TOKEN_CLASS[token.kind]}>
                        {token.text}
                      </span>
                    ),
                  )}
                </span>
              </span>
            ))}
          </code>
        </pre>
      </ScrollArea>
    </div>
  );
}

/** Generated code with one tab per output variant (TypeScript, JavaScript, declarations). */
export function CodeViewer({ variants }: { variants: readonly CodeVariant[] }) {
  const [selected, setSelected] = useState('0');
  if (variants.length === 0) return <Empty>No generated code.</Empty>;
  const index = Math.min(Number(selected), variants.length - 1);
  const current = variants[index];
  if (current === undefined) return null;
  return (
    <div className="@container flex flex-col gap-3">
      {/* Segmented control when the variants fit on one line, a select otherwise. */}
      <Tabs value={String(index)} onValueChange={setSelected} className="hidden @xl:block">
        <TabsList variant="pill" aria-label="Generated file">
          {variants.map((variant, i) => (
            <TabsTrigger key={`${variant.label}:${variant.path}`} value={String(i)}>
              {variant.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <Select
        label="Generated file"
        className="w-full @xl:hidden"
        value={String(index)}
        onValueChange={setSelected}
        options={variants.map((variant, i) => ({ value: String(i), label: variant.label }))}
      />
      <CodeBlock code={current.content} label={current.path} />
    </div>
  );
}
