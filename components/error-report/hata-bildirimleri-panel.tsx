"use client";

/**
 * ─── Hata Bildirimleri Paneli (Admin) ───────────────────────────────
 * Mock store'daki error kayıtlarını listeler: ekran görüntüsü, açıklama,
 * önem, durum. Admin durumu değiştirir, görüntüyü büyütür, WhatsApp'tan iletir.
 * İki görünüm: "🗂 Liste" (detay kartları) ve "🖼 Galeri" (yalnız ekran
 * görüntülerinin yoğun ızgarası — tıklayınca büyür).
 *
 * Route: app/[locale]/(app)/hata-bildirimleri/page.tsx
 * FAB/gönderim: components/error-report/hata-bildir-widget.tsx
 */

import { useState, type CSSProperties } from "react";
import { buildWhatsAppText, openWhatsApp } from "@/lib/error-report/client";
import {
  removeErrorReport,
  setErrorReportStatus,
  useErrorReports,
  useIsErrorAdmin,
} from "@/lib/error-report/store";
import type { ErrorReport, ErrorSeverity, ErrorStatus } from "@/lib/error-report/types";

/** Koyu tema yüzey token'ları (globals.css) — bileşende ham hex yok. */
const T = {
  surface: "var(--surface-2)",
  surface2: "var(--surface-3)",
  border: "var(--border-soft)",
  borderStrong: "var(--border-maroon)",
  text: "var(--foreground)",
  textDim: "var(--text-muted)",
  primary: "var(--primary)",
} as const;

const SEV: Record<ErrorSeverity, { label: string; color: string }> = {
  low: { label: "Düşük", color: "#16A34A" },
  normal: { label: "Normal", color: "#F59E0B" },
  high: { label: "Yüksek/Acil", color: "#EF4444" },
};

const STATUS: Record<ErrorStatus, { label: string; color: string }> = {
  new: { label: "Yeni", color: "#EF4444" },
  in_progress: { label: "İnceleniyor", color: "#F59E0B" },
  resolved: { label: "Çözüldü", color: "#16A34A" },
};

type FilterKey = "all" | ErrorStatus;
const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: "all", label: "Tümü" },
  { key: "new", label: "Yeni" },
  { key: "in_progress", label: "İnceleniyor" },
  { key: "resolved", label: "Çözüldü" },
];

/** Panel görünümü: kart listesi ya da ekran görüntüsü galerisi. */
type ViewMode = "list" | "gallery";
const VIEWS: Array<{ key: ViewMode; label: string }> = [
  { key: "list", label: "🗂 Liste" },
  { key: "gallery", label: "🖼 Galeri" },
];

/** screenshotData'sı olan kayıt (galeri tip daraltması). */
type ReportWithShot = ErrorReport & { screenshotData: string };

const fmtDate = (s: string): string => {
  try {
    return new Date(s).toLocaleString("tr-TR");
  } catch {
    return s || "";
  }
};

const badge = (color: string): CSSProperties => ({
  fontSize: 11,
  fontWeight: 800,
  padding: "3px 9px",
  borderRadius: 999,
  background: `${color}1a`,
  color,
  border: `1px solid ${color}44`,
});

const actBtn = (color: string): CSSProperties => ({
  padding: "6px 11px",
  borderRadius: 9,
  cursor: "pointer",
  fontSize: 12.5,
  fontWeight: 700,
  border: `1px solid ${color}55`,
  background: `${color}12`,
  color,
});

