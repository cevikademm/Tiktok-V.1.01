"use client";

/**
 * ─── Hata Bildir Widget ──────────────────────────────────────────────
 * Ekranın sağ-altında WhatsApp FAB'ı. Yalnızca admin modunda görünür
 * (localStorage `tikfinity_hata_admin==='1'`). Tıklayınca:
 *   1) Görünür viewport'un ekran görüntüsünü alır (html2canvas)
 *   2) Modalda görüntüyü "dosya eki" olarak gösterir
 *   3) Admin hatayı açıklar + önem derecesi seçer
 *   4) Kayıt mock store'a (localStorage) yazılır
 *   5) WhatsApp destek hattı önceden doldurulmuş metinle açılır + görüntü indirilir
 *
 * Persistans: lib/error-report/store.ts · Yardımcı: lib/error-report/client.ts
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useToast } from "@/components/ui/toast";
import {
  buildWhatsAppText,
  captureScreenshot,
  dataUrlToFile,
  downloadDataUrl,
  getAdminPhone,
  makeReportId,
  openWhatsApp,
  shareReportWithScreenshot,
} from "@/lib/error-report/client";
import { addErrorReport, useIsErrorAdmin } from "@/lib/error-report/store";
import type { ErrorReport, ErrorSeverity } from "@/lib/error-report/types";

/* Marka/statü renkleri — tema chrome'u değil (WhatsApp markası + semantik önem).
   Yüzey/çerçeve/metin renkleri globals.css token'larından (var()) gelir. */
const WA_GREEN = "#25D366";
const WA_GREEN_DARK = "#128C7E";
const Z_FAB = 2147480000;
const Z_MODAL = 2147481000;

/** Koyu tema yüzey token'ları (globals.css) — bileşende ham hex yok. */
const T = {
  surface: "var(--surface-2)",
  surface2: "var(--surface-3)",
  border: "var(--border-soft)",
  borderStrong: "var(--border-maroon)",
  text: "var(--foreground)",
  textDim: "var(--text-muted)",
} as const;

const SEVERITIES: Array<{ key: ErrorSeverity; label: string; color: string }> = [
  { key: "low", label: "Düşük", color: "#16A34A" },
  { key: "normal", label: "Normal", color: "#F59E0B" },
  { key: "high", label: "Yüksek/Acil", color: "#EF4444" },
];

interface Meta {
  pageUrl: string;
  pagePath: string;
  userAgent: string;
  screenSize: string;
  appVersion: string;
}

function collectMeta(): Meta {
  if (typeof window === "undefined") {
    return { pageUrl: "", pagePath: "", userAgent: "", screenSize: "", appVersion: "0.1.0" };
  }
  return {
    pageUrl: window.location?.href ?? "",
    pagePath: (window.location?.pathname ?? "") + (window.location?.hash ?? ""),
    userAgent: navigator?.userAgent ?? "",
    screenSize: `${window.innerWidth}×${window.innerHeight}`,
    appVersion: process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0",
  };
}

