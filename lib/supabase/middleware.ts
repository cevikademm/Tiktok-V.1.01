import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Oturum yenileme (SSR) — her istekte auth çerezlerini tazeler.
 *
 * Supabase erişim token'ı kısa ömürlüdür; Server Component'ler çerez yazamadığı
 * için token yenilemesi MUTLAKA middleware'de yapılır (Supabase SSR gereği).
 * Burada erişim denetimi (gate) YAPILMAZ — o, `(app)` layout'unda sunucuda
 * yapılır (locale bilir). Supabase yapılandırılmamışsa istek dokunulmadan geçer.
 */
export async function updateSession(
  request: NextRequest,
): Promise<NextResponse> {
  const response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return response;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // getUser() süresi dolmuş token'ı yeniler; DÖNEN çerezler response'a yazılır.
  // Bu çağrı ile response arasına kod eklenmemeli (Supabase SSR uyarısı).
  await supabase.auth.getUser();

  return response;
}