export function HataBildirimleriPanel() {
  const isAdmin = useIsErrorAdmin();
  const reports = useErrorReports();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [view, setView] = useState<ViewMode>("list");
  const [zoom, setZoom] = useState<string | null>(null);

  // Panel yalnızca admin modunda içerik gösterir (FAB ile aynı kapı).
  if (!isAdmin) {
    return (
      <div
        style={{
          padding: "48px 20px",
          textAlign: "center",
          color: T.textDim,
          border: `1px dashed ${T.border}`,
          borderRadius: 16,
        }}
      >
        <div style={{ fontSize: 40, marginBottom: 8 }}>🔒</div>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: T.text }}>
          Bu alan yalnızca yöneticiler içindir.
        </p>
        <p style={{ margin: "6px 0 0", fontSize: 13 }}>
          Admin modu kapalı.
        </p>
      </div>
    );
  }

  const filtered =
    filter === "all" ? reports : reports.filter((r) => r.status === filter);

  const counts: Record<FilterKey, number> = {
    all: reports.length,
    new: reports.filter((r) => r.status === "new").length,
    in_progress: reports.filter((r) => r.status === "in_progress").length,
    resolved: reports.filter((r) => r.status === "resolved").length,
  };

  // Galeri: aktif filtredeki, ekran görüntüsü olan kayıtlar.
  const galleryItems = filtered.filter(
    (r): r is ReportWithShot => Boolean(r.screenshotData),
  );

  const setStatus = (id: string, status: ErrorStatus) => setErrorReportStatus(id, status);

  const remove = (id: string) => {
    if (!window.confirm("Bu hata bildirimini silmek istediğinize emin misiniz?")) return;
    removeErrorReport(id);
  };

  const imgSrc = (r: ErrorReport): string | null => r.screenshotData;

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, color: T.text }}>
          🐞 Hata Bildirimleri
        </h1>
        <p style={{ margin: "4px 0 0", color: T.textDim, fontSize: 14 }}>
          WhatsApp ile iletilen hatalar, ekran görüntüsü ve açıklamasıyla burada toplanır.
          Sağ üstten <b>Galeri</b> görünümüne geçerek yalnız ekran görüntülerini görebilirsiniz.
        </p>
      </div>

      {/* Filtre sekmeleri + görünüm geçişi (Liste / Galeri) */}
      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 18,
        }}
      >
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                style={{
                  padding: "7px 14px",
                  borderRadius: 999,
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 700,
                  border: `1.5px solid ${active ? T.primary : T.border}`,
                  background: active
                    ? "color-mix(in srgb, var(--primary) 14%, transparent)"
                    : T.surface,
                  color: active ? T.text : T.textDim,
                }}
              >
                {f.label} <span style={{ opacity: 0.7 }}>({counts[f.key]})</span>
              </button>
            );
          })}
        </div>

        {/* Görünüm: 🗂 Liste | 🖼 Galeri */}
        <div
          role="tablist"
          aria-label="Görünüm"
          style={{
            display: "flex",
            border: `1px solid ${T.border}`,
            borderRadius: 10,
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          {VIEWS.map((v) => {
            const active = view === v.key;
            const badgeCount = v.key === "gallery" ? galleryItems.length : filtered.length;
            return (
              <button
                key={v.key}
                role="tab"
                aria-selected={active}
                onClick={() => setView(v.key)}
                style={{
                  padding: "7px 14px",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 700,
                  border: "none",
                  background: active
                    ? "color-mix(in srgb, var(--primary) 16%, transparent)"
                    : T.surface,
                  color: active ? T.text : T.textDim,
                }}
              >
                {v.label} <span style={{ opacity: 0.7 }}>({badgeCount})</span>
              </button>
            );
          })}
        </div>
      </div>

      {view === "gallery" ? (
        /* ─── Galeri: yalnız ekran görüntüleri (yoğun ızgara) ─── */
        galleryItems.length === 0 ? (
          <div
            style={{
              padding: "48px 20px",
              textAlign: "center",
              color: T.textDim,
              border: `1px dashed ${T.border}`,
              borderRadius: 16,
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 8 }}>🖼️</div>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: T.text }}>
              Bu filtrede ekran görüntülü hata yok.
            </p>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
            }}
          >
            {galleryItems.map((r) => {
              const sev = SEV[r.severity] ?? SEV.normal;
              const st = STATUS[r.status] ?? STATUS.new;
              return (
                <button
                  key={r.id}
                  onClick={() => setZoom(r.screenshotData)}
                  title={`Büyüt — ${fmtDate(r.createdAt)}`}
                  style={{
                    position: "relative",
                    padding: 0,
                    border: `1px solid ${T.border}`,
                    borderRadius: 12,
                    overflow: "hidden",
                    cursor: "zoom-in",
                    background: "#0b0b0b",
                    display: "block",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={r.screenshotData}
                    alt={`Hata ekran görüntüsü — ${fmtDate(r.createdAt)}`}
                    style={{ display: "block", width: "100%", height: 130, objectFit: "cover" }}
                  />
                  {/* Durum rozeti (sol üst) */}
                  <span
                    style={{
                      position: "absolute",
                      top: 8,
                      left: 8,
                      fontSize: 10,
                      fontWeight: 800,
                      padding: "2px 8px",
                      borderRadius: 999,
                      background: st.color,
                      color: "#fff",
                    }}
                  >
                    {st.label}
                  </span>
                  {/* Alt caption: önem + tarih */}
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      bottom: 0,
                      padding: "16px 8px 6px",
                      background: "linear-gradient(transparent, rgba(0,0,0,0.8))",
                      color: "#fff",
                      fontSize: 10.5,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <span style={{ color: sev.color, fontWeight: 800 }}>{sev.label}</span>
                    <span style={{ opacity: 0.85, fontWeight: 600 }}>
                      {new Date(r.createdAt).toLocaleDateString("tr-TR")}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )
      ) : filtered.length === 0 ? (
        <div
          style={{
            padding: "48px 20px",
            textAlign: "center",
            color: T.textDim,
            border: `1px dashed ${T.border}`,
            borderRadius: 16,
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 8 }}>🎉</div>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: T.text }}>
            Bu filtrede hata bildirimi yok.
          </p>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gap: 14,
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          }}
        >
          {filtered.map((r) => {
            const sev = SEV[r.severity] ?? SEV.normal;
            const st = STATUS[r.status] ?? STATUS.new;
            const src = imgSrc(r);
            return (
              <div
                key={r.id}
                style={{
                  borderRadius: 16,
                  border: `1px solid ${T.border}`,
                  background: T.surface,
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                }}
              >
                {/* Görüntü */}
                {src ? (
                  <button
                    onClick={() => setZoom(src)}
                    title="Büyüt"
                    style={{
                      border: "none",
                      padding: 0,
                      cursor: "zoom-in",
                      background: "#0b0b0b",
                      display: "block",
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={src}
                      alt="Hata ekran görüntüsü"
                      style={{ display: "block", width: "100%", height: 160, objectFit: "cover" }}
                    />
                  </button>
                ) : (
                  <div
                    style={{
                      height: 160,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: T.surface2,
                      color: T.textDim,
                      fontSize: 13,
                    }}
                  >
                    Ekran görüntüsü yok
                  </div>
                )}

                <div
                  style={{
                    padding: 14,
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    flex: 1,
                  }}
                >
                  {/* Rozetler */}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                    <span style={badge(st.color)}>{st.label}</span>
                    <span style={badge(sev.color)}>{sev.label}</span>
                    <span style={{ marginLeft: "auto", fontSize: 11.5, color: T.textDim }}>
                      {fmtDate(r.createdAt)}
                    </span>
                  </div>

                  {/* Açıklama */}
                  <p
                    style={{
                      margin: 0,
                      fontSize: 14,
                      color: T.text,
                      lineHeight: 1.5,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {r.description}
                  </p>

                  {/* Meta */}
                  <div
                    style={{
                      fontSize: 11.5,
                      color: T.textDim,
                      lineHeight: 1.6,
                      borderTop: `1px solid ${T.border}`,
                      paddingTop: 8,
                    }}
                  >
                    <div>
                      <b>Sayfa:</b> {r.pagePath || "—"}
                    </div>
                    <div>
                      <b>Bildiren:</b> {r.reporterName || "—"}
                    </div>
                    <div>
                      <b>Ekran:</b> {r.screenSize || "—"}
                    </div>
                  </div>

                  {/* Aksiyonlar */}
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      flexWrap: "wrap",
                      marginTop: "auto",
                      paddingTop: 4,
                    }}
                  >
                    {r.status !== "in_progress" && r.status !== "resolved" && (
                      <button onClick={() => setStatus(r.id, "in_progress")} style={actBtn("#F59E0B")}>
                        İncele
                      </button>
                    )}
                    {r.status !== "resolved" && (
                      <button onClick={() => setStatus(r.id, "resolved")} style={actBtn("#16A34A")}>
                        Çözüldü
                      </button>
                    )}
                    {r.status === "resolved" && (
                      <button onClick={() => setStatus(r.id, "new")} style={actBtn("#949494")}>
                        Yeniden Aç
                      </button>
                    )}
                    <button onClick={() => openWhatsApp(buildWhatsAppText(r))} style={actBtn("#128C7E")}>
                      WhatsApp
                    </button>
                    {r.pageUrl && (
                      <button
                        onClick={() => window.open(r.pageUrl ?? "", "_blank", "noopener")}
                        style={actBtn("#949494")}
                      >
                        Sayfaya Git
                      </button>
                    )}
                    <button onClick={() => remove(r.id)} style={actBtn("#EF4444")} title="Sil">
                      Sil
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Görüntü büyütme */}
      {zoom && (
        <div
          onClick={() => setZoom(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 2147482000,
            background: "rgba(0,0,0,0.82)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            cursor: "zoom-out",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={zoom}
            alt="Hata ekran görüntüsü (büyük)"
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              borderRadius: 10,
              boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
            }}
          />
          <button
            onClick={() => setZoom(null)}
            aria-label="Kapat"
            style={{
              position: "fixed",
              top: 18,
              right: 18,
              width: 40,
              height: 40,
              borderRadius: 10,
              border: "none",
              background: "rgba(255,255,255,0.15)",
              color: "#fff",
              fontSize: 22,
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
