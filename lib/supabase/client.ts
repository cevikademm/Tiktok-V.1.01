"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAnonKey, getSupabaseUrl } from "./env";

/**
 * Tarayıcı Supabase Auth client'ı — cookie tabanlı oturum (SSR uyumlu).
 *
 * `createBrowserClient` oturumu, sunucunun da okuyabildiği çerezlerde tutar;
 * böylece middleware/Server Component `getUser()` ile aynı oturumu görür.
 * Login formu, Google OAuth ve çıkış bu client'ı kullanır.
 *
 * NOT: Realtime overlay aboneliği için ayrı, oturumsuz bir client vardır
 * (`lib/supabase/browser.ts`); bu ikisi bilinçli olarak ayrıdır (ADR-0003).
 */
let cached: SupabaseClient | null = null;

export function createClient(): SupabaseClient {
  if (cached) return cached;
  cached = createBrowserClient(getSupabaseUrl()!, getSupabaseAnonKey()!);
  return cached;
}
