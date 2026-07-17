import { redirect } from "@/lib/i18n/navigation";

export default async function LocaleIndex({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // Kök → Başlangıç paneli (PRD §5.1).
  redirect({ href: "/start", locale });
}
