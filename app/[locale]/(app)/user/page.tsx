import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SectionNavigator } from "@/components/layout/section-navigator";
import {
  UserDataGrid,
  UserHeader,
  UserSetupWarning,
} from "@/components/modules/user/user-sections";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return { title: t("userPoints.title") };
}

/**
 * Kullanıcı ve Puanlar (`user`) — PRD §5: kullanıcı veri tablosu ve puan sistemi.
 * Orijinal SPA'daki data-pageid="user" sayfasının birebir karşılığı.
 */
export default async function UserPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const sections = [
    { id: "section-users", label: t("userPoints.sections.users") },
  ];

  return (
    <div className="flex gap-6 p-6">
      <div className="flex flex-1 flex-col items-center gap-4">
        <UserHeader />
        <UserSetupWarning />
        <UserDataGrid />
      </div>

      <SectionNavigator sections={sections} />
    </div>
  );
}
