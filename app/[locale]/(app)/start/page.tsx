import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SectionNavigator } from "@/components/layout/section-navigator";
import { ConnectionCard, WelcomeCard } from "@/components/modules/start/connection-card";
import { QuickAccess } from "@/components/modules/start/quick-access";
import {
  AgenciesSection,
  DesktopPromo,
  HowToSection,
  NewsSection,
  ProPromo,
  TiktokChannelSection,
} from "@/components/modules/start/sections";
import { Card, CardTitle } from "@/components/ui/card";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "start" });
  return { title: t("title") };
}

/**
 * Başlangıç (`start`) — Ana Panel. PRD §5.1: 10 sıralı bölüm + bölüm gezgini.
 */
export default async function StartPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const sections = [
    { id: "section-desktop", label: t("start.sections.desktop") },
    { id: "section-welcome", label: t("start.sections.welcome") },
    { id: "section-connection", label: t("start.sections.connection") },
    { id: "section-quick-access", label: t("start.sections.quickAccess") },
    { id: "section-agencies", label: t("start.sections.agencies") },
    { id: "section-tiktok-channel", label: t("start.sections.tiktokChannel") },
    { id: "section-news", label: t("start.sections.news") },
    { id: "section-pro", label: t("start.sections.pro") },
    { id: "section-how-to", label: t("start.sections.howTo") },
    { id: "section-faq", label: t("start.sections.faq") },
  ];

  return (
    <div className="flex gap-6 p-6">
      <div className="flex flex-1 flex-col items-center gap-4">
        <DesktopPromo />
        <WelcomeCard />
        <ConnectionCard />

        <Card id="section-quick-access">
          <CardTitle>{t("start.quickAccessTitle")}</CardTitle>
          <div className="mt-4">
            <QuickAccess />
          </div>
        </Card>

        <AgenciesSection />
        <TiktokChannelSection />
        <NewsSection />
        <ProPromo />
        <HowToSection />
      </div>

      <SectionNavigator sections={sections} />
    </div>
  );
}
