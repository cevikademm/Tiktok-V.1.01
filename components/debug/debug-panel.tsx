"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useApp } from "@/components/providers/app-provider";
import { useDebugMode } from "@/lib/use-debug-mode";
import { useOverlayId } from "@/lib/overlay/use-overlay-id";
import { useOverlaySyncStatus } from "@/lib/overlay/sync-status";
import type { LiveEvent } from "@/lib/schemas/live";

/**
 * Hata Ayıklama Paneli — Setup'taki "Hata Ayıklama Modu" toggle'ının tüketicisi.
 *
 * `debugMode` açıkken SPA kabuğunda yüzen bir tanılama katmanı gösterir:
 * bağlantı durumu, canlı olay akışı (gerçek TikTok + simülatör), son dispatch
 * sonucu, overlay sync durumu ve iki test yolu (client bus + sunucu overlay hub).
 * Widget/overlay yüzeylerinde render EDİLMEZ (yalnız (app) kabuğunda mount'lu).
 */

const MAX_EVENTS = 25;

const CONNECTION_COLOR: Record<string, string> = {
  live: "#22c55e",
  connecting: "#eab308",
  error: "#ef4444",
  disconnected: "#9ca3af",
};

function summarize(ev: LiveEvent): string {
  const u = ev.user.uniqueId;
  switch (ev.type) {
    case "gift":
      return `🎁 ${u} · ${ev.giftName ?? ev.giftId ?? "?"} ×${ev.repeatCount ?? 1} (${ev.coins ?? 0}c)${ev.repeatEnd === false ? " …combo" : ""}`;
    case "chat":
      return `💬 ${u}: ${ev.comment ?? ""}`;
    case "like":
      return `❤️ ${u} +${ev.likeCount ?? 0}`;
    case "follow":
      return `➕ ${u}`;
    case "share":
      return `🔁 ${u}`;
    case "subscribe":
      return `⭐ ${u}`;
    case "member":
      return `👋 ${u}`;
    default:
      return `${ev.type} · ${u}`;
  }
}

interface LoggedEvent {
  ts: number;
  text: string;
  key: string;
}

