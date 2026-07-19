"use client";

import {
  ArrowRight,
  Bell,
  LayoutGrid,
  MessageSquare,
  Search,
  ShieldCheck,
  Trophy,
  Volume2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type { ComponentType } from "react";
import { LiveKitMark } from "@/components/brand/livekit-mark";
import { Link, usePathname } from "@/lib/i18n/navigation";
import { localeLabels, locales } from "@/lib/i18n/routing";
import { APP_NAME } from "@/lib/utils";

/**
 * Ana sayfa (tanıtım) — TikTok marka teması.
 *
 * Sağ üstte "Giriş yap" butonu login ekranına (`/login`) götürür. Sistem
 * tanıtımı: hero + canlı önizleme + özellikler + istatistik + CTA. fikoai.de
 * yalnız en altta, link olarak geçer. Mobil + tablet uyumlu.
 */
export function HomePage() {
  const t = useTranslations();

  return (
    <div className="relative z-10 flex min-h-full flex-col">
      <Header />
      <main className="flex-1">
        <Hero />
        <Features />
        <Stats />
        <CtaBand />
      </main>
      <Footer />
    </div>
  );

  // -- alt bileşenler ------------------------------------------------------

  function Header() {
    return (
      <header className="sticky top-0 z-30 border-b border-[var(--tt-border)] bg-[var(--tt-bg)]/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <LiveKitMark className="size-9" />
            <span className="tt-glitch text-lg font-extrabold tracking-tight text-[var(--tt-ink)]">
              {APP_NAME}
            </span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-4">
            <LangSwitch />
            <Link
              href="/login"
              className="inline-flex h-10 items-center gap-2 rounded-full bg-[var(--tt-red)] px-5 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(254,44,85,0.7)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[var(--tt-red-hover)] active:translate-y-0"
            >
              {t("home.nav.signIn")}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </div>
      </header>
    );
  }

  function LangSwitch() {
    const pathname = usePathname();
    return (
      <nav aria-label="Language" className="hidden items-center gap-1 md:flex">
        {locales.map((l) => (
          <Link
            key={l}
            href={pathname}
            locale={l}
            title={localeLabels[l]}
            className="rounded-md px-2 py-1 text-xs font-semibold uppercase text-[var(--tt-muted)] transition-colors hover:bg-white/5 hover:text-[var(--tt-ink)]"
          >
            {l}
          </Link>
        ))}
      </nav>
    );
  }

  function Hero() {
    return (
      <section className="mx-auto w-full max-w-6xl px-5 pb-16 pt-12 sm:px-8 sm:pt-16 lg:pb-24">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          <div className="tt-rise flex flex-col items-start">
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--tt-border-strong)] bg-white/5 px-3.5 py-1.5 text-xs font-medium text-[var(--tt-ink-soft)]">
              <span className="size-1.5 rounded-full bg-[var(--tt-red)] tt-pulse" />
              {t("home.hero.badge")}
            </span>

            <h1 className="mt-6 text-4xl font-extrabold leading-[1.05] tracking-tight text-[var(--tt-ink)] sm:text-6xl">
              {t("home.hero.titleLead")}{" "}
              <span className="tt-gradient-text">{t("home.hero.titleAccent")}</span>{" "}
              {t("home.hero.titleTail")}
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-relaxed text-[var(--tt-muted)]">
              {t("home.hero.subtitle")}
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/login"
                className="inline-flex h-13 items-center justify-center gap-2 rounded-full bg-[var(--tt-red)] px-7 py-3.5 text-[15px] font-semibold text-white shadow-[0_12px_32px_-10px_rgba(254,44,85,0.75)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[var(--tt-red-hover)] active:translate-y-0"
              >
                {t("home.hero.ctaSignIn")}
                <ArrowRight className="size-4" aria-hidden />
              </Link>
              <a
                href="#features"
                className="inline-flex h-13 items-center justify-center rounded-full border border-[var(--tt-border-strong)] bg-white/[0.04] px-6 py-3.5 text-[15px] font-medium text-[var(--tt-ink-soft)] transition-colors hover:bg-white/[0.08]"
              >
                {t("home.hero.ctaExplore")}
              </a>
            </div>

            <p className="mt-5 flex items-center gap-2 text-sm text-[var(--tt-muted)]">
              <ShieldCheck className="size-4 text-[var(--tt-cyan)]" aria-hidden />
              {t("home.hero.trust")}
            </p>
          </div>

          <div className="tt-rise" style={{ animationDelay: "120ms" }}>
            <PreviewCard />
          </div>
        </div>
      </section>
    );
  }

  function PreviewCard() {
    return (
      <div className="tt-float relative mx-auto w-full max-w-md">
        <div
          aria-hidden
          className="absolute -inset-4 -z-10 rounded-[32px] opacity-70 blur-2xl"
          style={{
            background:
              "radial-gradient(60% 60% at 30% 20%, rgba(37,244,238,0.35), transparent 60%), radial-gradient(60% 60% at 80% 90%, rgba(254,44,85,0.4), transparent 60%)",
          }}
        />
        <div className="overflow-hidden rounded-[22px] border border-[var(--tt-border-strong)] bg-[var(--tt-solid)] shadow-[var(--tt-shadow)]">
          {/* Başlık çubuğu */}
          <div className="flex items-center justify-between border-b border-[var(--tt-border)] bg-white/[0.03] px-4 py-3">
            <div className="flex items-center gap-2">
              <LiveKitMark className="size-6" />
              <span className="text-sm font-bold text-white">{APP_NAME}</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--tt-red)] px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                <span className="size-1.5 rounded-full bg-white" />
                {t("landing.preview.live")}
              </span>
            </div>
            <div className="flex items-center gap-2.5 text-[var(--tt-muted)]">
              <Search className="size-4" aria-hidden />
              <Bell className="size-4" aria-hidden />
            </div>
          </div>

          <div className="flex flex-col gap-3 p-4">
            {/* Alert toast */}
            <div className="flex items-center gap-3 rounded-xl border border-[var(--tt-cyan)]/25 bg-white/[0.03] p-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-[var(--tt-cyan)]/15 text-[var(--tt-cyan)]">
                <Trophy className="size-5" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">
                  {t("landing.preview.alertTitle")}
                </p>
                <p className="truncate text-xs text-[var(--tt-muted)]">
                  {t("landing.preview.alertBody")}
                </p>
              </div>
              <Volume2 className="size-4 text-[var(--tt-cyan)]" aria-hidden />
            </div>

            {/* TTS dalga formu */}
            <div className="rounded-xl border border-[var(--tt-border)] bg-white/[0.03] p-3">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="font-medium text-[var(--tt-ink-soft)]">
                  {t("landing.preview.connectTitle")}
                </span>
                <span className="text-[var(--tt-muted-2)]">00:07</span>
              </div>
              <div className="flex h-8 items-end gap-1">
                {[6, 12, 20, 14, 26, 18, 30, 22, 12, 24, 16, 28, 20, 10, 18, 26, 14, 8].map(
                  (h, i) => (
                    <span
                      key={i}
                      className="flex-1 rounded-full"
                      style={{
                        height: `${h}px`,
                        background:
                          "linear-gradient(180deg, var(--tt-cyan), var(--tt-red))",
                        opacity: 0.85,
                      }}
                    />
                  ),
                )}
              </div>
            </div>

            {/* Hedef çubuğu */}
            <div className="rounded-xl border border-[var(--tt-border)] bg-white/[0.03] p-3">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="font-medium text-[var(--tt-ink-soft)]">
                  {t("landing.preview.goal")}
                </span>
                <span className="font-bold text-[var(--tt-cyan)]">720 / 1000</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: "72%",
                    background: "linear-gradient(90deg, var(--tt-cyan), var(--tt-red))",
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function Features() {
    const items: {
      icon: ComponentType<{ className?: string }>;
      key: "alerts" | "overlays" | "chatbot" | "points";
    }[] = [
      { icon: Volume2, key: "alerts" },
      { icon: LayoutGrid, key: "overlays" },
      { icon: MessageSquare, key: "chatbot" },
      { icon: Trophy, key: "points" },
    ];
    return (
      <section id="features" className="border-t border-[var(--tt-border)]">
        <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 lg:py-24">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-extrabold tracking-tight text-[var(--tt-ink)] sm:text-4xl">
              {t("home.features.title")}
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-[var(--tt-muted)]">
              {t("home.features.subtitle")}
            </p>
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {items.map(({ icon: Icon, key }) => (
              <article
                key={key}
                className="group flex flex-col rounded-2xl border border-[var(--tt-border)] bg-white/[0.03] p-6 transition-all duration-200 hover:-translate-y-1 hover:border-[var(--tt-cyan)]/40 hover:bg-white/[0.05]"
              >
                <div className="flex size-12 items-center justify-center rounded-xl bg-white/5 text-[var(--tt-cyan)] transition-colors group-hover:bg-[var(--tt-cyan)]/15">
                  <Icon className="size-6" />
                </div>
                <h3 className="mt-5 text-lg font-bold text-[var(--tt-ink)]">
                  {t(`home.features.${key}.title`)}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--tt-muted)]">
                  {t(`home.features.${key}.desc`)}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>
    );
  }

  function Stats() {
    const stats: { value: string; key: "actions" | "triggers" | "screens" | "languages" }[] = [
      { value: "20+", key: "actions" },
      { value: "15", key: "triggers" },
      { value: "8", key: "screens" },
      { value: "4", key: "languages" },
    ];
    return (
      <section className="border-t border-[var(--tt-border)] bg-white/[0.02]">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-6 px-5 py-12 sm:px-8 lg:grid-cols-4">
          {stats.map(({ value, key }) => (
            <div key={key} className="flex flex-col items-center text-center">
              <span className="tt-gradient-text text-4xl font-extrabold sm:text-5xl">{value}</span>
              <span className="mt-1 text-sm text-[var(--tt-muted)]">{t(`home.stats.${key}`)}</span>
            </div>
          ))}
        </div>
      </section>
    );
  }

  function CtaBand() {
    return (
      <section className="border-t border-[var(--tt-border)]">
        <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8">
          <div className="relative overflow-hidden rounded-[28px] border border-[var(--tt-border-strong)] bg-[var(--tt-solid)] px-8 py-14 text-center sm:px-16">
            <div
              aria-hidden
              className="absolute inset-0 -z-0 opacity-80"
              style={{
                background:
                  "radial-gradient(50% 80% at 15% 10%, rgba(37,244,238,0.22), transparent 60%), radial-gradient(60% 90% at 90% 100%, rgba(254,44,85,0.28), transparent 60%)",
              }}
            />
            <div className="relative z-10 mx-auto flex max-w-xl flex-col items-center">
              <LiveKitMark className="size-12" />
              <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                {t("home.cta.title")}
              </h2>
              <p className="mt-3 text-base leading-relaxed text-[var(--tt-ink-soft)]/80">
                {t("home.cta.subtitle")}
              </p>
              <Link
                href="/login"
                className="mt-8 inline-flex h-13 items-center justify-center gap-2 rounded-full bg-[var(--tt-red)] px-7 py-3.5 text-[15px] font-semibold text-white shadow-[0_12px_32px_-10px_rgba(254,44,85,0.8)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[var(--tt-red-hover)] active:translate-y-0"
              >
                {t("home.cta.button")}
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  function Footer() {
    return (
      <footer className="border-t border-[var(--tt-border)] bg-black/30">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-5 py-12 sm:px-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-xs">
            <div className="flex items-center gap-2.5">
              <LiveKitMark className="size-8" />
              <span className="tt-glitch text-base font-extrabold text-[var(--tt-ink)]">
                {APP_NAME}
              </span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-[var(--tt-muted)]">
              {t("home.footer.tagline")}
            </p>
          </div>

          <div className="flex flex-col gap-2 text-sm text-[var(--tt-muted)]">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--tt-ink-soft)]">
              {t("home.footer.legal")}
            </span>
            <a href="#" className="transition-colors hover:text-[var(--tt-cyan)]">
              {t("auth.tos")}
            </a>
            <a href="#" className="transition-colors hover:text-[var(--tt-cyan)]">
              {t("auth.privacy")}
            </a>
          </div>
        </div>

        <div className="border-t border-[var(--tt-border)]">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-2 px-5 py-5 text-xs text-[var(--tt-muted-2)] sm:flex-row sm:px-8">
            <span>© 2026 {APP_NAME}</span>
            <span>
              {t.rich("landing.footer.product", {
                link: (chunks) => (
                  <a
                    href="https://fikoai.de"
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-[var(--tt-ink-soft)] underline-offset-4 transition-colors hover:text-[var(--tt-cyan)] hover:underline"
                  >
                    {chunks}
                  </a>
                ),
              })}
            </span>
          </div>
        </div>
      </footer>
    );
  }
}
