import { ImageResponse } from "next/og";
import { APP_NAME } from "@/lib/utils";

/** Tarayıcı sekmesi favicon'u. Next.js `<link rel="icon">` olarak ekler. */
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
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
          fontSize: 15,
          fontWeight: 800,
          fontFamily: "sans-serif",
          borderRadius: 7,
        }}
      >
        {APP_NAME.slice(0, 2).toUpperCase()}
      </div>
    ),
    { ...size },
  );
}
