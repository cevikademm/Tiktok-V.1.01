import type { Metadata } from "next";
import localFont from "next/font/local";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { AppProvider } from "@/components/providers/app-provider";
import { routing } from "@/lib/i18n/routing";
import { APP_NAME } from "@/lib/utils";
import "../globals.css";

/**
 * PRD §4.2 — Birincil UI: Outfit; form alanlarında Inter.
 *
 * Fontlar `app/fonts/` altında SELF-HOST edilir (`next/font/local`), `next/font/google`
 * ile değil. Sebep: google varyantı derleme/dev sırasında fonts.gstatic.com'a bağlanır;
 * ağın kısıtlı olduğu ortamlarda derleme fontsuz kalır, dev sunucusu ise istek başına
 * dakikalarca askıda bekler. Self-host derlemeyi deterministik ve ağdan bağımsız yapar.
 * Dosyalar variable font (100..900), latin + latin-ext altkümeleri.
 */
const outfit = localFont({
  src: [
    { path: "../fonts/outfit-latin.woff2", style: "normal" },
    { path: "../fonts/outfit-latin-ext.woff2", style: "normal" },
  ],
  variable: "--font-outfit",
  display: "swap",
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});

const inter = localFont({
  src: [
    { path: "../fonts/inter-latin.woff2", style: "normal" },
    { path: "../fonts/inter-latin-ext.woff2", style: "normal" },
  ],
  variable: "--font-inter",
  display: "swap",
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "app" });

  return {
    title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
    description: t("tagline"),
    // SEO hreflang alternates — PRD §11.
    alternates: {
      languages: Object.fromEntries(routing.locales.map((l) => [l, `/${l}`])),
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  // Statik render için locale'i istek bağlamına yaz.
  setRequestLocale(locale);

  return (
    <html lang={locale} className={`${outfit.variable} ${inter.variable}`}>
      <body>
        <NextIntlClientProvider>
          <AppProvider>{children}</AppProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
