import type { Metadata } from "next";
import type { ReactNode } from "react";
import "../globals.css";

export const metadata: Metadata = {
  title: "Widget",
  // OBS browser source — arama motorlarına kapalı.
  robots: { index: false, follow: false },
};

/**
 * Widget kabuğu — CLAUDE.md §4/§5.10:
 * locale'siz, chrome'suz, ŞEFFAF arka plan (OBS browser source).
 */
export default function WidgetLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-transparent" style={{ background: "transparent" }}>
        {children}
      </body>
    </html>
  );
}
