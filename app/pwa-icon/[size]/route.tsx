import { ImageResponse } from "next/og";
import { APP_NAME } from "@/lib/utils";

/**
 * PWA manifest ikonları — next/og ile çalışma zamanında üretilir (sharp/harici araç yok).
 * Tam-taşan marka kırmızısı (#D43555) zemin + beyaz monogram: hem `any` hem `maskable`
 * amaç için güvenli (önemli içerik merkezde, kenar boşluğu yok).
 *
 * NOT: `/pwa-icon/*` yolu locale yönlendirmesinden muaftır (bkz. proxy.ts matcher).
 */

export const dynamic = "force-static";

export function generateStaticParams() {
  return [{ size: "192" }, { size: "512" }];
}

const MONOGRAM = APP_NAME.slice(0, 2).toUpperCase();

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ size: string }> },
) {
  const { size: raw } = await params;
  const size = Math.min(1024, Math.max(48, Number(raw) || 192));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#D43555",
          color: "#ffffff",
          fontSize: size * 0.44,
          fontWeight: 800,
          fontFamily: "sans-serif",
          letterSpacing: -size * 0.015,
        }}
      >
        {MONOGRAM}
      </div>
    ),
    { width: size, height: size },
  );
}
