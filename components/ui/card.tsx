import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Kart — PRD §4.3: sabit genişlik 860–902px, rounded-[10px].
 * `--card-w` token'ından gelir; bileşende sabit px yok.
 */
export function Card({
  children,
  className,
  featured,
  id,
}: {
  children: ReactNode;
  className?: string;
  /** Öne çıkan kart çerçevesi (--border-maroon, PRD §4.1). */
  featured?: boolean;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        "w-full max-w-[var(--card-w)] rounded-[var(--card-radius)] bg-surface-1 p-6",
        featured ? "border border-border-maroon" : "border border-border-subtle",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function CardTitle({
  children,
  className,
  as: Tag = "h2",
}: {
  children: ReactNode;
  className?: string;
  as?: "h2" | "h3";
}) {
  return (
    <Tag
      className={cn(
        Tag === "h2" ? "text-xl" : "text-base",
        "mb-2 font-semibold text-heading",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function CardBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("text-sm leading-relaxed text-muted-2", className)}>
      {children}
    </div>
  );
}
