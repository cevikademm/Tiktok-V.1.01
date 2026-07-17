import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ActionsAndEventsPage } from "@/components/modules/actions/actions-page";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "actionsandevents" });
  return { title: t("title") };
}

/** Eylemler ve Etkinlikler (`actionsandevents`) — otomasyon çekirdeği. PRD §5.3. */
export default async function ActionsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ActionsAndEventsPage />;
}
