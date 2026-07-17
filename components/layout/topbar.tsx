"use client";

import {
  Bell,
  ChevronDown,
  ChevronsUpDown,
  CircleHelp,
  Coins,
  Link2,
  Search,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { useApp } from "@/components/providers/app-provider";
import { Button } from "@/components/ui/button";
import { Link, usePathname, useRouter } from "@/lib/i18n/navigation";
import { locales, type Locale } from "@/lib/i18n/routing";
import { SECTION_COUNTS, moduleForPath } from "@/lib/nav";
import { APP_NAME, cn } from "@/lib/utils";
import { SearchOverlay } from "./search-overlay";

/**
 * Topbar — PRD §4.4: 54px yükseklik, bg-white/10 backdrop-blur-lg cam efekti,
 * SVG köşe kesikleri (sol/sağ), px-4 py-2, soldan sağa 9 bileşen,
 * her grup arası dikey ayraç h-6 w-px bg-white/8.
 */

function Divider() {
  return <span aria-hidden className="h-6 w-px bg-white/8" />;
}

/** Dışarı tıklayınca kapanan dropdown kabuğu. */
function Dropdown({
  open,
  onClose,
  children,
  align = "right",
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      className={cn(
        "absolute top-[calc(100%+8px)] z-50 w-80 rounded-[var(--card-radius)]",
        "border border-border-soft bg-surface-1 shadow-2xl",
        align === "right" ? "right-0" : "left-0",
      )}
    >
      {children}
    </div>
  );
}

export function Topbar() {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const { connection, connect, disconnect, backend } = useApp();

  const [searchOpen, setSearchOpen] = useState(false);
  const [inbox, setInbox] = useState(false);
  const [help, setHelp] = useState(false);
  const [account, setAccount] = useState(false);
  const [inboxTab, setInboxTab] = useState<"all" | "features" | "announcements">("all");

  const currentModule = moduleForPath(pathname);
  const sectionCount = currentModule ? SECTION_COUNTS[currentModule.pageId] : undefined;
  const unread = 2;
  const isLive = connection === "live";

  // ⌘K / Ctrl+K — PRD §4.4.2.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  async function handleConnectClick() {
    if (isLive) {
      await disconnect();
      return;
    }
    const settings = await backend.settings.get();
    const username = settings.tiktok?.username;
    // Kullanıcı adı yoksa bağlanma akışı Kurmak sayfasında başlar (PRD §5.2.1).
    if (!username) {
      router.push("/setup");
      return;
    }
    await connect(username);
  }

  return (
    <>
      <header
        className={cn(
          "relative flex h-[var(--topbar-h)] shrink-0 items-center gap-3 px-4 py-2",
          "bg-white/10 backdrop-blur-lg",
        )}
        style={{
          // Sol kırmızı degrade — PRD §4.1 --topbar-glow.
          backgroundImage:
            "linear-gradient(to right, var(--topbar-glow) 0%, transparent 40%)",
        }}
      >
        {/* SVG köşe kesikleri — PRD §4.4 (sol/sağ). */}
        <svg
          aria-hidden
          className="pointer-events-none absolute bottom-0 left-0 h-2 w-2 text-background"
          viewBox="0 0 8 8"
        >
          <path d="M0 0 L8 0 L8 8 Q8 0 0 0 Z" fill="currentColor" transform="rotate(90 4 4)" />
        </svg>
        <svg
          aria-hidden
          className="pointer-events-none absolute right-0 bottom-0 h-2 w-2 text-background"
          viewBox="0 0 8 8"
        >
          <path d="M0 0 L8 0 L8 8 Q8 0 0 0 Z" fill="currentColor" />
        </svg>

        {/* 1 — Logo */}
        <Link
          href="/start"
          aria-label={t("topbar.logoAlt", { app: APP_NAME })}
          className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white transition-transform duration-200 ease-[var(--ease-standard)] hover:scale-105"
        >
          {APP_NAME.slice(0, 2).toUpperCase()}
        </Link>

        <Divider />

        {/* 2 — Arama tetikleyici (15rem, ⌘K çipi) */}
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="flex h-8 w-60 items-center gap-2 rounded-lg bg-surface-2 px-3 text-sm text-muted transition-colors duration-200 ease-[var(--ease-standard)] hover:bg-surface-3"
        >
          <Search className="size-3.5 shrink-0" aria-hidden />
          <span className="flex-1 text-left">{t("topbar.searchPlaceholder")}</span>
          <kbd className="rounded border border-border-soft px-1.5 py-0.5 text-[10px]">
            {t("topbar.searchShortcut")}
          </kbd>
        </button>

        {/* 3 — Breadcrumb (xl+) */}
        {currentModule && (
          <div className="hidden items-center gap-2 text-sm text-muted-2 xl:flex">
            <Divider />
            <span className="text-white">{t(currentModule.labelKey)}</span>
            {sectionCount !== undefined && (
              <span className="rounded bg-white/8 px-1.5 py-0.5 text-xs text-muted">
                {sectionCount}
              </span>
            )}
          </div>
        )}

        <div className="flex-1" />

        {/* 4 — Bağlan butonu */}
        <Button
          raised
          size="sm"
          onClick={handleConnectClick}
          disabled={connection === "connecting"}
          className="shrink-0"
        >
          <Link2 className="size-3.5" aria-hidden />
          {connection === "connecting"
            ? t("topbar.connecting")
            : isLive
              ? t("topbar.disconnect")
              : t("topbar.connect")}
        </Button>

        <Divider />

        {/* 5 — Bildirim zili + rozet */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setInbox((o) => !o)}
            aria-label={t("topbar.notificationsUnread", { count: unread })}
            aria-expanded={inbox}
            className="relative flex size-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-white/8 hover:text-white"
          >
            <Bell className="size-4" aria-hidden />
            {unread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-accent text-[10px] font-medium text-white">
                {unread}
              </span>
            )}
          </button>

          <Dropdown open={inbox} onClose={() => setInbox(false)}>
            <div className="border-b border-border-subtle px-4 py-3">
              <h3 className="mb-2 text-sm font-semibold text-white">{t("topbar.inbox")}</h3>
              <div className="flex gap-1">
                {(["all", "features", "announcements"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setInboxTab(tab)}
                    className={cn(
                      "rounded px-2 py-1 text-xs transition-colors",
                      inboxTab === tab
                        ? "bg-accent text-white"
                        : "text-muted hover:text-white",
                    )}
                  >
                    {t(
                      tab === "all"
                        ? "topbar.inboxAll"
                        : tab === "features"
                          ? "topbar.inboxFeatures"
                          : "topbar.inboxAnnouncements",
                    )}
                  </button>
                ))}
              </div>
            </div>
            <div className="px-4 py-8 text-center text-sm text-muted">
              {t("topbar.inboxEmpty")}
            </div>
            <div className="flex justify-between border-t border-border-subtle px-4 py-2">
              <button type="button" className="text-xs text-link hover:text-link-hover">
                {t("topbar.inboxMarkAllRead")}
              </button>
            </div>
          </Dropdown>
        </div>

        {/* 6 — Yardım */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setHelp((o) => !o)}
            aria-label={t("topbar.help")}
            aria-expanded={help}
            className="flex size-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-white/8 hover:text-white"
          >
            <CircleHelp className="size-4" aria-hidden />
          </button>

          <Dropdown open={help} onClose={() => setHelp(false)}>
            <div className="px-4 py-3">
              <h3 className="mb-3 text-sm font-semibold text-white">
                {t("topbar.helpTitle")}
              </h3>
              <ul className="flex flex-col gap-2 text-sm">
                {[
                  "actionsandevents.title",
                  "start.quickAccessSounds",
                  "start.quickAccessTts",
                ].map((key) => (
                  <li key={key} className="flex items-center justify-between gap-2">
                    <span className="text-muted-2">{t(key)}</span>
                    <span className="text-xs text-link">{t("topbar.helpWatchOnYoutube")}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="border-t border-border-subtle px-4 py-2">
              <span className="text-xs text-link">{t("topbar.helpGoToBlog")}</span>
            </div>
          </Dropdown>
        </div>

        <Divider />

        {/* 7 — Stream Profile switcher */}
        <button
          type="button"
          aria-label={t("topbar.streamProfileSwitch")}
          className="flex h-8 items-center gap-2 rounded-lg px-2 text-sm text-muted-2 transition-colors hover:bg-white/8 hover:text-white"
        >
          <span aria-hidden>🌹</span>
          <span className="hidden lg:inline">{t("topbar.streamProfile", { n: 1 })}</span>
          <ChevronsUpDown className="size-3.5" aria-hidden />
        </button>

        {/* 8 — Kredi bakiyesi */}
        <div
          aria-label={t("topbar.credits")}
          className="flex h-7 items-center gap-1.5 rounded-lg border border-[#D4355580] bg-[#D435554D] px-2 text-sm text-white"
        >
          <Coins className="size-3.5" aria-hidden />
          <span>0</span>
        </div>

        <Divider />

        {/* 9 — Hesap menüsü */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setAccount((o) => !o)}
            aria-expanded={account}
            className="flex h-9 items-center gap-2 rounded-lg px-1.5 transition-colors hover:bg-white/8"
          >
            <span
              aria-hidden
              className="flex size-6 items-center justify-center rounded-full bg-surface-4 text-xs"
            >
              👤
            </span>
            <span className="hidden flex-col items-start leading-tight md:flex">
              <span className="text-xs text-white">{t("topbar.accountGuest")}</span>
              <span
                className="text-[10px]"
                style={{ color: isLive ? undefined : "var(--accent)" }}
              >
                {isLive ? t("topbar.connected") : t("topbar.accountDisconnected")}
              </span>
            </span>
            <ChevronDown className="size-3.5 text-muted" aria-hidden />
          </button>

          <Dropdown open={account} onClose={() => setAccount(false)}>
            <div className="p-2">
              <Link
                href="/setup"
                onClick={() => setAccount(false)}
                className="block rounded px-3 py-2 text-sm text-muted-2 hover:bg-white/8 hover:text-white"
              >
                {t("setup.sections.account")}
              </Link>

              {/* Dil seçici — PRD §11 (kullanıcı tercihi kalıcı). */}
              <div className="mt-2 border-t border-border-subtle pt-2">
                <p className="px-3 pb-1 text-xs text-muted">{t("locale.switch")}</p>
                {locales.map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => {
                      router.replace(pathname, { locale: l });
                      setAccount(false);
                    }}
                    className={cn(
                      "block w-full rounded px-3 py-1.5 text-left text-sm",
                      l === locale
                        ? "bg-accent text-white"
                        : "text-muted-2 hover:bg-white/8 hover:text-white",
                    )}
                  >
                    {t(`locale.${l}`)}
                  </button>
                ))}
              </div>
            </div>
          </Dropdown>
        </div>
      </header>

      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
