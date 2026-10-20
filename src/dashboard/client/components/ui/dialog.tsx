import { X } from 'lucide-react';
import { AlertDialog as AlertPrimitive, Dialog as DialogPrimitive } from 'radix-ui';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '../../lib/cn.ts';
import { Button, buttonVariants } from './button.tsx';

const OVERLAY =
  'fixed inset-0 z-50 bg-[#0d0c0a]/45 backdrop-blur-[2px] data-[state=open]:animate-in';
const PANEL =
  'fixed top-[12vh] left-1/2 z-50 w-[calc(100vw-2rem)] -translate-x-1/2 rounded-xl border border-border bg-surface text-foreground shadow-pop outline-none data-[state=open]:animate-in';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;

export function DialogContent({
  className,
  children,
  title,
  description,
  hideTitle = false,
  showClose = true,
  closeClassName,
  ...props
}: ComponentProps<typeof DialogPrimitive.Content> & {
  title: string;
  description?: string;
  hideTitle?: boolean;
  showClose?: boolean;
  /** Positions the close button (default: top right corner). */
  closeClassName?: string;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className={OVERLAY} />
      <DialogPrimitive.Content className={cn(PANEL, 'max-w-lg', className)} {...props}>
        <DialogPrimitive.Title
          className={hideTitle ? 'sr-only' : 'px-5 pt-5 font-display text-lg font-semibold'}
        >
          {title}
        </DialogPrimitive.Title>
        {description === undefined ? (
          <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
        ) : (
          <DialogPrimitive.Description
            className={hideTitle ? 'sr-only' : 'px-5 pt-1 text-[13px] text-muted-foreground'}
          >
            {description}
          </DialogPrimitive.Description>
        )}
        {children}
        {showClose ? (
          <DialogPrimitive.Close asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className={cn('absolute top-3.5 right-3.5', closeClassName)}
              aria-label="Close"
            >
              <X />
            </Button>
          </DialogPrimitive.Close>
        ) : null}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

/** A confirmation dialog for consequential actions. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  children,
  destructive = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  children?: ReactNode;
  destructive?: boolean;
}) {
  return (
    <AlertPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AlertPrimitive.Portal>
        <AlertPrimitive.Overlay className={OVERLAY} />
        <AlertPrimitive.Content className={cn(PANEL, 'max-w-md p-5')}>
          <AlertPrimitive.Title className="font-display text-lg font-semibold">
            {title}
          </AlertPrimitive.Title>
          <AlertPrimitive.Description asChild>
            <div className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
              {description}
            </div>
          </AlertPrimitive.Description>
          {children}
          <div className="mt-5 flex justify-end gap-2">
            <AlertPrimitive.Cancel className={buttonVariants({ variant: 'secondary' })}>
              Cancel
            </AlertPrimitive.Cancel>
            <AlertPrimitive.Action
              className={buttonVariants({ variant: destructive ? 'danger' : 'primary' })}
              onClick={onConfirm}
            >
              {confirmLabel}
            </AlertPrimitive.Action>
          </div>
        </AlertPrimitive.Content>
      </AlertPrimitive.Portal>
    </AlertPrimitive.Root>
  );
}
