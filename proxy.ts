import createMiddleware from "next-intl/middleware";
import { type NextRequest } from "next/server";
import { routing } from "./lib/i18n/routing";
import { updateSession } from "./lib/supabase/middleware";

/**
 * Kök proxy (Next.js 16'da `middleware.ts` değil `proxy.ts`) — TEK dosya.
 *
 * İki iş birleştirilir (aksi halde "hem middleware hem proxy" hatası):
 *   1) Supabase SSR oturum yenileme (`updateSession`) — auth çerezlerini tazeler
 *      (Supabase yapılandırılmamışsa dokunmadan geçer). Erişim denetimi burada DEĞİL.
 *   2) next-intl locale yönlendirmesi (PRD §11 — Accept-Language + kullanıcı tercihi).
 *
 * Supabase'in tazelediği çerezler, next-intl'in ürettiği response'a taşınır.
 */
const handleI18n = createMiddleware(routing);

export default async function proxy(request: NextRequest) {
  // 1) Auth çerezlerini tazele (kendi NextResponse'una yazar).
  const supabaseResponse = await updateSession(request);
  // 2) Locale yönlendirmesi (redirect/rewrite olabilir).
  const response = handleI18n(request);
  // 3) Tazelenen auth çerezlerini locale response'una taşı.
  for (const cookie of supabaseResponse.cookies.getAll()) {
    response.cookies.set(cookie);
  }
  return response;
}

export const config = {
  /**
   * Locale yönlendirmesinden muaf yollar:
   *  - api, widget: locale'siz yüzeyler (OBS browser source / route handler).
   *  - icon, apple-icon, pwa-icon: metadata/PWA ikon route'ları (locale prefix'i 404 yapar).
   *  - _next, _vercel ve nokta içeren istekler (manifest.webmanifest, sw.js, statik dosyalar).
   */
  matcher: ["/((?!api|widget|icon|apple-icon|pwa-icon|_next|_vercel|.*\\..*).*)"],
};
