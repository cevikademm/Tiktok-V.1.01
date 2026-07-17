import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SectionNavigator } from "@/components/layout/section-navigator";
import {
  SongRequestsHeader,
  SongRequestsHistory,
  SongRequestsSettings,
  SongRequestsSetupWarning,
  SongRequestsTesting,
  SpotifyConnectionSection,
} from "@/components/modules/songrequests/songrequests-sections";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return { title: t("songRequests.title") };
}

/**
 * Spotify Şarkı İstekleri (`songrequests`) — PRD §5: Spotify entegrasyonu.
 * Orijinal SPA'daki data-pageid="songrequests" sayfasının birebir karşılığı.
 */
export default async function SongRequestsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const sections = [
    { id: "section-commands", label: t("songRequests.sections.commands") },
    { id: "section-spotify", label: t("songRequests.sections.spotify") },
    { id: "section-settings", label: t("songRequests.sections.settings") },
    { id: "section-history", label: t("songRequests.sections.history") },
    { id: "section-testing", label: t("songRequests.sections.testing") },
  ];

  return (
    <div className="flex gap-6 p-6">
      <div className="flex flex-1 flex-col items-center gap-4">
        <SongRequestsHeader />
        <SongRequestsSetupWarning />
        <SpotifyConnectionSection />
        <SongRequestsSettings />
        <SongRequestsHistory />
        <SongRequestsTesting />
      </div>

      <SectionNavigator sections={sections} />
    </div>
  );
}
