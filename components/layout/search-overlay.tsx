"use client";

import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "@/lib/i18n/navigation";
import { CURRENT_PHASE, allModules } from "@/lib/nav";
import { cn } from "@/lib/utils";

/**
 * Arama overlay'i — PRD §8: modüller/ayarlar arası fuzzy arama, tam ekran overlay.
 * ⌘K / Ctrl+K ile açılır (PRD §4.4.2).
 */

/** Basit alt dizi eşleşmesi — "aev" → "Actions & Events". */
function fuzzyScore(query: string, target: string): number | null {
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  if (q.length === 0) return 0;

  const exact = t.indexOf(q);
  if (exact !== -1) return exact === 0 ? 1000 : 500 - exact;

  let ti = 0;
  let score = 0;
  for (const char of q) {
    const found = t.indexOf(char, ti);
    if (found === -1) return null;
    // Ardışık eşleşmeler daha yüksek puan alır.
    score += found === ti ? 10 : 1;
    ti = found + 1;
  }
  return score;
}

export function SearchOverlay({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  /** Kapatırken durumu sıfırla — bir sonraki açılış temiz başlasın. */
  const close = useCallback(() => {
    setQuery("");
    setCursor(0);
    onClose();
  }, [onClose]);

  const modules = useMemo(() => allModules(), []);

  const results = useMemo(() => {
    const scored = modules
      .map((m) => ({ module: m, label: t(m.labelKey) }))
      .map((r) => ({ ...r, score: fuzzyScore(query, r.label) }))
      .filter((r): r is typeof r & { score: number } => r.score !== null)
      .sort((a, b) => b.score - a.score);
    return query ? scored.slice(0, 8) : scored.slice(0, 8);
  }, [modules, query, t]);

  useEffect(() => {
    if (!open) return;
    // Overlay açılınca odak doğrudan arama alanına (klavye kullanıcısı için).
    // Sorgu sıfırlama kapanışta yapılır — açılışta setState etmek cascading render üretir.
    inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        close();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setCursor((c) => Math.min(c + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setCursor((c) => Math.max(c - 1, 0));
      } else if (e.key === "Enter") {
        const hit = results[cursor];
        if (hit) {
          router.push(hit.module.href);
          close();
        }
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, results, cursor, router, close]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={close} aria-hidden />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("topbar.searchLabel")}
        className="relative w-full max-w-xl rounded-[var(--card-radius)] border border-border-soft bg-surface-1 shadow-2xl"
      >
        <div className="flex items-center gap-3 border-b border-border-subtle px-4 py-3">
          <Search className="size-4 shrink-0 text-muted" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCursor(0);
            }}
            placeholder={t("topbar.searchHint")}
            aria-label={t("topbar.searchLabel")}
            className="flex-1 bg-transparent text-sm text-white placeholder:text-muted focus:outline-none"
          />
          <kbd className="rounded border border-border-soft px-1.5 py-0.5 text-[10px] text-muted">
            Esc
          </kbd>
        </div>

        <ul className="max-h-80 overflow-y-auto py-2">
          {results.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-muted">
              {t("topbar.searchEmpty")}
            </li>
          ) : (
            results.map((r, i) => (
              <li key={r.module.pageId}>
                <button
                  type="button"
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => {
                    router.push(r.module.href);
                    close();
                  }}
                  className={cn(
                    "flex w-full items-center justify-between px-4 py-2 text-left text-sm",
                    i === cursor ? "bg-accent text-white" : "text-muted-2",
                  )}
                >
                  <span>{r.label}</span>
                  {r.module.phase > CURRENT_PHASE && (
                    <span className="text-[10px] tracking-wide text-muted uppercase">
                      {t("common.comingSoon")}
                    </span>
                  )}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
