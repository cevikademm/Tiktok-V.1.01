"use client";

import { useEffect, useRef } from "react";
import {
  backupReports,
  fetchBackedUpIds,
  isBackupEnabled,
} from "@/lib/error-report/backup";
import { useErrorReports } from "@/lib/error-report/store";

/**
 * Hata Bildirimleri yedeği — mount catch-up (ADR-0004).
 *
 * Her mutasyon zaten anlık yedeklenir (store.ts). Bu bileşen, Supabase
 * yapılandırıldığı AN yereldeki ESKİ kayıtları (mutasyon anında yedek kapalıyken
 * yazılmış olanlar) yakalar: yedekte olmayan yerel kayıtları tek seferde upsert eder.
 * Görsel çıktısı yok; (app) kabuğunda bir kez mount'lu.
 */
export function ErrorReportBackup() {
  const reports = useErrorReports();
  const doneRef = useRef(false);

  useEffect(() => {
    if (doneRef.current || !isBackupEnabled() || reports.length === 0) return;
    doneRef.current = true;
    const timer = setTimeout(() => {
      void (async () => {
        const backedUp = await fetchBackedUpIds();
        const missing = reports.filter((r) => !backedUp.has(r.id));
        if (missing.length > 0) await backupReports(missing);
      })();
    }, 1000);
    return () => clearTimeout(timer);
  }, [reports]);

  return null;
}
