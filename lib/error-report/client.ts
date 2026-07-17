/**
 * Hata Bildirimi modülü — tarayıcı yardımcıları (screenshot + WhatsApp).
 *
 * UI: components/error-report/hata-bildir-widget.tsx
 * Persistans: lib/error-report/store.ts (mock store / localStorage).
 *
 * Bu dosyada React YOKTUR; yalnız saf yardımcı fonksiyonlar. Supabase Storage
 * bu fazda olmadığı için ekran görüntüsü base64 olarak kayda gömülür; burada
 * yalnız yakalama, WhatsApp metni kurma ve cihaza indirme var.
 */

import { APP_NAME } from "@/lib/utils";
import type { ErrorReport, ErrorSeverity } from "./types";

/**
 * FAB/sekme görünürlük bayrağı. Proje kimlik/rol sistemi içermediği için
 * VARSAYILAN görünürdür; yalnızca bu anahtar "0" olduğunda gizlenir.
 * Gizle:  localStorage.setItem('tikfinity_hata_admin','0')
 * Göster: localStorage.removeItem('tikfinity_hata_admin')
 */
export const ADMIN_FLAG_KEY = "tikfinity_hata_admin";

/** Admin/destek WhatsApp numarası override anahtarı (bu projeye özel). */
export const PHONE_LS_KEY = "tikfinity_hata_admin_phone";

/**
 * Destek WhatsApp numarası (uluslararası, yalnız rakam — wa.me + istemez).
 * Öncelik: localStorage override > env (NEXT_PUBLIC_HATA_ADMIN_PHONE) > varsayılan.
 */
const DEFAULT_ADMIN_PHONE = "905324961412";

export function getAdminPhone(): string {
  let ls: string | null = null;
  try {
    ls = localStorage.getItem(PHONE_LS_KEY);
  } catch {
    // Gizli mod / erişim engeli — varsayılana düş.
  }
  const env = (process.env.NEXT_PUBLIC_HATA_ADMIN_PHONE ?? "").trim();
  const raw = (ls && ls.trim()) || env || DEFAULT_ADMIN_PHONE;
  return String(raw).replace(/[^\d]/g, "");
}

/** Kısa benzersiz id — `err_<zaman36>_<rastgele>`. */
export function makeReportId(): string {
  const rnd = Math.random().toString(36).slice(2, 8);
  return `err_${Date.now().toString(36)}_${rnd}`;
}

/**
 * Görünür viewport'un ekran görüntüsünü alır (html2canvas — lazy import).
 * Widget'ın kendi DOM'u (FAB + modal) `data-hata-bildir-skip="1"` ile atlanır.
 *
 * @returns JPEG data URL (kalite 0.7 — localStorage kotası dostu) veya null.
 */
export async function captureScreenshot(): Promise<string | null> {
  if (typeof document === "undefined") return null;
  try {
    // html2canvas-pro yalnız gerektiğinde yüklenir (SSR'de import edilmez, bundle şişmez).
    // "pro" fork'u, Tailwind v4'ün ürettiği oklch()/oklab()/color-mix() renklerini
    // ayrıştırabilir; orijinal html2canvas 1.x bunlarda "unsupported color function" atar.
    const { default: html2canvas } = await import("html2canvas-pro");
    // Keskin metin için en az 2x supersampling; çok büyük ekranlarda 2.5x tavan.
    const scale = Math.min(Math.max(window.devicePixelRatio || 1, 2), 2.5);
    const canvas = await html2canvas(document.body, {
      backgroundColor: "#ffffff",
      scale,
      useCORS: true,
      logging: false,
      imageTimeout: 0,
      // Modülün kendi arayüzünü (FAB + modal + toast) görüntüye dahil etme.
      ignoreElements: (el: Element) =>
        (el as HTMLElement)?.dataset?.hataBildirSkip === "1",
      x: window.scrollX,
      y: window.scrollY,
      width: window.innerWidth,
      height: window.innerHeight,
      windowWidth: document.documentElement.clientWidth,
      windowHeight: document.documentElement.clientHeight,
    });
    // Supabase Storage yok → kayıt localStorage'a base64 gömülür; q0.7 makul boyut.
    return canvas.toDataURL("image/jpeg", 0.7);
  } catch {
    // Yakalama başarısızsa akış devam eder; kullanıcı manuel dosya ekleyebilir.
    return null;
  }
}

const SEVERITY_LABEL: Record<ErrorSeverity, string> = {
  low: "Düşük",
  normal: "Normal",
  high: "Yüksek / Acil",
};

/**
 * WhatsApp mesaj metnini kurar (marka başlığı NEXT_PUBLIC_APP_NAME'den gelir).
 * @param opts.attached true ise görüntü mesaja DOSYA olarak (Web Share API ile)
 *   eklenmiştir; metindeki görüntü satırı buna göre yazılır.
 */
