import { CircleAlert, CircleCheck, Info, X } from 'lucide-react';
import { Toast as ToastPrimitive } from 'radix-ui';
import { useCallback, useState, type ReactNode } from 'react';
import { cn } from '../../lib/cn.ts';

export type ToastTone = 'success' | 'info' | 'danger';

export interface ToastMessage {
  readonly tone: ToastTone;
  readonly title: string;
  readonly description?: ReactNode;
  /** Milliseconds; danger toasts stay longer by default. */
  readonly duration?: number;
}

const ICON: Record<ToastTone, ReactNode> = {
  success: <CircleCheck className="size-4 text-success" />,
  info: <Info className="size-4 text-info" />,
  danger: <CircleAlert className="size-4 text-danger" />,
};

let nextId = 0;

/** Toast state: `push` shows a message; at most three are kept. */
export function useToasts(): {
  toasts: readonly (ToastMessage & { id: number })[];
  push: (toast: ToastMessage) => void;
  dismiss: (id: number) => void;
} {
  const [toasts, setToasts] = useState<readonly (ToastMessage & { id: number })[]>([]);
  const push = useCallback((toast: ToastMessage) => {
    setToasts((current) => [...current.slice(-2), { ...toast, id: ++nextId }]);
  }, []);
  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);
  return { toasts, push, dismiss };
}

/** Renders toasts in the bottom-right corner (bottom edge on phones). */
export function Toaster({
  toasts,
  onDismiss,
}: {
  toasts: readonly (ToastMessage & { id: number })[];
  onDismiss: (id: number) => void;
}) {
  return (
    <ToastPrimitive.Provider swipeDirection="right" label="Notification">
      {toasts.map((toast) => (
        <ToastPrimitive.Root
          key={toast.id}
          duration={toast.duration ?? (toast.tone === 'danger' ? 9000 : 4500)}
          onOpenChange={(open) => {
            if (!open) onDismiss(toast.id);
          }}
          className={cn(
            'pointer-events-auto grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 rounded-xl border border-border bg-surface py-3 pr-2.5 pl-3.5 text-foreground shadow-pop',
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=cancel]:translate-x-0 data-[swipe=cancel]:transition-transform data-[swipe=end]:animate-out data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)]',
          )}
        >
          <span className="mt-0.5">{ICON[toast.tone]}</span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <ToastPrimitive.Title className="text-[13.5px] leading-5 font-medium">
              {toast.title}
            </ToastPrimitive.Title>
            {toast.description === undefined ? null : (
              <ToastPrimitive.Description className="text-[12.5px] leading-5 break-words text-muted-foreground">
                {toast.description}
              </ToastPrimitive.Description>
            )}
          </div>
          <ToastPrimitive.Close
            aria-label="Dismiss"
            className="inline-flex size-6 cursor-pointer items-center justify-center rounded-md text-faint-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/25"
          >
            <X className="size-3.5" />
          </ToastPrimitive.Close>
        </ToastPrimitive.Root>
      ))}
      <ToastPrimitive.Viewport className="pointer-events-none fixed right-0 bottom-0 z-[60] m-0 flex w-full list-none flex-col gap-2 p-4 outline-none sm:max-w-[380px] sm:p-5" />
    </ToastPrimitive.Provider>
  );
}
