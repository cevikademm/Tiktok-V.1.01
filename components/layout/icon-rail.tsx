"use client";

import {
  Bug,
  Coins,
  Gamepad2,
  Home,
  ListMusic,
  MessagesSquare,
  Monitor,
  SlidersHorizontal,
  Users,
  Volume2,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useIsErrorAdmin, useUnresolvedErrorCount } from "@/lib/error-report/store";
import { Link, usePathname } from "@/lib/i18n/navigation";
import { NAV, bubbleForPath, type BubbleKey, type NavBubble } from "@/lib/nav";
import { useLocalStorage } from "@/lib/use-local-storage";
import { cn } from "@/lib/utils";

/**
 * Sol ikon rayı — PRD §4.3:
 * 64px genişlik (w-16 p-3 gap-3), bubble'lar size-11 rounded-xl,
 * varsayılan bg rgba(255,255,255,0.06), hover rgba(255,255,255,0.2),
 * aktif öğede soldan beyaz gösterge çubuğu w-[6px] h-[28px] rounded-r,
 * öğeler draggable (sürükle-bırak sıralama),
 * Kurmak bubble'ında kurulum ilerleme halkası (--progress).
 */

const ICONS: Record<string, LucideIcon> = {
  Home,
  SlidersHorizontal,
  Monitor,
  Zap,
  Volume2,
  MessagesSquare,
  Coins,
  ListMusic,
  Gamepad2,
  Users,
};

const ORDER_KEY = "livekit.railOrder.v1";

/** Sunucu snapshot'ı için sabit referans (useLocalStorage sözleşmesi). */
const DEFAULT_ORDER: BubbleKey[] = NAV.map((b) => b.key);

/**
 * Kayıtlı sıralamayı doğrular: bilinmeyen anahtarları atar, yeni eklenen
 * bubble'ları sona ekler. Böylece NAV değişince eski kayıt bozulmaz.
 */
function parseOrder(raw: string): BubbleKey[] {
  const saved = JSON.parse(raw) as BubbleKey[];
  const valid = saved.filter((k) => NAV.some((b) => b.key === k));
  const missing = DEFAULT_ORDER.filter((k) => !valid.includes(k));
  return [...valid, ...missing];
}

export function IconRail({
  setupProgress = 0,
}: {
  /** Kurmak halkası: 0-1 arası tamamlanma (PRD §4.3). */
  setupProgress?: number;
}) {
  const t = useTranslations();
  const pathname = usePathname();
  const activeBubble = bubbleForPath(pathname);

  // Hata Bildirimleri sekmesi — yalnızca admin modunda (localStorage bayrağı).
  const isErrorAdmin = useIsErrorAdmin();
  const unresolvedErrors = useUnresolvedErrorCount();
  const isErrorActive =
    pathname === "/hata-bildirimleri" || pathname.startsWith("/hata-bildirimleri/");

  // Sıralama kullanıcıya özel ve kalıcı (PRD §4.3 sürükle-bırak).
  const [order, setOrder] = useLocalStorage(ORDER_KEY, DEFAULT_ORDER, parseOrder);
  const [dragKey, setDragKey] = useState<BubbleKey | null>(null);

  function handleDrop(targetKey: BubbleKey) {
    if (!dragKey || dragKey === targetKey) return;
    const next = [...order];
    const from = next.indexOf(dragKey);
    const to = next.indexOf(targetKey);
    next.splice(from, 1);
    next.splice(to, 0, dragKey);
    setOrder(next);
    setDragKey(null);
  }

  const bubbles = order
    .map((key) => NAV.find((b) => b.key === key))
    .filter((b): b is NavBubble => b !== undefined);

  return (
    <nav
      aria-label={t("nav.start")}
      className="flex w-16 shrink-0 flex-col gap-3 bg-sidebar p-3"
    >
      {bubbles.map((bubble) => {
        const Icon = ICONS[bubble.icon] ?? Home;
        const isActive = activeBubble?.key === bubble.key;
        // Grup bubble'ı ilk alt öğesine gider; tek sayfalık bubble kendi href'ine.
        const href = bubble.href ?? bubble.items?.[0]?.href ?? "/start";
        const label = t(bubble.labelKey);

        return (
          <div key={bubble.key} className="relative">
            {isActive && (
              <span
                aria-hidden
                className="absolute top-1/2 -left-3 h-[28px] w-[6px] -translate-y-1/2 rounded-r bg-white"
              />
            )}

            <Link
              href={href}
              title={label}
              aria-label={label}
              aria-current={isActive ? "page" : undefined}
              draggable
              onDragStart={() => setDragKey(bubble.key)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(bubble.key)}
              onDragEnd={() => setDragKey(null)}
              style={{ color: `var(${bubble.accentVar})` }}
              className={cn(
                "group relative flex size-11 items-center justify-center rounded-xl",
                "bg-[var(--bubble-bg)] transition-colors duration-200 ease-[var(--ease-standard)]",
                "hover:bg-[var(--bubble-bg-hover)]",
                isActive && "bg-[var(--bubble-bg-hover)]",
                dragKey === bubble.key && "opacity-50",
              )}
            >
              <Icon className="size-5" aria-hidden />

              {/* Kurulum ilerleme halkası — yalnız Kurmak bubble'ında (PRD §4.3). */}
              {bubble.key === "setup" && setupProgress > 0 && setupProgress < 1 && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 rounded-xl"
                  style={{
                    background: `conic-gradient(var(${bubble.accentVar}) calc(var(--progress) * 360deg), transparent 0)`,
                    ["--progress" as string]: String(setupProgress),
                    mask: "radial-gradient(circle, transparent 62%, black 64%)",
                    WebkitMask: "radial-gradient(circle, transparent 62%, black 64%)",
                  }}
                />
              )}
            </Link>
          </div>
        );
      })}

      {/* 🐞 Hata Bildirimleri — admin-gated, en altta ayrık durur. */}
      {isErrorAdmin && (
        <div className="relative mt-auto">
          {isErrorActive && (
            <span
              aria-hidden
              className="absolute top-1/2 -left-3 h-[28px] w-[6px] -translate-y-1/2 rounded-r bg-white"
            />
          )}

          <Link
            href="/hata-bildirimleri"
            title={t("nav.errorReports")}
            aria-label={t("nav.errorReports")}
            aria-current={isErrorActive ? "page" : undefined}
            style={{ color: "var(--warning)" }}
            className={cn(
              "group relative flex size-11 items-center justify-center rounded-xl",
              "bg-[var(--bubble-bg)] transition-colors duration-200 ease-[var(--ease-standard)]",
              "hover:bg-[var(--bubble-bg-hover)]",
              isErrorActive && "bg-[var(--bubble-bg-hover)]",
            )}
          >
            <Bug className="size-5" aria-hidden />

            {/* Çözülmemiş bildirim rozeti (new + in_progress). */}
            {unresolvedErrors > 0 && (
              <span
                aria-hidden
                className="absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border border-white bg-error px-1 text-[10px] font-bold text-white"
              >
                {unresolvedErrors > 99 ? "99+" : unresolvedErrors}
              </span>
            )}
          </Link>
        </div>
      )}
    </nav>
  );
}
