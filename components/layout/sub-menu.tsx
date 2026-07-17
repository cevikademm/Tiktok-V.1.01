"use client";

import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Link, usePathname } from "@/lib/i18n/navigation";
import { CURRENT_PHASE, NAV, bubbleForPath } from "@/lib/nav";
import { cn } from "@/lib/utils";

/**
 * Alt menü paneli — PRD §4.3:
 * 256px (w-64, bg-secondary), grup başlığı + chevron (açıkken rotate-90),
 * alt öğe hover rengi #53AFDF, aktif bg-accent.
 */
export function SubMenu() {
  const t = useTranslations();
  const pathname = usePathname();
  const activeBubble = bubbleForPath(pathname);

  // Grup bubble'ları (alt öğesi olanlar) panelde listelenir.
  const groups = NAV.filter((b) => b.items && b.items.length > 0);

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  return (
    <aside
      className="w-64 shrink-0 overflow-y-auto bg-secondary py-3"
      aria-label={t("common.onThisPage")}
    >
      {groups.map((group) => {
        const isOpen = !collapsed[group.key];
        const isActiveGroup = activeBubble?.key === group.key;

        return (
          <div key={group.key} className="mb-1">
            <button
              type="button"
              onClick={() =>
                setCollapsed((c) => ({ ...c, [group.key]: !collapsed[group.key] }))
              }
              aria-expanded={isOpen}
              className={cn(
                "flex w-full items-center gap-2 px-4 py-2 text-left text-sm font-medium",
                "transition-colors duration-200 ease-[var(--ease-standard)] hover:text-link",
                isActiveGroup ? "text-white" : "text-muted",
              )}
            >
              <ChevronRight
                aria-hidden
                className={cn(
                  "size-3.5 transition-transform duration-200 ease-[var(--ease-standard)]",
                  isOpen && "rotate-90",
                )}
              />
              <span style={{ color: isActiveGroup ? `var(${group.accentVar})` : undefined }}>
                {t(group.labelKey)}
              </span>
            </button>

            {isOpen && (
              <ul>
                {group.items?.map((item) => {
                  const isActive = pathname === item.href;
                  const isFuture = item.phase > CURRENT_PHASE;

                  return (
                    <li key={item.pageId}>
                      <Link
                        href={item.href}
                        aria-current={isActive ? "page" : undefined}
                        className={cn(
                          "flex items-center justify-between py-1.5 pr-4 pl-10 text-sm",
                          "transition-colors duration-200 ease-[var(--ease-standard)]",
                          isActive
                            ? "bg-accent text-white"
                            : "text-muted-2 hover:text-link",
                        )}
                      >
                        <span>{t(item.labelKey)}</span>
                        {isFuture && (
                          // text-muted-2 (#9B9B9B): bg-white/8 yüzeyde #949494 yalnız 4.16:1 verir,
                          // bu ton 4.55:1 ile WCAG AA eşiğini geçer (PRD §4.1 paletinin içinde).
                          <span className="rounded bg-white/8 px-1.5 py-0.5 text-[10px] tracking-wide text-muted-2 uppercase">
                            {t("common.comingSoon")}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </aside>
  );
}
