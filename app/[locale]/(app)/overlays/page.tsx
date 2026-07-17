import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SectionNavigator } from "@/components/layout/section-navigator";
import {
  AlertOverlaysSection,
  InfoOverlaysSection,
  InteractiveOverlaysSection,
  SetupWarning,
  WorldCupSection,
} from "@/components/modules/overlays/overlay-sections";
import { Card, CardBody, CardTitle } from "@/components/ui/card";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return { title: t("overlays.title") };
}

/**
 * Kaplama Galerisi (`obsoverlays`) — PRD §5: OBS/LIVE Studio overlay widget'ları.
 * Orijinal SPA'daki data-pageid="obsoverlays" sayfasının birebir karşılığı.
 */
export default async function OverlaysPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const sections = [
    { id: "section-description", label: t("overlays.title") },
    { id: "section-worldcup", label: t("overlays.sections.worldCup") },
    { id: "section-alerts", label: t("overlays.sections.alerts") },
    { id: "section-info", label: t("overlays.sections.info") },
    { id: "section-interactive", label: t("overlays.sections.interactive") },
  ];

  return (
    <div className="flex gap-6 p-6">
      <div className="flex flex-1 flex-col items-center gap-4">
        {/* Masaüstü uygulaması promosyonu */}
        <div className="flex w-full max-w-[var(--card-w)] items-center gap-3 rounded-[var(--card-radius)] border border-border-maroon bg-surface-2 px-4 py-3">
          <p className="flex-1 text-sm text-muted-2">
            {t("start.desktopPromo", { app: t("app.name") })}
          </p>
        </div>

        {/* Sayfa açıklaması */}
        <Card id="section-description">
          <CardTitle>{t("overlays.title")}</CardTitle>
          <CardBody>
            <p>{t("overlays.description")}</p>
            <p className="mt-2">{t("overlays.descriptionDetail")}</p>
            <p className="mt-2">{t("overlays.descriptionLiveStudio")}</p>
            <p className="mt-3 text-xs text-warning">{t("overlays.descriptionNote")}</p>
          </CardBody>
        </Card>

        <SetupWarning />
        <WorldCupSection />
        <AlertOverlaysSection />
        <InfoOverlaysSection />
        <InteractiveOverlaysSection />
      </div>

      <SectionNavigator sections={sections} />
    </div>
  );
}
