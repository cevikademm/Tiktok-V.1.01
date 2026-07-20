/**
 * Overlay test enjeksiyonu — POST /api/overlay/simulate
 *
 * Gerçek TikTok hediyesi olmadan, belirli bir overlay'e sentetik olay enjekte eder
 * (uçtan uca doğrulama). Overlay OBS/sekmede bağlıysa efekt+ses tetiklenir.
 */

import { z } from "zod";
import { injectSynthetic } from "@/lib/server/overlay-hub";
import { simulateEvent } from "@/lib/data/mock/simulator";
import { findGiftById } from "@/lib/data/gift-catalog";
import {
  getAdminSupabase,
  OVERLAY_CONFIG_TABLE,
  type OverlayConfigRow,
} from "@/lib/supabase/admin";
import { simulateOverSupabase } from "@/lib/overlay/simulate-supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["gift", "follow", "share", "subscribe", "likes", "chat", "join"]).default("gift"),
  giftId: z.string().optional(),
  coins: z.number().int().min(1).optional(),
  likes: z.number().int().min(1).optional(),
  comment: z.string().optional(),
});

export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: "Geçersiz JSON gövdesi" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json(
      { error: "validation", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { id, kind, giftId, coins, likes, comment } = parsed.data;

  const ev = simulateEvent(kind, { coins, likes, comment });
  // Belirli hediye istenmişse giftId/isim/coin'i katalogdan uygula.
  if (kind === "gift" && giftId) {
    const gift = findGiftById(giftId);
    ev.giftId = giftId;
    if (gift) {
      ev.giftName = gift.name;
      if (coins === undefined) ev.coins = gift.coins;
    }
  }

  const notRegistered = () =>
    Response.json(
      {
        error: "not_registered",
        message:
          "Bu id için kayıtlı overlay yok. Önce panelde kural kurup senkronlayın.",
      },
      { status: 404 },
    );

  // Hibrit mod (ADR-0003): Supabase yapılandırılmışsa config'i overlay_configs'ten
  // okuyup motoru çalıştır ve eşleşeni Supabase Realtime'a yayınla (register ile
  // simetrik transport seçimi). Değilse bellek-içi SSE hub'a enjekte et (yerel).
  const supabase = getAdminSupabase();
  if (supabase) {
    const { data, error } = await supabase
      .from(OVERLAY_CONFIG_TABLE)
      .select("id, username, actions, events, screens")
      .eq("id", id)
      .maybeSingle();
    if (error) {
      return Response.json(
        { error: "supabase", message: error.message },
        { status: 500 },
      );
    }
    if (!data) return notRegistered();

    const supabaseUrl =
      process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
    const result = await simulateOverSupabase(
      supabaseUrl,
      serviceKey,
      data as OverlayConfigRow,
      ev,
    );

    return Response.json({
      ok: true,
      transport: "supabase",
      matched: result.matched,
      broadcast: result.broadcast,
      event: { type: ev.type, giftId: ev.giftId, coins: ev.coins },
    });
  }

  const result = injectSynthetic(id, ev);
  if (!result) return notRegistered();

  return Response.json({
    ok: true,
    transport: "hub",
    matched: result.matchedRules.length,
    outcomes: result.outcomes.map((o) => o.status),
    event: { type: ev.type, giftId: ev.giftId, coins: ev.coins },
  });
}
