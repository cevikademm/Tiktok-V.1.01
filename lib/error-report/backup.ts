"use client";

/**
 * Hata Bildirimleri — Supabase yedeği (istemci köprüsü, ADR-0004).
 *
 * Ağ yardımcıları; store.ts mutasyonları bunları çağırır (fire-and-forget).
 * Yalnız ağ katmanı — store'a bağımlı DEĞİL (döngüsel import olmasın diye).
 * Supabase yapılandırılmamışsa (NEXT_PUBLIC_* yok) hiç istek atmaz.
 */

import { isSupabaseConfigured } from "@/lib/overlay/realtime";
import type { ErrorReport } from "./types";

const ENDPOINT = "/api/error-reports";

/** Yedek etkin mi (hibrit Supabase modu açık mı). */
export function isBackupEnabled(): boolean {
  return isSupabaseConfigured();
}

/** Bir veya daha çok kaydı yedeğe upsert eder (best-effort). */
export async function backupReports(reports: ErrorReport[]): Promise<void> {
  if (!isBackupEnabled() || reports.length === 0) return;
  try {
    await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reports }),
    });
  } catch {
    // Yedek best-effort; yerel kayıt zaten kaynak. Sonraki mount'ta catch-up alır.
  }
}

/** Yerel silmeyi yedeğe yansıtır (best-effort). */
export async function deleteBackup(id: string): Promise<void> {
  if (!isBackupEnabled()) return;
  try {
    await fetch(`${ENDPOINT}?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  } catch {
    // Yut.
  }
}

/** Yedekte hâlihazırda bulunan kayıt id'leri (mount catch-up için diff). */
export async function fetchBackedUpIds(): Promise<Set<string>> {
  if (!isBackupEnabled()) return new Set();
  try {
    const res = await fetch(ENDPOINT);
    const data = (await res.json()) as { ids?: string[] };
    return new Set(Array.isArray(data.ids) ? data.ids : []);
  } catch {
    return new Set();
  }
}
