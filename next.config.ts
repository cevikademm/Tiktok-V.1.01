import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./lib/i18n/request.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Üst dizinlerdeki lockfile'lar kök olarak seçilmesin (Turbopack workspace algılaması).
  turbopack: { root: __dirname },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  // Next.js dev-tools göstergesi (yalnız `next dev`) varsayılan sol-alttadır ve
  // sol ikon rayının altındaki 🐞 "Hata Bildirimleri" ikonunu ÖRTER. Turbopack dev'de
  // `position` uygulanmadığından göstergeyi tümden kapatıyoruz (yalnız derleme durumu
  // rozeti — işlevsellik kaybı yok). Üretimde gösterge zaten hiç çıkmaz.
  devIndicators: false,
};

export default withNextIntl(nextConfig);