export function buildWhatsAppText(
  rec: ErrorReport,
  opts: { attached?: boolean } = {},
): string {
  const dt = (() => {
    try {
      return new Date(rec.createdAt).toLocaleString("tr-TR");
    } catch {
      return rec.createdAt;
    }
  })();
  // Görüntü satırı: dosya eklendiyse (Web Share) onu belirt; değilse indirilip
  // 📎 ile elle iliştirilmesi gerektiğini yaz (wa.me deep-link dosya taşıyamaz).
  const screenshotLine = !rec.screenshotData
    ? "🖼️ Ekran görüntüsü yok."
    : opts.attached
      ? "🖼️ Ekran görüntüsü bu mesaja dosya olarak eklendi."
      : "🖼️ Ekran görüntüsü bu cihaza indirildi — lütfen sohbete 📎 ile ekleyin.";
  const lines: Array<string | null> = [
    `🐞 *HATA BİLDİRİMİ — ${APP_NAME}*`,
    `👤 Bildiren: ${rec.reporterName || "—"}`,
    `🗓️ ${dt}`,
    `📍 Sayfa: ${rec.pagePath || "—"}`,
    rec.pageUrl ? `🔗 ${rec.pageUrl}` : null,
    `🖥️ ${rec.screenSize || "—"}`,
    `⚠️ Önem: ${SEVERITY_LABEL[rec.severity] ?? rec.severity ?? "Normal"}`,
    "",
    "📝 *Açıklama:*",
    rec.description || "—",
    "",
    screenshotLine,
    `🆔 ${rec.id}`,
  ];
  return lines.filter((l): l is string => l !== null).join("\n");
}

/** WhatsApp'ı (varsa uygulama, yoksa web) önceden doldurulmuş metinle açar. */
export function openWhatsApp(text: string, phone: string = getAdminPhone()): string {
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  try {
    window.open(url, "_blank", "noopener,noreferrer");
  } catch {
    window.location.href = url;
  }
  return url;
}

/**
 * Ekran görüntüsünü cihaza indirir — kullanıcı WhatsApp sohbetinde 📎 ile
 * iliştirebilsin (deep-link otomatik ekleyemez).
 */
export function downloadDataUrl(dataUrl: string, filename: string): void {
  try {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename || "hata-ekran-goruntusu.jpg";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch {
    // İndirme başarısız — sessiz geç (akış zaten kaydı yazdı).
  }
}

/** base64 data URL → Blob (Web Share / upload için). */
export function dataUrlToBlob(dataUrl: string): Blob | null {
  try {
    const [head, body] = String(dataUrl).split(",");
    const mime = /data:([^;]+)/.exec(head)?.[1] ?? "image/jpeg";
    const bin = atob(body);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  } catch {
    return null;
  }
}

/** base64 data URL → File (Web Share API dosya paylaşımı File nesnesi ister). */
export function dataUrlToFile(dataUrl: string, filename: string): File | null {
  const blob = dataUrlToBlob(dataUrl);
  if (!blob) return null;
  try {
    return new File([blob], filename || "hata-ekran-goruntusu.jpg", {
      type: blob.type || "image/jpeg",
    });
  } catch {
    return null;
  }
}

/** shareReportWithScreenshot sonucu. */
export type ShareResult = "shared" | "aborted" | "unsupported";

/**
 * Ekran görüntüsünü Web Share API ile DOSYA olarak paylaşır (WhatsApp vb.).
 * wa.me deep-link dosya iliştiremediği için, görüntüyü gerçekten mesaja eklemenin
 * tek web yolu budur. Mobilde ve modern masaüstü Chromium'da çalışır.
 *
 * @returns "shared"      → paylaşım tamamlandı (görüntü eklendi)
 *          "aborted"     → kullanıcı paylaşım sayfasını kapattı (wa.me'ye DÜŞME)
 *          "unsupported" → cihaz/tarayıcı dosya paylaşımını desteklemiyor → wa.me'ye düş
 */
export async function shareReportWithScreenshot(params: {
  file: File | null;
  text: string;
  title?: string;
}): Promise<ShareResult> {
  const { file, text, title } = params;
  if (typeof navigator === "undefined" || !navigator.share || !file) {
    return "unsupported";
  }
  try {
    if (navigator.canShare && !navigator.canShare({ files: [file] })) {
      return "unsupported";
    }
  } catch {
    return "unsupported";
  }
  try {
    await navigator.share({ files: [file], text, title: title ?? "Hata Bildirimi" });
    return "shared";
  } catch (e) {
    // Kullanıcı paylaşım sayfasını iptal etti → akış çalıştı; çift mesaj (ayrıca
    // wa.me) açmamak için "aborted" döndür.
    if (e instanceof Error && e.name === "AbortError") return "aborted";
    return "unsupported";
  }
}
