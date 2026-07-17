import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SectionNavigator } from "@/components/layout/section-navigator";
import {
  AccountSection,
  AdvancedSection,
  DebugSection,
  ImportExportSection,
  LevelSettingsSection,
  MinecraftSection,
  ObsSection,
  PatreonSection,
  PointsSystemSection,
  ProSection,
  ResetPointsSection,
  StreamerbotSection,
  SubscriberBonusSection,
  TiktokAccountSection,
} from "@/components/modules/setup/setup-sections";
import { SETUP_SECTIONS } from "@/lib/schemas/settings";
import { APP_NAME } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "setup" });
  return { title: t("title") };
}

/**
 * Kurmak (`setup`) — 14 alt bölüm. PRD §5.2 (alt menü sırasıyla birebir).
 */
export default async function SetupPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  // Gezgin başlıkları enum'dan türer — bölüm sırası tek kaynaktan (lib/schemas/settings).
  const sections = SETUP_SECTIONS.map((key) => ({
    id: `section-${key}`,
    label: t(`setup.sections.${key}`, { app: APP_NAME }),
  }));

  return (
    <div className="flex gap-6 p-6">
      <div className="flex flex-1 flex-col items-center gap-4">
        <TiktokAccountSection />
        <PointsSystemSection />
        <SubscriberBonusSection />
        <LevelSettingsSection />
        <ObsSection />
        <StreamerbotSection />
        <MinecraftSection />
        <ResetPointsSection />
        <ProSection />
        <PatreonSection />
        <AccountSection />
        <ImportExportSection />
        <AdvancedSection />
        <DebugSection />
      </div>

      <SectionNavigator sections={sections} />
    </div>
  );
}
