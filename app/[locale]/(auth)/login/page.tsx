import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/lib/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "@/components/modules/auth/login-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });
  return { title: t("signInSubmit") };
}

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Zaten girişli kullanıcı login'i görmesin → panele.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect({ href: "/start", locale });

  const { error } = await searchParams;

  return <LoginForm initialError={error} />;
}
