import type { MetadataRoute } from "next";
import { APP_NAME } from "@/lib/utils";

/**
 * Web App Manifest — PWA "Ana ekrana ekle" için.
 * Next.js bunu `/manifest.webmanifest` olarak sunar ve <link rel="manifest"> ekler.
 *
 * İkonlar `app/pwa-icon/[size]/route.tsx` tarafından çalışma zamanında üretilir
 * (next/og ImageResponse — ayrı bağımlılık yok). Tam-taşan (#D43555) zemin +
 * beyaz monogram olduğu için aynı kaynak hem `any` hem `maskable` amaca uyar.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${APP_NAME} — TikTok LIVE Studio`,
    short_name: APP_NAME,
    description: "TikTok LIVE etkileşim stüdyosu — sesli uyarılar, overlay'ler ve puan ekonomisi.",
    // Locale middleware'i "/" isteğini kullanıcının diline + /start'a yönlendirir.
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#1C1C1C",
    theme_color: "#D43555",
    lang: "tr",
    dir: "ltr",
    categories: ["entertainment", "productivity", "social"],
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
