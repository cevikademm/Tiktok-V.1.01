"use client";

/**
 * Hata Bildirimi modülü — kalıcılık katmanı.
 *
 * Mevcut mock store'a (lib/data/mock/store.ts, localStorage `livekit.mock.v1`)
 * bağlanır; ayrı bir depo AÇMAZ (mimariyi bozmamak için). Widget kayıt ekler,
 * panel listeler/durumu değiştirir/siler.
 */

import { useMemo } from "react";
import { useLocalStorage } from "@/lib/use-local-storage";
import { mutate } from "@/lib/data/mock/store";
import { useMockStore } from "@/lib/data/mock/use-store";
import { ADMIN_FLAG_KEY } from "./client";
import { backupReports, deleteBackup } from "./backup";
import type { ErrorReport, ErrorStatus } from "./types";

/* -------------------------------------------------------------------------- */
/* Admin görünürlük kapısı                                                     */
/* -------------------------------------------------------------------------- */

/**
 * WhatsApp FAB'ı + Hata Bildirimleri paneli görünürlüğü.
 *
 * Bu yerel araçta kimlik/rol sistemi yoktur; uygulamayı çalıştıran kişi zaten
 * tek yöneticidir. Bu yüzden VARSAYILAN olarak GÖRÜNÜR. Gizlemek isteyen:
 *   localStorage.setItem('tikfinity_hata_admin','0')   // → sayfayı yenile
 * Tekrar göstermek:
 *   localStorage.removeItem('tikfinity_hata_admin')     // → sayfayı yenile
 *
 * Hidrasyon-güvenli: sunucu/ilk boya fallback "" → görünür; yalnız "0" gizler.
 */
export function useIsErrorAdmin(): boolean {
  // Ham string olarak oku (değer JSON değil, düz "0"/"1").
  const [flag] = useLocalStorage<string>(ADMIN_FLAG_KEY, "", (raw) => raw);
  return flag !== "0";
}

/* -------------------------------------------------------------------------- */
/* Okuma                                                                       */
/* -------------------------------------------------------------------------- */

/** Tüm bildirimler — en yeni önce sıralı. */
export function useErrorReports(): ErrorReport[] {
  const state = useMockStore();
  // `?? []`: eski/kısmi localStorage kayıtlarında (bu alan eklenmeden önce yazılmış)
  // `errorReports` tanımsız olabilir; nav kabuğu buna dayanamaz → asla çökmemeli.
  const list = state.errorReports;
  return useMemo(
    () =>
      [...(list ?? [])].sort((a, b) =>
        String(b.createdAt).localeCompare(String(a.createdAt)),
      ),
    [list],
  );
}

/** Çözülmemiş (new + in_progress) bildirim sayısı — nav rozeti için. */
export function useUnresolvedErrorCount(): number {
  const state = useMockStore();
  const list = state.errorReports;
  return useMemo(
    () => (list ?? []).filter((r) => r.status !== "resolved").length,
    [list],
  );
}

/* -------------------------------------------------------------------------- */
/* Yazma (mutate — kök nesne kimliği değişir, useSyncExternalStore görür)      */
/* -------------------------------------------------------------------------- */

/** Yeni bildirimi başa ekler + Supabase'e yedekler (ADR-0004). */
export function addErrorReport(report: ErrorReport): void {
  mutate((state) => {
    state.errorReports = [report, ...(state.errorReports ?? [])];
  });
  void backupReports([report]);
}

/** Durumu değiştirir; "resolved" ise resolvedAt damgalanır + yedeği günceller. */
export function setErrorReportStatus(id: string, status: ErrorStatus): void {
  let updated: ErrorReport | undefined;
  mutate((state) => {
    state.errorReports = (state.errorReports ?? []).map((r) => {
      if (r.id !== id) return r;
      updated = {
        ...r,
        status,
        resolvedAt: status === "resolved" ? new Date().toISOString() : null,
      };
      return updated;
    });
  });
  if (updated) void backupReports([updated]);
}

/** Bir bildirimi kalıcı olarak siler + yedekten kaldırır. */
export function removeErrorReport(id: string): void {
  mutate((state) => {
    state.errorReports = (state.errorReports ?? []).filter((r) => r.id !== id);
  });
  void deleteBackup(id);
}
