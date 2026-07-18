"use client";

import { useEffect } from "react";
import { getOverlayId } from "@/lib/overlay/identity";
import { setOverlaySyncStatus } from "@/lib/overlay/sync-status";
import type { DataBackend } from "@/lib/data/ports";
import type { Action } from "@/lib/schemas/action";
import type { StreamEvent, StreamTimer } from "@/lib/schemas/event";
import type { ConnectionState } from "@/lib/schemas/live";

/**
 * Dashboard → sunucu config sync — ADR-0002/0005.
 *
 * Kullanıcının kuralları (actions/events), zamanlayıcıları (timers), bağlı TikTok
 * username'i ve ekran ayarları değiştikçe (debounced) `/api/overlay/register`'a
 * POST'lanır; böylece sunucudaki kural motorunun kopyası daima günceldir ve
 * overlay + zamanlayıcılar, dashboard KAPALIYKEN bile çalışır.
 */
export function useOverlaySync(
  backend: DataBackend,
  actions: Action[],
  events: StreamEvent[],
  timers: StreamTimer[],
  connection: ConnectionState,
): void {
  useEffect(() => {
    const id = getOverlayId();
    if (!id) return;

    const timer = setTimeout(() => {
      void (async () => {
        try {
          const [settings, screens] = await Promise.all([
            backend.settings.get(),
            backend.screens.list(),
          ]);
          const res = await fetch("/api/overlay/register", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              id,
              username: settings.tiktok?.username ?? "",
              actions,
              events,
              timers,
              screens: screens.map((s) => ({
                screen: s.screen,
                maxQueueLength: s.maxQueueLength,
              })),
            }),
          });
          setOverlaySyncStatus({
            state: res.ok ? "ok" : "error",
            httpStatus: res.status,
            ts: Date.now(),
          });
        } catch (e) {
          // Sync best-effort; başarısızlık dashboard'u etkilemez.
          setOverlaySyncStatus({ state: "error", ts: Date.now(), message: String(e) });
        }
      })();
    }, 600);

    return () => clearTimeout(timer);
    // `connection` de dep: hesap bağlanınca username değişir → yeniden sync.
  }, [backend, actions, events, timers, connection]);
}
