import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '../../lib/cn.ts';

export const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium transition-[background-color,border-color,color,box-shadow,opacity] duration-150 select-none disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground shadow-card hover:opacity-90',
        secondary:
          'border border-border-strong bg-surface text-foreground shadow-card hover:border-faint-foreground/50 hover:bg-muted/60',
        ghost: 'text-muted-foreground hover:bg-muted hover:text-foreground',
        outline: 'border border-border bg-transparent text-foreground hover:bg-muted',
        danger: 'bg-danger text-background shadow-card hover:opacity-90',
        link: 'h-auto px-0 text-foreground underline decoration-border-strong underline-offset-4 hover:decoration-foreground',
      },
      size: {
        sm: 'h-7 px-2.5 text-[12.5px]',
        md: 'h-8 px-3 text-[13px]',
        lg: 'h-9 px-4 text-[13.5px]',
        icon: 'size-8',
        'icon-sm': 'size-7',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
);

export function Button({
  className,
  variant,
  size,
  asChild = false,
  type = 'button',
  ...props
}: ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Component = asChild ? Slot.Root : 'button';
  return (
    <Component
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...(asChild ? {} : { type })}
      {...props}
    />
  );
}
