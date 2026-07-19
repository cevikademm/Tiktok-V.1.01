import type { ReactNode } from "react";
import "../tt-theme.css";

/**
 * Home (tanıtım) kabuğu — TikTok marka teması (`.tt-surface`).
 *
 * Genel erişime açık ana sayfa. SPA chrome'u yok. `globals.css` gövdeyi
 * `overflow:hidden` yaptığı için kaydırmayı bu kapsayıcı üstlenir.
 */
export default function HomeLayout({ children }: { children: ReactNode }) {
  return (
    <div className="tt-surface relative h-[100dvh] w-full overflow-y-auto overflow-x-hidden">
      {children}
    </div>
  );
}
