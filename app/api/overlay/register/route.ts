/**
 * Overlay config sync — POST /api/overlay/register
 *
 * Dashboard, kullanıcının kurallarını (actions/events) + bağlı TikTok username'i
 * + ekran ayarlarını sunucudaki hub'a yükler. Sunucu bu kopyayı motorunda çalıştırır
 * (ADR-0002). Auth henüz yok — `id` tahmin-edilemez UUID token ile korunur.
 */

import { z } from "zod";
import { upsertOverlay } from "@/lib/server/overlay-hub";
import {
  OVERLAY_CONFIG_TABLE,
  getAdminSupabase,
} from "@/lib/supabase/admin";
import { actionSchema } from "@/lib/schemas/action";
import { eventSchema, timerSchema } from "@/lib/schemas/event";
import { overlayScreenSchema } from "@/lib/schemas/widget";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  id: z.string().uuid(),
  username: z.string().trim().max(64).default(""),
  actions: z.array(actionSchema).default([]),
  events: z.array(eventSchema).default([]),
  timers: z.array(timerSchema).default([]),
  screens: z
    .array(
      overlayScreenSchema.pick({ screen: true, maxQueueLength: true }),
    )
    .default([]),
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

  const { id, username, actions, events, timers, screens } = parsed.data;
  const cleanUsername = username.replace(/^@/, "");
  const cleanScreens = screens.map((s) => ({
    screen: s.screen,
    maxQueueLength: s.maxQueueLength,
  }));

  // Hibrit mod (ADR-0003): Supabase yapılandırılmışsa config'i overlay_configs'e
  // yaz (connector worker oradan okur). Değilse bellek-içi SSE hub'a yaz (yerel).
  const supabase = getAdminSupabase();
  if (supabase) {
    const { error } = await supabase.from(OVERLAY_CONFIG_TABLE).upsert(
      {
        id,
        username: cleanUsername,
        actions,
        events,
        timers,
        screens: cleanScreens,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
    if (error) {
      return Response.json(
        { error: "supabase", message: error.message },
        { status: 500 },
      );
    }
    return Response.json({ ok: true, transport: "supabase" });
  }

  upsertOverlay({
    id,
    username: cleanUsername,
    actions,
    events,
    timers,
    screens: cleanScreens,
  });
  return Response.json({ ok: true, transport: "hub" });
}
