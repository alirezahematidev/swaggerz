import type { ChangedItem, ReloadDelta, ServerEvent } from '../../api-types.ts';
import { cn } from '../lib/cn.ts';
import { Badge } from './ui/badge.tsx';
import type { ToastMessage } from './ui/toast.tsx';

const LABEL = { new: 'New', updated: 'Updated', removed: 'Removed' } as const;

/**
 * Marks an operation or model that appeared or changed while the dashboard was running (through
 * live reload or Reload). The marks reset when the dashboard restarts.
 */
export function ChangeBadge({
  change,
  className,
}: {
  change: ChangedItem['change'] | undefined;
  className?: string;
}) {
  if (change === undefined) return null;
  return (
    <Badge
      tone={change === 'new' ? 'marigold' : change === 'updated' ? 'info' : 'neutral'}
      className={cn('gap-1', change === 'removed' && 'line-through decoration-1', className)}
    >
      {change === 'removed' ? null : (
        <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current" />
      )}
      {LABEL[change]}
      <span className="sr-only"> since the dashboard started</span>
    </Badge>
  );
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

/** "2 new operations, 1 updated model". */
export function describeDelta(delta: ReloadDelta | undefined): string[] {
  if (delta === undefined) return [];
  const parts: string[] = [];
  for (const [noun, counts] of [
    ['operation', delta.operations],
    ['model', delta.models],
  ] as const) {
    if (counts.new > 0) parts.push(plural(counts.new, `new ${noun}`));
    if (counts.updated > 0) parts.push(plural(counts.updated, `updated ${noun}`));
    if (counts.removed > 0) parts.push(plural(counts.removed, `removed ${noun}`));
  }
  return parts;
}

/** The notification shown when the dashboard reloads. */
export function reloadToast(event: Extract<ServerEvent, { type: 'reload' }>): ToastMessage {
  const source =
    event.trigger === 'manual'
      ? 'Reloaded from disk'
      : `${event.files.length === 0 ? 'Files' : event.files.join(', ')} changed`;
  if (!event.ok) {
    return {
      tone: 'danger',
      title: 'The change could not be loaded',
      description: `${source}: ${event.error ?? 'unknown error'}. Showing the last version that loaded.`,
    };
  }
  const parts = describeDelta(event.delta);
  return {
    tone: parts.length === 0 ? 'info' : 'success',
    title: parts.length === 0 ? 'No changes to operations or models' : capitalize(parts.join(', ')),
    description: source,
  };
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
