import type { ReactNode } from "react";
import "../tt-theme.css";

/**
 * LiveKit giriş kabuğu — TikTok marka teması (`.tt-surface`).
 *
 * Tek ekran, yalnız login. Arka planda loş bir dashboard önizlemesi (homepage
 * tanıtımı), üstte cam login kartı. SPA chrome'u (topbar/sidebar) YOK.
 * `globals.css` gövdeyi `overflow:hidden` yaptığı için kaydırmayı bu kapsayıcı
 * üstlenir; küçük ekranlarda (form açıldığında) güvenli dikey kaydırma sağlar.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="tt-surface relative h-[100dvh] w-full overflow-y-auto overflow-x-hidden">
      {children}
    </div>
  );
}
