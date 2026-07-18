"use client";

import { useEffect } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import {
  OVERLAY_BROADCAST_EVENT,
  isSupabaseConfigured,
  overlayChannel,
  overlayPresenceChannel,
} from "@/lib/overlay/realtime";
import { widgetInboundSchema } from "@/lib/schemas/widget";
import { ActionRenderer, useActionPlayer } from "./action-player";

/**
 * Sunucu-otoriteli overlay'i — ADR-0002 / ADR-0003.
 *
 * OBS / TikTok LIVE Studio browser source olarak eklenir:
 *   /widget/myactions?id=<overlayId>&screen=N
 *
 * İki taşıma katmanı (feature flag ile seçilir):
 *   • Supabase yapılandırılmışsa → **Supabase Realtime Broadcast** (hibrit/Vercel).
 *     Connector worker eşleşen action'ı `overlay-<id>-<screen>` kanalına yayınlar.
 *   • Aksi halde → **SSE** (`/api/overlay/stream`) — yerel/tek-süreç hub (ADR-0002).
 *
 * Her iki yolda da mesaj BİREBİR aynı `widgetInbound` "action" şemasıdır; bu
 * bileşen yalnız render eder (kural motoru sunucuda/connector'da).
 *
 * Autoplay notu: OBS CEF'te ses autoplay çalışır; normal tarayıcı sekmesinde
 * ilk kullanıcı etkileşimi gerekebilir.
 */
export function RemoteOverlay({ id, screen }: { id: string; screen: number }) {
  const { current, fading, push } = useActionPlayer();

  useEffect(() => {
    // ── Hibrit: Supabase Realtime Broadcast + Presence ──
    if (isSupabaseConfigured()) {
      const supabase = getBrowserSupabase();
      if (supabase) {
        const channel = supabase
          .channel(overlayChannel(id, screen), {
            config: { broadcast: { self: false } },
          })
          .on(
            "broadcast",
            { event: OVERLAY_BROADCAST_EVENT },
            ({ payload }) => {
              const parsed = widgetInboundSchema.safeParse(payload);
              if (parsed.success && parsed.data.kind === "action") {
                push(parsed.data.payload);
              }
            },
          )
          .subscribe();

        // Presence: bu ekranın "çevrimiçi" olduğunu panele bildir (ADR-0003).
        // Bağlantı düşünce Supabase presence'ı otomatik "leave" yayar → panel kırmızıya döner.
        const presence = supabase.channel(overlayPresenceChannel(id));
        presence.subscribe((status) => {
          if (status === "SUBSCRIBED") void presence.track({ screen });
        });

        return () => {
          void supabase.removeChannel(channel);
          void supabase.removeChannel(presence);
        };
      }
    }

    // ── Yerel: SSE hub ──
    const url = `/api/overlay/stream?id=${encodeURIComponent(id)}&screen=${screen}`;
    const es = new EventSource(url);
    es.onmessage = (e) => {
      let msg;
      try {
        msg = widgetInboundSchema.parse(JSON.parse(e.data));
      } catch {
        return; // Bozuk/tanınmayan mesaj — yut.
      }
      if (msg.kind === "action") push(msg.payload);
      // heartbeat / widgetSettings / stateSync: şimdilik yok sayılır.
    };
    // Hata durumunda EventSource kendiliğinden yeniden bağlanır.
    return () => es.close();
  }, [id, screen, push]);

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-transparent">
      {current && <ActionRenderer action={current} fading={fading} />}
    </div>
  );
}
