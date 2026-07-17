import {
  AlertTriangle,
  Clock,
  ListMusic,
  LogOut,
  Music,
  Play,
  Plus,
  Search,
  Settings,
  SkipForward,
  Undo2,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardTitle } from "@/components/ui/card";

/**
 * Spotify Şarkı İstekleri bölümleri — PRD §5: songrequests modülü.
 * Server Component'ler (CLAUDE.md §5.1).
 */

/* Ana açıklama ve komutlar. */
export async function SongRequestsHeader() {
  const t = await getTranslations();
  return (
    <Card id="section-commands">
      <CardTitle>{t("songRequests.title")}</CardTitle>
      <CardBody>
        <p>{t("songRequests.description")}</p>
        <p className="mt-1">{t("songRequests.descriptionDetail")}</p>
        <p className="mt-1">{t("songRequests.descriptionQueue")}</p>
      </CardBody>

      <div className="mt-3 space-y-1 text-sm">
        <p className="text-xs text-link">{t("songRequests.setupOverlay")}</p>
        <p className="text-xs text-link">{t("songRequests.setupCommandInfo")}</p>
      </div>

      <div className="mt-4">
        <h3 className="mb-3 text-base font-semibold text-heading">
          {t("songRequests.commands.title")}
        </h3>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <code className="rounded bg-surface-3 px-2 py-1 text-sm font-medium text-[#4caf50]">
              {t("songRequests.commands.play")}
            </code>
            <span className="text-sm text-muted-2">
              — {t("songRequests.commands.playDesc")}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <code className="rounded bg-surface-3 px-2 py-1 text-sm font-medium text-[#4caf50]">
              {t("songRequests.commands.revoke")}
            </code>
            <span className="text-sm text-muted-2">
              — {t("songRequests.commands.revokeDesc")}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <code className="rounded bg-surface-3 px-2 py-1 text-sm font-medium text-[#4caf50]">
              {t("songRequests.commands.skip")}
            </code>
            <span className="text-sm text-muted-2">
              — {t("songRequests.commands.skipDesc")}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}

/* Uyarı şeridi. */
export async function SongRequestsSetupWarning() {
  const t = await getTranslations();
  return (
    <div className="flex w-full max-w-[var(--card-w)] items-center gap-3 rounded-[var(--card-radius)] border border-error/40 bg-error/10 px-4 py-3">
      <AlertTriangle className="size-4 shrink-0 text-error" aria-hidden />
      <p className="flex-1 text-sm text-error">{t("songRequests.setupWarning")}</p>
    </div>
  );
}

/* Spotify hesap bağlantısı bölümü. */
export async function SpotifyConnectionSection() {
  const t = await getTranslations();
  return (
    <Card id="section-spotify">
      <CardTitle as="h3">{t("songRequests.spotify.title")}</CardTitle>
      <CardBody>{t("songRequests.spotify.description")}</CardBody>

      <div className="mt-4">
        <Button size="lg" className="bg-[#1DB954] text-white hover:bg-[#1ed760]">
          <svg className="size-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
          </svg>
          {t("songRequests.spotify.connectButton")}
        </Button>
      </div>
    </Card>
  );
}

/* Ayarlar bölümü. */
export async function SongRequestsSettings() {
  const t = await getTranslations();

  const toggleSettings = [
    "playEnabled",
    "skipEnabled",
    "allowExplicit",
    "onlyFromPlaylist",
  ] as const;

  const numberSettings = [
    "playCost",
    "skipCost",
    "revokeCost",
    "maxQueueLength",
    "maxSongDuration",
  ] as const;

  return (
    <Card id="section-settings">
      <CardTitle as="h3">{t("songRequests.settings.title")}</CardTitle>

      {/* Durum göstergesi */}
      <div className="mt-3 flex items-center justify-between rounded-lg border border-border-subtle bg-surface-2 px-4 py-3">
        <span className="text-sm text-white">{t("songRequests.settings.status")}</span>
        <span className="text-sm font-medium text-error">
          {t("songRequests.settings.disconnected")}
        </span>
      </div>

      {/* Toggle ayarları */}
      <div className="mt-3 flex flex-col gap-2">
        {toggleSettings.map((key) => (
          <div
            key={key}
            className="flex items-center justify-between rounded-lg border border-border-subtle bg-surface-2 px-4 py-3"
          >
            <span className="text-sm text-white">
              {t(`songRequests.settings.${key}`)}
            </span>
            <div className="relative h-5 w-9 rounded-full bg-primary">
              <span className="absolute top-0.5 left-0.5 size-4 translate-x-4 rounded-full bg-white" />
            </div>
          </div>
        ))}
      </div>

      {/* Sayısal ayarlar */}
      <div className="mt-3 flex flex-col gap-2">
        {numberSettings.map((key) => (
          <div
            key={key}
            className="flex items-center justify-between rounded-lg border border-border-subtle bg-surface-2 px-4 py-3"
          >
            <span className="text-sm text-white">
              {t(`songRequests.settings.${key}`)}
            </span>
            <div className="h-8 w-24 rounded-lg border border-border-soft bg-surface-1 px-2 text-right text-sm text-white">
              <span className="leading-8">0</span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* Geçmiş bölümü. */
export async function SongRequestsHistory() {
  const t = await getTranslations();
  return (
    <Card id="section-history">
      <CardTitle as="h3">{t("songRequests.history.title")}</CardTitle>

      <div className="mt-4 overflow-hidden rounded-lg border border-border-subtle">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{t("songRequests.history.title")}</caption>
            <thead className="bg-surface-2 text-xs text-muted uppercase">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">{t("songRequests.history.table.time")}</th>
                <th scope="col" className="px-4 py-2.5 font-medium">{t("songRequests.history.table.user")}</th>
                <th scope="col" className="px-4 py-2.5 font-medium">{t("songRequests.history.table.song")}</th>
                <th scope="col" className="px-4 py-2.5 font-medium">{t("songRequests.history.table.artist")}</th>
                <th scope="col" className="px-4 py-2.5 font-medium">{t("songRequests.history.table.status")}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <Music className="size-8 text-muted/40" aria-hidden />
                    <p className="text-muted">{t("songRequests.history.noHistory")}</p>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}

/* Test alanı bölümü. */
export async function SongRequestsTesting() {
  const t = await getTranslations();
  return (
    <Card id="section-testing">
      <CardTitle as="h3">{t("songRequests.testing.title")}</CardTitle>
      <CardBody>{t("songRequests.testing.description")}</CardBody>

      <div className="mt-4 flex items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-border-soft bg-surface-2 px-3 py-2">
          <Search className="size-4 text-muted" aria-hidden />
          <span className="text-sm text-muted">
            {t("songRequests.testing.searchPlaceholder")}
          </span>
        </div>
        <Button size="sm">
          <Plus className="size-3.5" aria-hidden />
          {t("songRequests.testing.addToQueue")}
        </Button>
      </div>
    </Card>
  );
}
