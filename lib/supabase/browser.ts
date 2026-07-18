"use client";

/**
 * Tarayıcı Supabase client'ı — yalnız Realtime aboneliği için (widget overlay'i).
 * Anon key public'tir (NEXT_PUBLIC_*); yalnız public broadcast kanallarını dinler,
 * DB erişimi yok. Hibrit mimari (ADR-0003).
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

/** Tekil tarayıcı client'ı döner; Supabase yapılandırılmamışsa null. */
export function getBrowserSupabase(): SupabaseClient | null {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  cached = createClient(url, anonKey, {
    auth: { persistSession: false },
    realtime: { params: { eventsPerSecond: 20 } },
  });
  return cached;
}
