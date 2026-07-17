/**
 * Hata Bildirimi modülü — tip sözleşmesi.
 *
 * Not: Bu proje Faz 0-1'de Supabase'siz çalışır (PRD §12.2); kayıtlar mock
 * store'da (localStorage) tutulur ve ekran görüntüsü base64 JPEG olarak gömülür.
 * Faz 2'de aynı şekil bir `error_reports` tablosuna taşınabilir (alanlar birebir).
 */

/** Bildirilen hatanın önem derecesi. */
export type ErrorSeverity = "low" | "normal" | "high";

/** Bildirim iş akışı durumu (admin panelinde değiştirilir). */
export type ErrorStatus = "new" | "in_progress" | "resolved";

/** Tek bir hata bildirimi kaydı. */
export interface ErrorReport {
  /** `err_<zaman36>_<rastgele>` — makeReportId() üretir. */
  id: string;
  /** Bildiren (admin) — kullanıcı sistemi yok, sabit "Admin" ya da override. */
  reporterName: string;
  severity: ErrorSeverity;
  status: ErrorStatus;
  /** Zorunlu serbest metin açıklama (boşsa gönderim engellenir). */
  description: string;
  /** Bildirim anındaki tam URL (locale + hash dahil). */
  pageUrl: string | null;
  /** URL'nin path + hash kısmı (kısa gösterim için). */
  pagePath: string | null;
  userAgent: string | null;
  /** "1920×1080" — innerWidth×innerHeight. */
  screenSize: string | null;
  appVersion: string | null;
  /**
   * Ekran görüntüsü — base64 data URL (image/jpeg, kalite 0.7).
   * Supabase Storage olmadığı için görüntü doğrudan kayda gömülür (PRD §12.2).
   */
  screenshotData: string | null;
  /** ISO 8601 oluşturulma zamanı. */
  createdAt: string;
  /** "resolved" olduğunda ISO zaman, aksi halde null. */
  resolvedAt: string | null;
}
