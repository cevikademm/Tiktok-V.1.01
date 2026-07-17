"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * Buton — PRD §4.4.4: primary buton çift katmanlı
 * (gölge katmanı bg-primary-dark, hover kalkma/basma animasyonu).
 */
const buttonVariants = cva(
  cn(
    "inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium whitespace-nowrap",
    "transition-all duration-200 ease-[var(--ease-standard)]",
    "disabled:pointer-events-none disabled:opacity-50",
  ),
  {
    variants: {
      variant: {
        primary: "bg-primary text-white hover:brightness-110",
        secondary: "bg-surface-3 text-white hover:bg-surface-4",
        ghost: "text-muted hover:bg-white/8 hover:text-white",
        link: "text-link underline-offset-4 hover:text-link-hover hover:underline",
        danger: "bg-error text-white hover:brightness-110",
        outline: "border border-border-soft text-white hover:bg-white/8",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-9 px-4",
        lg: "h-11 px-6 text-base",
        icon: "size-9",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Çift katmanlı kalkma efekti (PRD §4.4.4 "Bağlan" butonu). */
  raised?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, raised, children, ...props }, ref) => {
    if (raised) {
      return (
        <span className="group relative inline-flex">
          {/* Gölge katmanı — butonun altında sabit durur, buton üstünde hareket eder. */}
          <span
            aria-hidden
            className="absolute inset-0 translate-y-[3px] rounded-lg bg-primary-dark"
          />
          <button
            ref={ref}
            className={cn(
              buttonVariants({ variant, size }),
              "relative -translate-y-[1px] group-hover:-translate-y-[3px] group-active:translate-y-0",
              className,
            )}
            {...props}
          >
            {children}
          </button>
        </span>
      );
    }

    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      >
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";

export { buttonVariants };
