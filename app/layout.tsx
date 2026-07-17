import type { ReactNode } from "react";

/**
 * Kök layout — locale segmentine devreder.
 * `html`/`body` etiketleri `app/[locale]/layout.tsx` içindedir (next-intl deseni);
 * widget rotaları da kendi kabuğunu kurar.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
