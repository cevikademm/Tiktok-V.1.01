/**
 * Sim­üle olayını Supabase/hibrit transport'unda çalıştırır (yalnız SUNUCU).
 *
 * Panelin "Olay Simülatörü" ve ekran-başı "Test" butonları gerçek TikTok olayı
 * beklemeden bir sentetik olay üretir. Supabase modunda config `overlay_configs`
 * satırındadır (connector oradan okur), fakat sentetik olay connector'a enjekte
 * edilemez — bu yüzden burada tek-atışlık bir `RuleEngine` kurup eşleşen action'ı
 * doğrudan Supabase Realtime'a yayınlarız. Connector'ın canlı-olay yolunun (ADR-0003)
 * bire bir eşdeğeri; widget'a giden mesaj `buildActionMessage` ile aynıdır.
 */

import { RuleEngine } from "@/lib/engine";
import { buildActionMessage } from "@/lib/overlay/action-message";
import { broadcastToChannel } from "@/lib/overlay/broadcast";
import { overlayChannel } from "@/lib/overlay/realtime";
import type { Action } from "@/lib/schemas/action";
import type { StreamEvent } from "@/lib/schemas/event";
import type { LiveEvent } from "@/lib/schemas/live";
import type { OverlayConfigRow } from "@/lib/supabase/admin";

export interface SimulateSupabaseResult {
  /** Olayla eşleşen kural (event) sayısı. */
  matched: number;
  /** Başarıyla yayınlanan action mesajı sayısı. */
  broadcast: number;
}

export async function simulateOverSupabase(
  supabaseUrl: string,
  serviceKey: string,
  row: OverlayConfigRow,
  ev: LiveEvent,
): Promise<SimulateSupabaseResult> {
  const engine = new RuleEngine(
    {
      getActions: () => (row.actions ?? []) as Action[],
      getEvents: () => (row.events ?? []) as StreamEvent[],
      // Connector gibi: sunucu presence bilmez → her zaman eşleştir; kimse
      // dinlemiyorsa broadcast no-op olur.
      requireOnlineScreen: false,
    },
    (row.screens ?? []).map((s) => ({
      screen: s.screen,
      maxQueueLength: s.maxQueueLength,
    })),
  );

  const result = engine.dispatch(ev);
  let broadcast = 0;
  for (const outcome of result.outcomes) {
    if (outcome.status !== "queued") continue;
    const { action, item } = outcome;
    const ok = await broadcastToChannel(
      supabaseUrl,
      serviceKey,
      overlayChannel(row.id, action.screen),
      buildActionMessage(action, item.queueId, ev),
    );
    if (ok) broadcast += 1;
  }

  return { matched: result.matchedRules.length, broadcast };
}
