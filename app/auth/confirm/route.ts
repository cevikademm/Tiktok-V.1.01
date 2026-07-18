import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * E-posta OTP onayı — `token_hash` + `type` ile gelen bağlantılar için.
 *
 * Supabase e-posta şablonu `{{ .TokenHash }}` kullanıyorsa onay bağlantısı
 * buraya döner (PKCE `?code=` yerine). `verifyOtp` oturumu kurar. Böylece hem
 * varsayılan hem PKCE e-posta şablonlarını destekleriz (callback + confirm).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = sanitizeNext(searchParams.get("next"));

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) {
      return NextResponse.redirect(`${resolveOrigin(request, origin)}${next}`);
    }
  }

  return NextResponse.redirect(
    `${resolveOrigin(request, origin)}/login?error=auth_confirm`,
  );
}

function sanitizeNext(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
}

function resolveOrigin(request: NextRequest, origin: string): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const isLocal = process.env.NODE_ENV === "development";
  if (!forwardedHost || isLocal) return origin;
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  return `${proto}://${forwardedHost}`;
}
