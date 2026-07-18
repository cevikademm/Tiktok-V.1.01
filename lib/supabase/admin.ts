/**
 * Sunucu-tarafı Supabase client'ı — SERVICE ROLE (RLS bypass).
 *
 * YALNIZ sunucuda kullanılır: /api/overlay/register (config yazma) ve connector
 * worker (config okuma + Realtime broadcast). Service role key ASLA tarayıcıya
 * sızmaz (NEXT_PUBLIC_ değil). Hibrit mimari (ADR-0003).
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

/** Service-role client — Supabase yapılandırılmamışsa null. */
export function getAdminSupabase(): SupabaseClient | null {
  if (cached) return cached;
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;

  cached = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

/** overlay_configs satır tipi (DB ↔ hub config köprüsü). */
export interface OverlayConfigRow {
  id: string;
  username: string;
  actions: unknown[];
  events: unknown[];
  screens: { screen: number; maxQueueLength: number }[];
  /** Zamanlayıcılar — connector worker aralıklı eylemleri buradan okur (ADR-0005). */
  timers: unknown[];
  updated_at?: string;
}

export const OVERLAY_CONFIG_TABLE = "overlay_configs";
