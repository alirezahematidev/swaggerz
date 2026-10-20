import { Check, Copy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from './button.tsx';
import { Tooltip } from './tooltip.tsx';

/** Copies `value` to the clipboard and confirms with a check mark. */
export function CopyButton({ value, label = 'Copy' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => {
      setCopied(false);
    }, 1400);
    return () => {
      clearTimeout(timer);
    };
  }, [copied]);
  return (
    <Tooltip content={copied ? 'Copied' : label}>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={label}
        onClick={() => {
          navigator.clipboard.writeText(value).then(
            () => {
              setCopied(true);
            },
            () => undefined,
          );
        }}
      >
        {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
      </Button>
    </Tooltip>
  );
}
