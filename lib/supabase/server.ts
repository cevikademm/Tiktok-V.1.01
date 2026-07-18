import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAnonKey, getSupabaseUrl } from "./env";

/**
 * Sunucu-tarafı Supabase Auth client'ı — cookie tabanlı oturum (SSR).
 *
 * Server Component, Route Handler ve Server Action'larda kullanılır; oturumu
 * istek çerezlerinden okur ve yeniler. Yalnız ANON key kullanır (RLS aktif);
 * service-role ayrı client'tadır (bkz. `lib/supabase/admin.ts`).
 *
 * Not: Server Component'lerde çerez YAZILAMAZ (Next.js kısıtı); bu durumda
 * setAll no-op olur ve token yenilemesini `middleware.ts` üstlenir.
 */
export async function createClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  const url = getSupabaseUrl()!;
  const anonKey = getSupabaseAnonKey()!;

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Component'ten çağrıldı — çerez yazılamaz. Oturum yenilemesini
          // middleware yaptığı için güvenle yok sayılır.
        }
      },
    },
  });
}
