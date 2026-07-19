import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ProfilesManager } from "@/components/modules/stream-profiles/profiles-manager";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "streamProfiles" });
  return { title: t("title") };
}

/**
 * Akış Profilleri (`stream-profiles`) — topbar profil değiştiricisinden açılır.
 * Ayrıntı: docs/sekmeler/06-akis-profilleri.md, karar kaydı: docs/ADR/0006.
 */
export default async function StreamProfilesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="p-6">
      <ProfilesManager />
    </div>
  );
}
