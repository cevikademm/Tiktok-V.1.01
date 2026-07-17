import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { HataBildirimleriPanel } from "@/components/error-report/hata-bildirimleri-panel";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return { title: t("nav.errorReports") };
}

/**
 * 🐞 Hata Bildirimleri — admin paneli.
 * Görünürlük istemci tarafında `tikfinity_hata_admin` bayrağıyla kısıtlıdır
 * (proje kimlik/rol sistemi içermez); panel admin değilken kilit mesajı gösterir.
 */
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="mx-auto w-full max-w-6xl p-6">
      <HataBildirimleriPanel />
    </div>
  );
}
