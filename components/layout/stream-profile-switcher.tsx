"use client";

import { Check, ChevronsUpDown, Settings2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { useProfileLabel } from "@/components/modules/stream-profiles/profile-label";
import { useApp } from "@/components/providers/app-provider";
import { Toggle } from "@/components/ui/toggle";
import { useMockStore } from "@/lib/data/mock/use-store";
import { Link } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * Topbar profil değiştirici — PRD §4.4 bileşen 7.
 * Aktif profili gösterir, elle geçiş yaptırır ve otomatik geçişi buradan açıp kapatır.
 * Tam düzenleme `/stream-profiles` sayfasındadır (docs/sekmeler/06-akis-profilleri.md).
 */
export function StreamProfileSwitcher() {
  const t = useTranslations();
  const { backend } = useApp();
  const label = useProfileLabel();
  const state = useMockStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const profiles = state.streamProfiles;
  const activeIndex = Math.max(
    0,
    profiles.findIndex((p) => p.id === state.activeProfileId),
  );
  const active = profiles[activeIndex];
  if (!active) return null;

  const detected = state.gameSignal.gameId;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label={t("topbar.streamProfileSwitch")}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-8 items-center gap-2 rounded-lg px-2 text-sm text-muted-2 transition-colors hover:bg-white/8 hover:text-white"
      >
        <span aria-hidden>{active.emoji}</span>
        <span className="hidden max-w-[10rem] truncate lg:inline">
          {label(active, activeIndex)}
        </span>
        <ChevronsUpDown className="size-3.5" aria-hidden />
      </button>

      {open && (
        <div className="absolute top-[calc(100%+8px)] right-0 z-50 w-80 rounded-[var(--card-radius)] border border-border-soft bg-surface-1 shadow-2xl">
          <div className="border-b border-border-subtle px-4 py-3">
            <h3 className="mb-2 text-sm font-semibold text-white">
              {t("streamProfiles.title")}
            </h3>
            <Toggle
              checked={state.autoSwitch.enabled}
              onChange={(next) => void backend.profiles.setAutoSwitch({ enabled: next })}
              label={t("topbar.streamProfileAuto")}
              description={
                detected
                  ? t("streamProfiles.signal.detected", {
                      game: t(`streamProfiles.games.${detected}`),
                    })
                  : t("streamProfiles.signal.none")
              }
            />
          </div>

          <ul className="max-h-72 overflow-y-auto py-1">
            {profiles.map((profile, index) => {
              const isActive = profile.id === state.activeProfileId;
              return (
                <li key={profile.id}>
                  <button
                    type="button"
                    onClick={() => {
                      void backend.profiles.activate(profile.id, { manual: true });
                      setOpen(false);
                    }}
                    aria-current={isActive}
                    className={cn(
                      "flex w-full items-center gap-2 px-4 py-2 text-left text-sm transition-colors",
                      isActive ? "text-white" : "text-muted-2 hover:bg-white/8 hover:text-white",
                    )}
                  >
                    <span aria-hidden>{profile.emoji}</span>
                    <span className="flex-1 truncate">{label(profile, index)}</span>
                    {isActive && (
                      <Check className="size-3.5 text-primary" aria-hidden />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="border-t border-border-subtle px-4 py-2">
            <Link
              href="/stream-profiles"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 text-xs text-link hover:text-link-hover"
            >
              <Settings2 className="size-3.5" aria-hidden />
              {t("topbar.streamProfileManage")}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
