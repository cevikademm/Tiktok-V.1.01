import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/lib/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { HomePage } from "@/components/modules/home/home-page";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "home" });
  return { title: t("meta.title"), description: t("meta.description") };
}

/**
 * Ana sayfa (`/[locale]`) — genel tanıtım. Giriş yapmış kullanıcı doğrudan
 * panele (`/start`) yönlenir; diğerleri tanıtım + "Giriş yap" butonunu görür.
 */
export default async function LocaleHome({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect({ href: "/start", locale });

  return <HomePage />;
}
