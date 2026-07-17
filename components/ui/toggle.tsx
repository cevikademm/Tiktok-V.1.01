"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * Toggle (switch) — klavye erişilebilir (WCAG 2.2 AA, PRD §13).
 * role="switch" + aria-checked; Space/Enter ile değişir (native button davranışı).
 */
export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
  className,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  className?: string;
}) {
  const id = useId();

  return (
    <div className={cn("flex items-start gap-3", className)}>
      <button
        type="button"
        role="switch"
        id={id}
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 h-5 w-9 shrink-0 rounded-full",
          "transition-colors duration-200 ease-[var(--ease-standard)]",
          "disabled:cursor-not-allowed disabled:opacity-50",
          checked ? "bg-primary" : "bg-surface-4",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "absolute top-0.5 left-0.5 size-4 rounded-full bg-white",
            "transition-transform duration-200 ease-[var(--ease-standard)]",
            checked && "translate-x-4",
          )}
        />
      </button>

      {(label || description) && (
        <label htmlFor={id} className="cursor-pointer select-none">
          {label && <span className="text-sm text-white">{label}</span>}
          {description && (
            <span className="block text-xs text-muted">{description}</span>
          )}
        </label>
      )}
    </div>
  );
}
