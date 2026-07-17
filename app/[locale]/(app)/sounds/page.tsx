import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SectionNavigator } from "@/components/layout/section-navigator";
import {
  SoundsGrid,
  SoundsHeader,
  SoundsSettings,
  SoundsSetupWarning,
} from "@/components/modules/sounds/sounds-sections";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return { title: t("sounds.title") };
}

/**
 * Sesli Uyarılar (`sounds`) — PRD §5: ses tetikleyicileri yönetimi.
 * Orijinal SPA'daki data-pageid="sounds" sayfasının birebir karşılığı.
 */
export default async function SoundsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const sections = [
    { id: "section-sounds", label: t("sounds.sections.sounds") },
    { id: "section-settings", label: t("sounds.sections.settings") },
  ];

  return (
    <div className="flex gap-6 p-6">
      <div className="flex flex-1 flex-col items-center gap-4">
        <SoundsHeader />
        <SoundsSetupWarning />
        <SoundsGrid />
        <SoundsSettings />
      </div>

      <SectionNavigator sections={sections} />
    </div>
  );
}
