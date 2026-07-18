import { ImageResponse } from "next/og";
import { APP_NAME } from "@/lib/utils";

/**
 * iOS "Ana Ekrana Ekle" ikonu. Next.js `<link rel="apple-touch-icon">` olarak ekler.
 * iOS beforeinstallprompt desteklemez; ekleme manueldir ama ikon burada tanımlanır.
 */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
          fontSize: 80,
          fontWeight: 800,
          fontFamily: "sans-serif",
          letterSpacing: -3,
        }}
      >
        {APP_NAME.slice(0, 2).toUpperCase()}
      </div>
    ),
    { ...size },
  );
}
