"use client";

import { useEffect, useState } from "react";
import {
  isSupabaseConfigured,
  overlayPresenceChannel,
} from "@/lib/overlay/realtime";
import { getBrowserSupabase } from "@/lib/supabase/browser";

/**
 * Bir overlay için ŞU AN çevrimiçi (OBS/tarayıcı kaynağı bağlı) Screen 1-8 seti.
 *
 * İki taşıma katmanı — `RemoteOverlay` ile aynı feature-flag seçimi:
 *   • Supabase yapılandırılmışsa → **Realtime Presence** (`overlay-<id>-presence`).
 *     Her widget bağlanınca `track({ screen })` yapar; sync/join/leave anlık gelir.
 *   • Aksi halde → **SSE hub durum poll'u** (`GET /api/overlay/status?id=`), ~4sn.
 *
 * Panel bu seti okuyarak durum sütununu ("Çevrimiçi"/"Çevrimdışı") canlı boyar.
 */

const POLL_MS = 4000;

export function useScreenPresence(overlayId: string | null): Set<number> {
  const [online, setOnline] = useState<Set<number>>(() => new Set());

  useEffect(() => {
    // overlayId henüz hidrasyon bekliyor (null): başlangıç durumu zaten boş set;
    // senkron setState effect gövdesinde önerilmez → yalnızca çıkarız.
    if (!overlayId) return;

    // ── Hibrit: Supabase Realtime Presence ──
    if (isSupabaseConfigured()) {
      const supabase = getBrowserSupabase();
      if (supabase) {
        const channel = supabase.channel(overlayPresenceChannel(overlayId));

        const sync = () => {
          const next = new Set<number>();
          const stateObj = channel.presenceState<{ screen: number }>();
          for (const metas of Object.values(stateObj)) {
            for (const meta of metas) {
              if (typeof meta.screen === "number") next.add(meta.screen);
            }
          }
          setOnline(next);
        };

        channel
          .on("presence", { event: "sync" }, sync)
          .on("presence", { event: "join" }, sync)
          .on("presence", { event: "leave" }, sync)
          .subscribe();

        return () => {
          void supabase.removeChannel(channel);
        };
      }
    }

    // ── Yerel: SSE hub durum poll'u ──
    let alive = true;
    const poll = async () => {
      try {
        const res = await fetch(
          `/api/overlay/status?id=${encodeURIComponent(overlayId)}`,
          { cache: "no-store" },
        );
        if (!res.ok) return;
        const data = (await res.json()) as { online?: number[] };
        if (alive) setOnline(new Set(data.online ?? []));
      } catch {
        // Ağ hatası — bir sonraki poll'da tekrar denenir.
      }
    };
    void poll();
    const timer = setInterval(() => void poll(), POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [overlayId]);

  return online;
}
