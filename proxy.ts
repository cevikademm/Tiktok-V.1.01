import createMiddleware from "next-intl/middleware";
import { routing } from "./lib/i18n/routing";

/**
 * Locale yönlendirmesi — PRD §11 (Accept-Language algılama + kullanıcı tercihi).
 * Next.js 16'da bu dosya `middleware.ts` değil `proxy.ts` adını taşır.
 */
export default createMiddleware(routing);

export const config = {
  /**
   * Widget rotaları (/widget/*) locale'siz ve chrome'suzdur (OBS browser source) —
   * proxy'ye girmezler. API, static ve dosya uzantılı istekler de hariç.
   */
  matcher: ["/((?!api|widget|_next|_vercel|.*\\..*).*)"],
};
