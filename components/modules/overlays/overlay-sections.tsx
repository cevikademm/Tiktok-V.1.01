import {
  AlertTriangle,
  Copy,
  Eye,
  Globe,
  Layers,
  MessageSquare,
  MonitorPlay,
  Music,
  Settings,
  Trophy,
  Users,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { APP_NAME } from "@/lib/utils";

/**
 * Kaplama Galerisi bölümleri — PRD §5: obsoverlays modülü.
 * Server Component'ler (CLAUDE.md §5.1).
 */

/* Uyarı şeridi — bağlantı yok ise gösterilir. */
export async function SetupWarning() {
  const t = await getTranslations();
  return (
    <div className="flex w-full max-w-[var(--card-w)] items-center gap-3 rounded-[var(--card-radius)] border border-error/40 bg-error/10 px-4 py-3">
      <AlertTriangle className="size-4 shrink-0 text-error" aria-hidden />
      <p className="flex-1 text-sm text-error">{t("overlays.setupWarning")}</p>
    </div>
  );
}

/* Dünya Kupası bölümü — 3 overlay kartı. */
export async function WorldCupSection() {
  const t = await getTranslations();

  const overlays = [
    { key: "ticker", icon: Globe },
    { key: "schedule", icon: Trophy },
    { key: "standings", icon: Layers },
  ] as const;

  return (
    <Card id="section-worldcup" featured>
      <div className="mb-4 overflow-hidden rounded-lg bg-[linear-gradient(135deg,#1a472a_0%,#2d6b3f_100%)] p-5">
        <h3 className="text-lg font-bold text-white">
          {t("overlays.worldCup.title")}
        </h3>
        <p className="mt-1 text-sm text-white/70">
          {t("overlays.worldCup.subtitle")}
        </p>
      </div>
      <div className="flex flex-col gap-4">
        {overlays.map(({ key, icon: Icon }) => (
          <OverlayWidget
            key={key}
            title={t(`overlays.worldCup.${key}`)}
            description={t(`overlays.worldCup.${key}Desc`)}
            icon={<Icon className="size-5 text-primary" aria-hidden />}
          />
        ))}
      </div>
    </Card>
  );
}

/* Uyarı katmanları bölümü (Alert Box, Chat Overlay). */
export async function AlertOverlaysSection() {
  const t = await getTranslations();
  return (
    <Card id="section-alerts">
      <CardTitle>{t("overlays.sections.alerts")}</CardTitle>
      <div className="mt-4 flex flex-col gap-4">
        <OverlayWidget
          title={t("overlays.widgets.alertBox")}
          description={t("overlays.widgets.alertBoxDesc")}
          icon={<MonitorPlay className="size-5 text-primary" aria-hidden />}
        />
        <OverlayWidget
          title={t("overlays.widgets.chatOverlay")}
          description={t("overlays.widgets.chatOverlayDesc")}
          icon={<MessageSquare className="size-5 text-primary" aria-hidden />}
        />
        <OverlayWidget
          title={t("overlays.widgets.commandInfo")}
          description={t("overlays.widgets.commandInfoDesc")}
          icon={<Eye className="size-5 text-primary" aria-hidden />}
        />
      </div>
    </Card>
  );
}

/* Bilgi katmanları bölümü (Goal, Gift Counter, Follow Counter, Last Followers, Leaderboard). */
export async function InfoOverlaysSection() {
  const t = await getTranslations();
  return (
    <Card id="section-info">
      <CardTitle>{t("overlays.sections.info")}</CardTitle>
      <div className="mt-4 flex flex-col gap-4">
        <OverlayWidget
          title={t("overlays.widgets.goalBar")}
          description={t("overlays.widgets.goalBarDesc")}
          icon={<Trophy className="size-5 text-primary" aria-hidden />}
        />
        <OverlayWidget
          title={t("overlays.widgets.giftCounter")}
          description={t("overlays.widgets.giftCounterDesc")}
          icon={<Layers className="size-5 text-primary" aria-hidden />}
        />
        <OverlayWidget
          title={t("overlays.widgets.followCounter")}
          description={t("overlays.widgets.followCounterDesc")}
          icon={<Users className="size-5 text-primary" aria-hidden />}
        />
        <OverlayWidget
          title={t("overlays.widgets.lastFollower")}
          description={t("overlays.widgets.lastFollowerDesc")}
          icon={<Users className="size-5 text-primary" aria-hidden />}
        />
        <OverlayWidget
          title={t("overlays.widgets.leaderboard")}
          description={t("overlays.widgets.leaderboardDesc")}
          icon={<Trophy className="size-5 text-primary" aria-hidden />}
        />
      </div>
    </Card>
  );
}

/* Etkileşimli katmanlar (Subathon Timer, Song Requests, Social Rotator). */
export async function InteractiveOverlaysSection() {
  const t = await getTranslations();
  return (
    <Card id="section-interactive">
      <CardTitle>{t("overlays.sections.interactive")}</CardTitle>
      <div className="mt-4 flex flex-col gap-4">
        <OverlayWidget
          title={t("overlays.widgets.subathonTimer")}
          description={t("overlays.widgets.subathonTimerDesc")}
          icon={<MonitorPlay className="size-5 text-primary" aria-hidden />}
        />
        <OverlayWidget
          title={t("overlays.widgets.songRequest")}
          description={t("overlays.widgets.songRequestDesc")}
          icon={<Music className="size-5 text-primary" aria-hidden />}
        />
        <OverlayWidget
          title={t("overlays.widgets.socialRotator")}
          description={t("overlays.widgets.socialRotatorDesc")}
          icon={<Globe className="size-5 text-primary" aria-hidden />}
        />
        <OverlayWidget
          title={t("overlays.widgets.graphicOverlay")}
          description={t("overlays.widgets.graphicOverlayDesc")}
          icon={<Layers className="size-5 text-primary" aria-hidden />}
        />
      </div>
    </Card>
  );
}

/**
 * Tekil overlay widget kartı — URL kopyalama + Test + Özelleştir butonlarıyla.
 * Orijinal SPA'daki her bir overlay bloğunun klon karşılığı.
 */
function OverlayWidget({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border-subtle bg-surface-2 p-4">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-3">
          {icon}
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <p className="mt-1 text-xs text-muted-2">{description}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <div className="flex-1 rounded-lg border border-border-soft bg-surface-1 px-3 py-1.5 text-xs text-muted">
          https://app.example.com/widget/...
        </div>
        <Button variant="secondary" size="sm">
          <Copy className="size-3.5" aria-hidden />
          <span className="sr-only sm:not-sr-only">URL</span>
        </Button>
        <Button variant="secondary" size="sm">
          <MonitorPlay className="size-3.5" aria-hidden />
          <span className="sr-only sm:not-sr-only">Test</span>
        </Button>
        <Button variant="ghost" size="sm">
          <Settings className="size-3.5" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
