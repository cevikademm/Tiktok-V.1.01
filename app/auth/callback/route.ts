import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * OAuth + e-posta onayı geri dönüş noktası (PKCE code exchange).
 *
 * Hem Google OAuth hem de "e-posta onayı" bağlantıları buraya `?code=...` ile
 * döner. Kodu oturuma çeviririz (çerezler yazılır) ve `next`'e yönlendiririz.
 * Locale-siz kasıtlı: Supabase Dashboard redirect URL'i tek ve sabit olsun.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = sanitizeNext(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${resolveOrigin(request, origin)}${next}`);
    }
  }

  // Kod yok ya da değişim başarısız — hata bayrağıyla login'e dön.
  return NextResponse.redirect(
    `${resolveOrigin(request, origin)}/login?error=auth_callback`,
  );
}

/** Açık yönlendirme (open redirect) koruması — yalnız site-içi göreli yollar. */
function sanitizeNext(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
}

/** Proxy arkasında doğru host'u seç (Vercel: x-forwarded-host). */
function resolveOrigin(request: NextRequest, origin: string): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const isLocal = process.env.NODE_ENV === "development";
  if (!forwardedHost || isLocal) return origin;
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  return `${proto}://${forwardedHost}`;
}
