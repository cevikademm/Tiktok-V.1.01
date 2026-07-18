"use client";

import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * "Bu sayfada" bölüm gezgini — PRD §5.1: sağda daraltılabilir TOC paneli.
 * Görünür bölümü IntersectionObserver ile takip eder.
 */
export function SectionNavigator({
  sections,
}: {
  sections: Array<{ id: string; label: string }>;
}) {
  const t = useTranslations();
  const [active, setActive] = useState(sections[0]?.id);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        // En üstteki görünür bölüm aktif sayılır.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: "-64px 0px -60% 0px", threshold: 0 },
    );

    for (const s of sections) {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [sections]);

  return (
    <nav
      aria-label={t("common.onThisPage")}
      className={cn(
        "sticky top-4 hidden h-fit shrink-0 rounded-[var(--card-radius)]",
        "border border-border-subtle bg-surface-1 p-3 xl:block",
        collapsed ? "w-12" : "w-56",
      )}
    >
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
        className="mb-2 flex w-full items-center gap-2 text-xs font-medium text-muted transition-colors hover:text-white"
      >
        <ChevronRight
          aria-hidden
          className={cn("size-3 transition-transform duration-200", !collapsed && "rotate-90")}
        />
        {!collapsed && <span>{t("common.onThisPage")}</span>}
      </button>

      {!collapsed && (
        <ul className="flex flex-col gap-0.5">
          {sections.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                aria-current={active === s.id ? "true" : undefined}
                className={cn(
                  "block rounded px-2 py-1 text-xs transition-colors duration-200",
                  active === s.id
                    ? "bg-white/8 text-white"
                    : "text-muted hover:text-link",
                )}
              >
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      )}
    </nav>
  );
}