function WhatsAppGlyph({ size = 28, color = "#fff" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

const miniBtn: CSSProperties = {
  padding: "5px 10px",
  borderRadius: 8,
  border: `1px solid ${T.border}`,
  background: T.surface2,
  color: T.text,
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};

const spinner = (size: number): CSSProperties => ({
  width: size,
  height: size,
  border: "2.5px solid rgba(255,255,255,0.4)",
  borderTopColor: "#fff",
  borderRadius: "50%",
  display: "inline-block",
  animation: "hb-spin 0.7s linear infinite",
});

export function HataBildirWidget() {
  const isAdmin = useIsErrorAdmin();
  const { show } = useToast();

  const [open, setOpen] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<ErrorSeverity>("normal");
  const [meta, setMeta] = useState<Meta | null>(null);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setScreenshot(null);
    setDescription("");
    setSeverity("normal");
    setSending(false);
  }, []);

  const closeModal = useCallback(() => {
    setOpen(false);
    reset();
  }, [reset]);

  // ESC ile kapat
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !sending) closeModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, sending, closeModal]);

  // FAB → önce görüntü al, sonra modalı aç (modal görüntüde çıkmasın diye).
  const handleOpen = useCallback(async () => {
    if (open || capturing) return;
    setCapturing(true);
    setMeta(collectMeta());
    // FAB'ın gizlenmesi için iki frame bekle (ignoreElements yakalamadan önce).
    await new Promise<void>((r) =>
      requestAnimationFrame(() => requestAnimationFrame(() => r())),
    );
    const shot = await captureScreenshot();
    setScreenshot(shot);
    setCapturing(false);
    setOpen(true);
    if (!shot) {
      show("Otomatik ekran görüntüsü alınamadı. Manuel ekleyebilirsiniz.", "info");
    }
  }, [open, capturing, show]);

  const handleRecapture = useCallback(async () => {
    setOpen(false);
    await new Promise<void>((r) =>
      requestAnimationFrame(() => requestAnimationFrame(() => r())),
    );
    const shot = await captureScreenshot();
    setScreenshot(shot);
    setMeta(collectMeta());
    setOpen(true);
    if (!shot) show("Ekran görüntüsü alınamadı.", "info");
  }, [show]);

  const handleFilePick = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setScreenshot(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(file);
    e.target.value = "";
  }, []);

  const buildRecord = useCallback(
    (id: string, createdAt: string): ErrorReport => ({
      id,
      reporterName: "Admin",
      severity,
      status: "new",
      description: description.trim(),
      pageUrl: meta?.pageUrl || null,
      pagePath: meta?.pagePath || null,
      userAgent: meta?.userAgent || null,
      screenSize: meta?.screenSize || null,
      appVersion: meta?.appVersion || null,
      screenshotData: screenshot, // base64 JPEG (Supabase Storage yok)
      createdAt,
      resolvedAt: null,
    }),
    [screenshot, description, meta, severity],
  );

  // Tek birleşik aksiyon: önce kaydı yazar (addErrorReport), sonra WhatsApp'tan
  // gönderir. Paylaşım iptal edilse bile kayıt tutulur.
  const handleSend = useCallback(async () => {
    if (sending) return;
    if (!description.trim()) {
      show("Lütfen hatayı kısaca açıklayın.", "info");
      return;
    }
    setSending(true);
    const shot = screenshot;
    try {
      const rec = buildRecord(makeReportId(), new Date().toISOString());
      addErrorReport(rec);

      // 1) ÖNCELİK: görüntüyü mesaja DOSYA olarak ekle (Web Share API).
      //    wa.me deep-link dosya taşıyamaz; mesaja gerçekten iliştirmenin tek
      //    web yolu budur (mobil + modern masaüstü Chromium'da WhatsApp seçilir).
      if (shot) {
        const file = dataUrlToFile(shot, `hata-${rec.id}.jpg`);
        const result = await shareReportWithScreenshot({
          file,
          text: buildWhatsAppText(rec, { attached: true }),
          title: "Hata Bildirimi",
        });
        if (result === "shared") {
          setOpen(false);
          reset();
          show("Gönderildi — ekran görüntüsü mesaja eklendi.", "success");
          return;
        }
        if (result === "aborted") {
          // Kullanıcı paylaşım sayfasını kapattı; kayıt duruyor, çift mesaj açma.
          setSending(false);
          show("Paylaşım iptal edildi. Kayıt tutuldu.", "info");
          return;
        }
        // result === "unsupported" → 2) yedek: görüntüyü indir + wa.me aç.
        downloadDataUrl(shot, `hata-${rec.id}.jpg`);
      }

      // 2) YEDEK: dosya paylaşımı yoksa (ya da görüntü yoksa) destek hattı sohbetini aç.
      openWhatsApp(buildWhatsAppText(rec));
      setOpen(false);
      reset();
      show(
        shot
          ? "Kaydedildi. WhatsApp açıldı — görüntü indirildi, 📎 ile iliştirin."
          : "Kaydedildi. WhatsApp açıldı.",
        "success",
      );
    } catch {
      show("Bir sorun oluştu, tekrar deneyin.", "error");
      setSending(false);
    }
  }, [sending, description, screenshot, buildRecord, reset, show]);

  if (!isAdmin) return null;

  const phonePretty = `+${getAdminPhone()}`;

  return (
    <div data-hata-bildir-skip="1">
      {/* ─── FAB ─── */}
      {!open && (
        <button
          type="button"
          onClick={handleOpen}
          disabled={capturing}
          title="Hata Bildir (WhatsApp)"
          aria-label="Hata Bildir"
          style={{
            position: "fixed",
            right: 18,
            bottom: 18,
            zIndex: Z_FAB,
            width: 58,
            height: 58,
            borderRadius: "50%",
            border: "none",
            cursor: capturing ? "wait" : "pointer",
            background: `linear-gradient(145deg, ${WA_GREEN}, ${WA_GREEN_DARK})`,
            boxShadow: "0 10px 28px rgba(18,140,126,0.45), 0 2px 8px rgba(0,0,0,0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "transform .15s ease, box-shadow .15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "scale(1.07)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)";
          }}
        >
          {capturing ? (
            <span style={spinner(22)} />
          ) : (
            <WhatsAppGlyph size={30} />
          )}
          <span
            style={{
              position: "absolute",
              top: -2,
              right: -2,
              width: 20,
              height: 20,
              borderRadius: "50%",
              background: "#EF4444",
              color: "#fff",
              fontSize: 12,
              fontWeight: 800,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "2px solid #fff",
              boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
            }}
          >
            !
          </span>
        </button>
      )}

      {/* ─── Modal ─── */}
      {open && (
        <>
          <div
            onClick={() => !sending && closeModal()}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: Z_MODAL,
              background: "rgba(7,6,11,0.55)",
              backdropFilter: "blur(3px)",
            }}
          />
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: Z_MODAL + 1,
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
              pointerEvents: "none",
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Hata Bildir"
              onClick={(e) => e.stopPropagation()}
              style={{
                pointerEvents: "auto",
                width: "100%",
                maxWidth: 460,
                maxHeight: "92vh",
                overflowY: "auto",
                background: T.surface,
                color: T.text,
                borderTopLeftRadius: 22,
                borderTopRightRadius: 22,
                border: `1px solid ${T.border}`,
                borderBottom: "none",
                boxShadow: "0 -20px 60px -15px rgba(0,0,0,0.6)",
                animation: "hb-slideup .26s cubic-bezier(0.22,1,0.36,1)",
              }}
            >
              <div
                style={{
                  height: 4,
                  background: `linear-gradient(90deg, ${WA_GREEN}, ${WA_GREEN_DARK})`,
                }}
              />

              <div style={{ padding: "18px 20px 22px" }}>
                {/* Başlık */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 13,
                      flexShrink: 0,
                      background: `${WA_GREEN}1f`,
                      border: `1px solid ${WA_GREEN}55`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <WhatsAppGlyph size={22} color={WA_GREEN} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, lineHeight: 1.2 }}>
                      Hata Bildir
                    </h3>
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: T.textDim }}>
                      Destek hattına iletilir · {phonePretty}
                    </p>
                  </div>
                  <button
                    onClick={() => !sending && closeModal()}
                    aria-label="Kapat"
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 9,
                      border: `1px solid ${T.border}`,
                      background: T.surface2,
                      color: T.textDim,
                      cursor: "pointer",
                      fontSize: 18,
                      lineHeight: 1,
                      flexShrink: 0,
                    }}
                  >
                    ×
                  </button>
                </div>

                {/* Ekran görüntüsü eki */}
                <div style={{ marginBottom: 14 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 6,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: T.textDim,
                        textTransform: "uppercase",
                        letterSpacing: 0.4,
                      }}
                    >
                      📎 Ekran Görüntüsü
                    </span>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={handleRecapture} style={miniBtn}>
                        Yeniden Çek
                      </button>
                      <button onClick={() => fileInputRef.current?.click()} style={miniBtn}>
                        Dosya Ekle
                      </button>
                    </div>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFilePick}
                    style={{ display: "none" }}
                  />
                  {screenshot ? (
                    <div
                      style={{
                        position: "relative",
                        borderRadius: 12,
                        overflow: "hidden",
                        border: `1px solid ${T.border}`,
                        background: "#0b0b0b",
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={screenshot}
                        alt="Ekran görüntüsü"
                        style={{
                          display: "block",
                          width: "100%",
                          maxHeight: 220,
                          objectFit: "contain",
                          background: "#f3f4f6",
                        }}
                      />
                      <button
                        onClick={() => setScreenshot(null)}
                        title="Kaldır"
                        style={{
                          position: "absolute",
                          top: 8,
                          right: 8,
                          width: 28,
                          height: 28,
                          borderRadius: 8,
                          border: "none",
                          background: "rgba(0,0,0,0.6)",
                          color: "#fff",
                          cursor: "pointer",
                          fontSize: 16,
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <div
                      style={{
                        borderRadius: 12,
                        border: `1px dashed ${T.borderStrong}`,
                        padding: "18px 14px",
                        textAlign: "center",
                        color: T.textDim,
                        fontSize: 13,
                      }}
                    >
                      Ekran görüntüsü yok. <b>Yeniden Çek</b> veya <b>Dosya Ekle</b> ile ekleyin.
                    </div>
                  )}
                </div>

                {/* Açıklama */}
                <div style={{ marginBottom: 14 }}>
                  <label
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: T.textDim,
                      textTransform: "uppercase",
                      letterSpacing: 0.4,
                      display: "block",
                      marginBottom: 6,
                    }}
                  >
                    📝 Hata Açıklaması <span style={{ color: "#EF4444" }}>*</span>
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Ne yapıyordunuz? Hata tam olarak nerede / ne zaman oluştu? (örn. 'Eylem kaydederken Kaydet butonu çalışmadı')"
                    rows={4}
                    autoFocus
                    style={{
                      width: "100%",
                      resize: "vertical",
                      minHeight: 90,
                      borderRadius: 12,
                      border: `1px solid ${T.border}`,
                      background: T.surface2,
                      color: T.text,
                      padding: "11px 13px",
                      fontSize: 14,
                      lineHeight: 1.45,
                      outline: "none",
                      fontFamily: "inherit",
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = WA_GREEN;
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = T.border;
                    }}
                  />
                </div>

                {/* Önem derecesi */}
                <div style={{ marginBottom: 14 }}>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: T.textDim,
                      textTransform: "uppercase",
                      letterSpacing: 0.4,
                      display: "block",
                      marginBottom: 6,
                    }}
                  >
                    ⚠️ Önem Derecesi
                  </span>
                  <div style={{ display: "flex", gap: 8 }}>
                    {SEVERITIES.map((s) => {
                      const active = severity === s.key;
                      return (
                        <button
                          key={s.key}
                          onClick={() => setSeverity(s.key)}
                          style={{
                            flex: 1,
                            padding: "9px 6px",
                            borderRadius: 10,
                            cursor: "pointer",
                            fontSize: 13,
                            fontWeight: 700,
                            border: `1.5px solid ${active ? s.color : T.border}`,
                            background: active ? `${s.color}1a` : T.surface2,
                            color: active ? s.color : T.textDim,
                            transition: "all .12s ease",
                          }}
                        >
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Otomatik meta */}
                <div
                  style={{
                    marginBottom: 16,
                    padding: "10px 12px",
                    borderRadius: 10,
                    background: "rgba(255,255,255,0.03)",
                    border: `1px solid ${T.border}`,
                    fontSize: 11.5,
                    color: T.textDim,
                    lineHeight: 1.6,
                  }}
                >
                  <div style={{ display: "flex", gap: 6 }}>
                    <b style={{ minWidth: 54, color: T.textDim }}>Sayfa</b>
                    <span style={{ wordBreak: "break-all" }}>{meta?.pagePath || "—"}</span>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <b style={{ minWidth: 54 }}>Ekran</b>
                    <span>{meta?.screenSize || "—"}</span>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <b style={{ minWidth: 54 }}>Bildiren</b>
                    <span>Admin</span>
                  </div>
                </div>

                {/* Aksiyonlar */}
                <button
                  onClick={handleSend}
                  disabled={sending}
                  style={{
                    width: "100%",
                    padding: "13px",
                    borderRadius: 13,
                    border: "none",
                    cursor: sending ? "wait" : "pointer",
                    background: `linear-gradient(145deg, ${WA_GREEN}, ${WA_GREEN_DARK})`,
                    color: "#fff",
                    fontSize: 15,
                    fontWeight: 800,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                    boxShadow: "0 8px 22px rgba(18,140,126,0.4)",
                    opacity: sending ? 0.7 : 1,
                  }}
                >
                  {sending ? <span style={spinner(18)} /> : <WhatsAppGlyph size={20} />}
                  {sending ? "Kaydediliyor…" : "Kaydet ve WhatsApp'tan Gönder"}
                </button>
                <p
                  style={{
                    margin: "10px 2px 0",
                    fontSize: 11,
                    color: T.textDim,
                    textAlign: "center",
                    lineHeight: 1.5,
                  }}
                >
                  Ekran görüntüsü <b>doğrudan mesaja eklenir</b> — açılan paylaşım
                  ekranından <b>WhatsApp</b>{"'"}ı seçin. Desteklenmeyen cihazlarda görüntü
                  indirilir ve <b>destek hattı ({phonePretty})</b> sohbeti açılır.
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Animasyonlar */}
      <style>{`
        @keyframes hb-spin { to { transform: rotate(360deg); } }
        @keyframes hb-slideup { from { transform: translateY(28px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>
    </div>
  );
}
