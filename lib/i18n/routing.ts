import { defineRouting } from "next-intl/routing";

/**
 * Desteklenen diller — PRD §11.
 * Varsayılan: tr. Altyapı 12+ dile genişleyebilir; yeni dil eklemek için
 * buraya locale eklemek + messages/<locale>.json oluşturmak yeterli.
 */
export const locales = ["tr", "en", "de", "es"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "tr";

/** Dil seçicide gösterilen adlar (kendi dilinde — çevrilmez). */
export const localeLabels: Record<Locale, string> = {
  tr: "Türkçe",
  en: "English",
  de: "Deutsch",
  es: "Español",
};

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: "as-needed",
});