export function DebugPanel() {
  const [enabled] = useDebugMode();
  const t = useTranslations();
  const { backend, connection, lastDispatch, dispatch } = useApp();
  const overlayId = useOverlayId();
  const sync = useOverlaySyncStatus();

  const [events, setEvents] = useState<LoggedEvent[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [minimized, setMinimized] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let n = 0;
    return backend.bus.subscribe((ev) => {
      n += 1;
      const entry: LoggedEvent = { ts: Date.now(), text: summarize(ev), key: `${ev.id}-${n}` };
      setEvents((prev) => [entry, ...prev].slice(0, MAX_EVENTS));
      setCounts((prev) => ({ ...prev, [ev.type]: (prev[ev.type] ?? 0) + 1 }));
    });
  }, [enabled, backend]);

  if (!enabled) return null;

  const simulateClient = () => {
    // Bus yoluna basar → panel + yerel widget'lar (BroadcastChannel).
    const ev = backend.simulator.simulate("gift", { coins: 100 });
    const res = dispatch(ev);
    setNote(t("debugPanel.simulatedClient", { count: res.matchedRules.length }));
  };

  const sendToOverlay = async () => {
    if (!overlayId) return;
    try {
      const res = await fetch("/api/overlay/simulate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: overlayId, kind: "gift", coins: 100 }),
      });
      const data = (await res.json()) as { matched?: number };
      setNote(t("debugPanel.sentOverlay", { count: data.matched ?? 0 }));
    } catch {
      setNote(t("debugPanel.sentOverlayError"));
    }
  };

  const outcomeSummary = lastDispatch
    ? lastDispatch.outcomes.reduce<Record<string, number>>((acc, o) => {
        acc[o.status] = (acc[o.status] ?? 0) + 1;
        return acc;
      }, {})
    : null;

  return (
    <div
      className="fixed right-4 bottom-4 z-[100] flex max-h-[70vh] w-80 flex-col overflow-hidden rounded-[var(--card-radius)] border border-border-subtle bg-surface-1 font-mono text-xs shadow-2xl"
      role="complementary"
      aria-label={t("debugPanel.title")}
    >
      {/* Başlık */}
      <div className="flex items-center gap-2 border-b border-border-subtle px-3 py-2">
        <span
          aria-hidden
          className="inline-block size-2 rounded-full"
          style={{ background: CONNECTION_COLOR[connection] ?? "#9ca3af" }}
        />
        <span className="font-semibold text-white">{t("debugPanel.title")}</span>
        <span className="ml-auto text-muted">{connection}</span>
        <button
          type="button"
          onClick={() => setMinimized((m) => !m)}
          className="rounded px-1.5 text-muted transition-colors hover:text-white"
          aria-label={t(minimized ? "debugPanel.expand" : "debugPanel.minimize")}
        >
          {minimized ? "▢" : "—"}
        </button>
      </div>

      {!minimized && (
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-3">
          {/* Overlay sync + kimlik */}
          <section>
            <div className="mb-1 text-muted">{t("debugPanel.overlaySync")}</div>
            <div className="flex items-center gap-2">
              <span
                style={{
                  color:
                    sync.state === "ok"
                      ? "#22c55e"
                      : sync.state === "error"
                        ? "#ef4444"
                        : "#9ca3af",
                }}
              >
                {sync.state === "ok"
                  ? t("debugPanel.syncOk")
                  : sync.state === "error"
                    ? t("debugPanel.syncError")
                    : t("debugPanel.syncIdle")}
                {sync.httpStatus ? ` (${sync.httpStatus})` : ""}
              </span>
            </div>
            <div className="truncate text-muted" title={overlayId}>
              id: {overlayId ? `${overlayId.slice(0, 8)}…` : "—"}
            </div>
          </section>

          {/* Test butonları */}
          <section className="flex gap-2">
            <button
              type="button"
              onClick={simulateClient}
              className="flex-1 rounded border border-border-subtle bg-white/5 px-2 py-1.5 text-white transition-colors hover:bg-white/10"
            >
              {t("debugPanel.simulate")}
            </button>
            <button
              type="button"
              onClick={() => void sendToOverlay()}
              className="flex-1 rounded border border-border-subtle bg-white/5 px-2 py-1.5 text-white transition-colors hover:bg-white/10"
            >
              {t("debugPanel.sendOverlay")}
            </button>
          </section>
          {note && <div className="text-link">{note}</div>}

          {/* Son dispatch (simülatör motoru) */}
          <section>
            <div className="mb-1 text-muted">{t("debugPanel.lastDispatch")}</div>
            {outcomeSummary ? (
              <div className="text-white">
                {t("debugPanel.matched", { count: lastDispatch?.matchedRules.length ?? 0 })}
                {" · "}
                {Object.entries(outcomeSummary)
                  .map(([k, v]) => `${k}:${v}`)
                  .join(" ")}
              </div>
            ) : (
              <div className="text-muted">—</div>
            )}
          </section>

          {/* Sayaçlar */}
          {Object.keys(counts).length > 0 && (
            <section className="flex flex-wrap gap-x-3 gap-y-0.5 text-muted">
              {Object.entries(counts).map(([type, c]) => (
                <span key={type}>
                  {type}: <span className="text-white">{c}</span>
                </span>
              ))}
            </section>
          )}

          {/* Canlı olay akışı */}
          <section className="flex min-h-0 flex-1 flex-col">
            <div className="mb-1 text-muted">{t("debugPanel.eventStream")}</div>
            {events.length === 0 ? (
              <div className="text-muted">{t("debugPanel.noEvents")}</div>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {events.map((e) => (
                  <li key={e.key} className="truncate text-white/90" title={e.text}>
                    {e.text}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
