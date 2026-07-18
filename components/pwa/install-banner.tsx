"use client";

import { Download, Share, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { APP_NAME, cn } from "@/lib/utils";

/**
 * PWA "Ana ekrana ekle" banner'ı.
 *
 * Sayfa açılınca (uygun koşullarda) alttan açılır bir banner ile kullanıcıya sorar:
 *  - Android / masaüstü Chromium: `beforeinstallprompt` yakalanır → "Yükle" gerçek
 *    tarayıcı yükleme diyaloğunu açar.
 *  - iOS Safari: `beforeinstallprompt` yoktur → manuel "Paylaş → Ana Ekrana Ekle"
 *    talimatı gösterilir.
 *
 * Görünmez olduğu durumlar: uygulama zaten yüklü (standalone) · son 14 günde kapatılmış.
 */

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  prompt: () => Promise<void>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const DISMISS_KEY = "livekit.pwa.dismissedAt";
const SNOOZE_MS = 14 * 24 * 60 * 60 * 1000; // Kapatınca 14 gün tekrar sorma.

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function detectIos(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const iOSDevice = /iphone|ipad|ipod/i.test(ua);
  // iPadOS 13+ masaüstü UA döndürür; dokunmatik + MacIntel ile ayırt edilir.
  const iPadOS = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return iOSDevice || iPadOS;
}

function recentlyDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    return raw ? Date.now() - Number(raw) < SNOOZE_MS : false;
  } catch {
    return false;
  }
}

export function InstallBanner() {
  const t = useTranslations();
  const { show } = useToast();

  const [visible, setVisible] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const deferredRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // İlk boyada gizli başlar → SSR/hydration uyuşmazlığı yok.
    if (isStandalone() || recentlyDismissed()) return;

    const ios = detectIos();

    // Android / masaüstü Chromium — tarayıcı yükleme koşulunu sağladığında tetiklenir.
    const onBeforeInstall = (e: Event) => {
      e.preventDefault(); // Tarayıcının kendi mini-infobar'ını bastır; biz soracağız.
      deferredRef.current = e as BeforeInstallPromptEvent;
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    // Yükleme tamamlanınca banner'ı kapat.
    const onInstalled = () => {
      setVisible(false);
      deferredRef.current = null;
      try {
        localStorage.setItem(DISMISS_KEY, String(Date.now()));
      } catch {
        /* yoksay */
      }
      show(t("pwa.installed"), "success");
    };
    window.addEventListener("appinstalled", onInstalled);

    // iOS'ta beforeinstallprompt yok → sayfa oturunca kısa gecikmeyle sor.
    // isIos yalnız burada set edilir (setTimeout içinde, effect gövdesinde senkron değil);
    // Android yolunda isIos varsayılan false kalır.
    let iosTimer: ReturnType<typeof setTimeout> | undefined;
    if (ios) {
      iosTimer = setTimeout(() => {
        setIsIos(true);
        setVisible(true);
      }, 1200);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      if (iosTimer) clearTimeout(iosTimer);
    };
  }, [show, t]);

  const dismiss = useCallback(() => {
    setVisible(false);
    setShowIosHelp(false);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* yoksay */
    }
  }, []);

  const handleInstall = useCallback(async () => {
    const deferred = deferredRef.current;
    if (deferred) {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      deferredRef.current = null;
      if (outcome === "accepted") {
        setVisible(false);
      } else {
        dismiss();
      }
      return;
    }
    // iOS: yerleşik diyalog yok → manuel talimatı aç.
    if (isIos) setShowIosHelp((v) => !v);
  }, [isIos, dismiss]);

  if (!visible) return null;

  const monogram = APP_NAME.slice(0, 2).toUpperCase();

  return (
    <div
      role="dialog"
      aria-label={t("pwa.title", { app: APP_NAME })}
      className={cn(
        "animate-pwa-slide-up fixed bottom-4 left-1/2 z-[9998] w-[calc(100%-2rem)] max-w-md -translate-x-1/2",
        "rounded-[var(--card-radius)] border border-border-maroon bg-surface-2 p-4 shadow-2xl",
      )}
    >
      <div className="flex items-start gap-3">
        {/* Uygulama ikonu — topbar logosuyla tutarlı (#D43555 + monogram). */}
        <div
          aria-hidden
          className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-bold text-white"
        >
          {monogram}
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-white">
            {t("pwa.title", { app: APP_NAME })}
          </h3>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-2">
            {t("pwa.body", { app: APP_NAME })}
          </p>
        </div>

        <button
          type="button"
          onClick={dismiss}
          aria-label={t("pwa.dismiss")}
          className="-mr-1 -mt-1 shrink-0 rounded p-1 text-muted transition-colors hover:bg-white/8 hover:text-white"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>

      {/* iOS manuel talimatı */}
      {isIos && showIosHelp && (
        <div className="mt-3 rounded-lg border border-border-soft bg-surface-3 p-3 text-xs text-muted-2">
          <p className="mb-1 flex items-center gap-1.5 font-medium text-white">
            <Share className="size-3.5 text-link" aria-hidden />
            {t("pwa.iosTitle")}
          </p>
          <p className="leading-relaxed">{t("pwa.iosBody")}</p>
        </div>
      )}

      <div className="mt-3 flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={dismiss}>
          {t("pwa.later")}
        </Button>
        <Button size="sm" onClick={handleInstall}>
          {isIos ? <Share className="size-3.5" aria-hidden /> : <Download className="size-3.5" aria-hidden />}
          {t("pwa.install")}
        </Button>
      </div>

      {/* Alttan açılma animasyonu — prefers-reduced-motion globals.css'te devre dışı. */}
      <style>{`
        @keyframes pwaSlideUp {
          from { transform: translate(-50%, 24px); opacity: 0; }
          to { transform: translate(-50%, 0); opacity: 1; }
        }
        .animate-pwa-slide-up { animation: pwaSlideUp 0.3s var(--ease-standard); }
      `}</style>
    </div>
  );
}
