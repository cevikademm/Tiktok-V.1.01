import {
  ArrowRight,
  BadgeCheck,
  Download,
  Eye,
  MessageCircle,
  Sparkles,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { APP_NAME, cn } from "@/lib/utils";

/**
 * Başlangıç sayfası bölümleri — PRD §5.1.
 * Server Component'ler (CLAUDE.md §5.1: Server Components first).
 */

/* 1 — Masaüstü uygulaması promosyon şeridi */
export async function DesktopPromo() {
  const t = await getTranslations();
  return (
    <div
      id="section-desktop"
      className="flex w-full max-w-[var(--card-w)] items-center gap-3 rounded-[var(--card-radius)] border border-border-maroon bg-surface-2 px-4 py-3"
    >
      <Download className="size-4 shrink-0 text-primary" aria-hidden />
      <p className="flex-1 text-sm text-muted-2">{t("start.desktopPromo", { app: APP_NAME })}</p>
      <span className="flex shrink-0 items-center gap-1 text-sm text-link">
        {t("start.desktopPromoCta")}
        <ArrowRight className="size-3.5" aria-hidden />
      </span>
    </div>
  );
}

/* 6 — Ajanslar bölümü */
export async function AgenciesSection() {
  const t = await getTranslations();

  const agencies = ["Nova", "Aurora", "Pulse", "Vertex", "Lumen", "Orbit"];

  return (
    <Card id="section-agencies">
      <div className="mb-4 flex items-center gap-2">
        <CardTitle className="mb-0">{t("start.agenciesTitle")}</CardTitle>
        <span className="rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium text-white uppercase">
          {t("common.new")}
        </span>
      </div>

      {/* Öne çıkan ajans kartı — banner + logo + doğrulama rozeti + istatistik şeridi */}
      <div className="overflow-hidden rounded-lg border border-border-subtle bg-surface-2">
        <div className="h-24 bg-[var(--pro-gradient)]" aria-hidden />
        <div className="p-4">
          <div className="mb-3 flex items-center gap-3">
            <div
              aria-hidden
              className="-mt-10 flex size-14 items-center justify-center rounded-xl border-2 border-surface-2 bg-surface-4 text-lg font-bold"
            >
              N
            </div>
            <div className="flex-1">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-white">
                Nova Agency
                <BadgeCheck className="size-4 text-link" aria-hidden />
                <Sparkles className="size-3.5 text-warning" aria-hidden />
              </p>
              <p className="text-xs text-muted">{t("start.agenciesFeatured")}</p>
            </div>
            <span className="text-xs text-link">{t("start.agenciesViewProfile")}</span>
          </div>

          <div className="grid grid-cols-3 gap-3 border-t border-border-subtle pt-3 text-xs">
            <div>
              <p className="mb-1 text-muted">{t("start.agenciesTopCreators")}</p>
              <div className="flex -space-x-2">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    aria-hidden
                    className="size-6 rounded-full border border-surface-2 bg-surface-4"
                  />
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1 text-muted">{t("start.agenciesFounded")}</p>
              <p className="text-white">2021</p>
            </div>
            <div>
              <p className="mb-1 text-muted">{t("start.agenciesInteractions")}</p>
              <p className="text-white">1.2M</p>
            </div>
          </div>
        </div>
      </div>

      {/* Sonsuz logo marquee */}
      <div className="mt-4 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
        <div className="flex w-max animate-marquee gap-6">
          {[...agencies, ...agencies].map((name, i) => (
            <span
              key={`${name}-${i}`}
              className="flex h-10 w-24 shrink-0 items-center justify-center rounded-lg bg-surface-3 text-xs text-muted"
            >
              {name}
            </span>
          ))}
        </div>
      </div>

      <p className="mt-4 text-sm text-link">{t("start.agenciesViewAll")}</p>
    </Card>
  );
}

/* 7 — Resmi TikTok kanalı (embed alanı, min-h 420px) */
export async function TiktokChannelSection() {
  const t = await getTranslations();
  return (
    <Card id="section-tiktok-channel">
      <CardTitle as="h3">{t("start.tiktokChannelTitle")}</CardTitle>
      <div className="mt-3 flex min-h-[420px] items-center justify-center rounded-lg border border-border-subtle bg-surface-2 text-sm text-muted">
        {t("common.loading")}
      </div>
    </Card>
  );
}

/* 8 — Haberler: "⭐ The Latest and Greatest ⭐" */
export async function NewsSection() {
  const t = await getTranslations();

  const rows = [
    "desktopApp",
    "own3dPro",
    "voicemod",
    "subEmotes",
    "teamLevels",
    "gta5",
    "minecraft",
    "keystroke",
    "countdown",
    "streamerbot",
  ] as const;

  return (
    <Card id="section-news" className="bg-news">
      <CardTitle>{t("start.newsTitle")}</CardTitle>
      <ul className="mt-3 flex flex-col divide-y divide-white/8">
        {rows.map((key) => (
          <li key={key} className="flex items-center gap-3 py-2.5 text-sm">
            <Sparkles className="size-3.5 shrink-0 text-warning" aria-hidden />
            <span className="flex-1 text-muted-2">{t(`start.news.${key}`)}</span>
            <span className="shrink-0 text-xs text-link">{t("start.newsTutorial")}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* 9 — PRO promo kutusu (gradient + shake) */
export async function ProPromo() {
  const t = await getTranslations();
  return (
    <div
      id="section-pro"
      className="w-full max-w-[var(--card-w)] animate-shake rounded-[var(--card-radius)] p-6"
      style={{ background: "var(--pro-gradient)" }}
    >
      <h2 className="text-xl font-semibold text-white">{t("start.proTitle")}</h2>
      <p className="mt-2 text-sm text-white/80">
        {t("start.proBody", { pro: `${APP_NAME} Pro` })}
      </p>
      <span className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-sm text-white">
        {t("start.proCta")}
        <ArrowRight className="size-3.5" aria-hidden />
      </span>
    </div>
  );
}

/* 10 — "How to use?" + Video Tutorials + Live Channels + FAQ + About + Contact */
export async function HowToSection() {
  const t = await getTranslations();

  const faqKeys = Array.from({ length: 13 }, (_, i) => i + 1);

  // Live Channels — 200×50px kartlar (PRD §5.1.10).
  // İzleyici sayıları sabit: SSG çıktısı deterministik olmalı, aksi halde
  // sunucu/istemci farkı hidrasyon uyuşmazlığı yaratır. Faz 2'de connector'dan gelecek.
  const channels: Array<{ name: string; viewers: number }> = [
    { name: "gamer_tr", viewers: 842 },
    { name: "dj_selin", viewers: 617 },
    { name: "chef_mert", viewers: 455 },
    { name: "art_by_ece", viewers: 389 },
    { name: "fitness_can", viewers: 274 },
    { name: "talk_burak", viewers: 203 },
    { name: "music_zeynep", viewers: 168 },
    { name: "coding_ali", viewers: 121 },
  ];

  return (
    <>
      <Card id="section-how-to">
        <CardTitle>{t("start.howToTitle", { app: APP_NAME })}</CardTitle>
        <div className="mt-3 flex aspect-video items-center justify-center rounded-lg border border-border-subtle bg-surface-2 text-sm text-muted">
          {t("common.loading")}
        </div>

        <h3 className="mt-6 mb-3 text-base font-semibold text-heading">
          {t("start.tutorialsTitle")}
        </h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="aspect-video rounded-lg border border-border-subtle bg-surface-2"
              aria-hidden
            />
          ))}
        </div>

        <h3 className="mt-6 mb-3 text-base font-semibold text-heading">
          {t("start.liveChannelsTitle", { count: 16054 })}
        </h3>
        <div className="flex flex-wrap gap-2">
          {channels.map((channel) => (
            <div
              key={channel.name}
              className="flex h-[50px] w-[200px] items-center gap-2 rounded-lg border border-border-subtle bg-surface-2 px-2"
            >
              <span aria-hidden className="size-8 shrink-0 rounded-full bg-surface-4" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs text-white">@{channel.name}</p>
                <div className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "animate-live rounded bg-tiktok px-1 text-[9px] font-bold text-white",
                    )}
                  >
                    {t("start.liveChannelsBadge")}
                  </span>
                  <span
                    className="flex items-center gap-0.5 text-[10px] text-muted"
                    aria-label={t("start.liveChannelsViewers", { count: channel.viewers })}
                  >
                    <Eye className="size-2.5" aria-hidden />
                    {channel.viewers}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-sm text-link">{t("common.showMore")}</p>
      </Card>

      {/* FAQ — 13 soru; <details> ile klavye erişilebilir akordeon */}
      <Card id="section-faq">
        <CardTitle>{t("start.faqTitle")}</CardTitle>
        <div className="mt-3 flex flex-col divide-y divide-white/8">
          {faqKeys.map((n) => (
            <details key={n} className="group py-3">
              <summary className="cursor-pointer list-none text-sm text-white transition-colors marker:hidden hover:text-link">
                {t(`start.faq.q${n}`, { app: APP_NAME })}
              </summary>
              <p className="mt-2 text-sm text-muted-2">
                {t(`start.faq.a${n}`, { app: APP_NAME, pro: `${APP_NAME} Pro` })}
              </p>
            </details>
          ))}
        </div>
      </Card>

      <Card>
        <CardTitle as="h3">{t("start.aboutTitle")}</CardTitle>
        <CardBody>{t("start.aboutBody", { app: APP_NAME })}</CardBody>
      </Card>

      <Card>
        <CardTitle as="h3">{t("start.contactTitle")}</CardTitle>
        <CardBody>{t("start.contactBody")}</CardBody>
        <span className="mt-3 inline-flex items-center gap-2 text-sm text-discord">
          <MessageCircle className="size-4" aria-hidden />
          {t("start.contactDiscord")}
        </span>
      </Card>
    </>
  );
}
