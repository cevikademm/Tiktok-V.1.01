"use client";

import { Keyboard, Settings2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Toggle } from "@/components/ui/toggle";
import { Link } from "@/lib/i18n/navigation";
import { mutate } from "@/lib/data/mock/store";
import { useMockStore } from "@/lib/data/mock/use-store";
import { cn } from "@/lib/utils";

/**
 * Hızlı Erişim — PRD §5.1.5: 3 kutu (TTS / Sound Alerts / Eylemler ve Etkinlikler),
 * her birinde ayar linki, Etkinleştirilmiş/Engelli toggle'ı, "Klavye Kısayolu Ayarla".
 * Toggle durumu localStorage'da kalıcı (PRD §15.3).
 */

type QuickKey = "tts" | "sounds" | "actions";

const BOXES: Array<{ key: QuickKey; labelKey: string; href: string }> = [
  { key: "tts", labelKey: "start.quickAccessTts", href: "/tts" },
  { key: "sounds", labelKey: "start.quickAccessSounds", href: "/sounds" },
  { key: "actions", labelKey: "start.quickAccessActions", href: "/actionsandevents" },
];

export function QuickAccess() {
  const t = useTranslations();
  // Kalıcılık localStorage'da (PRD §15.3); okuma hidrasyon-güvenli.
  const state = useMockStore().quickAccess;

  function toggle(key: QuickKey, next: boolean) {
    mutate((s) => {
      s.quickAccess = { ...s.quickAccess, [key]: next };
    });
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {BOXES.map((box) => (
        <div
          key={box.key}
          className={cn(
            "flex flex-col gap-3 rounded-[var(--card-radius)] border p-4",
            "transition-colors duration-200 ease-[var(--ease-standard)]",
            state[box.key]
              ? "border-border-maroon bg-surface-2"
              : "border-border-subtle bg-surface-2 opacity-70",
          )}
        >
          <h3 className="text-sm font-semibold text-white">{t(box.labelKey)}</h3>

          <Toggle
            checked={state[box.key]}
            onChange={(next) => toggle(box.key, next)}
            label={state[box.key] ? t("common.enabled") : t("common.disabled")}
          />

          <div className="mt-auto flex flex-col gap-1.5 text-xs">
            <Link
              href={box.href}
              className="inline-flex items-center gap-1.5 text-link transition-colors hover:text-link-hover"
            >
              <Settings2 className="size-3" aria-hidden />
              {t("start.quickAccessSettings")}
            </Link>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 self-start text-muted transition-colors hover:text-white"
            >
              <Keyboard className="size-3" aria-hidden />
              {t("start.quickAccessShortcut")}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
