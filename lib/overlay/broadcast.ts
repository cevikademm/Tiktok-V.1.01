/**
 * Overlay Realtime Broadcast — paylaşılan HTTP yayıncısı (ADR-0003).
 *
 * Supabase Realtime'a durumsuz HTTP POST ile yayın yapar. Hem connector worker
 * (connector/index.ts) hem de /api/overlay/simulate rotası bunu kullanır — böylece
 * hangi tetikleyici olursa olsun (gerçek TikTok olayı veya sim­üle) widget'a
 * BİREBİR aynı `action` mesajı gider.
 *
 * Yalnız SUNUCU tarafında çağrılır: global `fetch` (Node ≥ 18) + SERVICE ROLE key
 * gerektirir. Anon key ile broadcast REST ucu reddedilir.
 */

import { OVERLAY_BROADCAST_EVENT } from "@/lib/overlay/realtime";

/**
 * Tek bir action mesajını `topic` (overlay-<id>-<screen>) kanalına yayınlar.
 * @returns Yayın başarılıysa `true`; ağ/HTTP hatasında `false` (best-effort).
 */
export async function broadcastToChannel(
  supabaseUrl: string,
  serviceKey: string,
  topic: string,
  payload: unknown,
): Promise<boolean> {
  if (!supabaseUrl || !serviceKey) return false;
  try {
    const res = await fetch(`${supabaseUrl}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        messages: [{ topic, event: OVERLAY_BROADCAST_EVENT, payload }],
      }),
    });
    if (!res.ok) {
      console.warn(`[broadcast] ${topic} → HTTP ${res.status}`);
      return false;
    }
    return true;
  } catch (err) {
    console.warn(`[broadcast] hata (${topic}):`, err);
    return false;
  }
}
