/**
 * Eşleşen action → widget kablo mesajı (`WidgetInbound`) dönüştürücü.
 *
 * Hem SSE hub'ı (lib/server/overlay-hub.ts) hem de connector worker
 * (connector/index.ts) BU fonksiyonu kullanır — iki taşıma katmanı da widget'a
 * BİREBİR aynı mesajı gönderir (ADR-0003). Saf TS; DOM/Node bağımlılığı yok.
 */

import { renderPlaceholders } from "@/lib/engine";
import type { Action } from "@/lib/schemas/action";
import type { LiveEvent } from "@/lib/schemas/live";
import type { WidgetInbound } from "@/lib/schemas/widget";

export function buildActionMessage(
  action: Action,
  queueId: string,
  ev: LiveEvent,
): WidgetInbound {
  return {
    kind: "action",
    payload: {
      actionId: action.id,
      queueId,
      durationSec: action.durationSec,
      types: action.types,
      text: action.config.text
        ? renderPlaceholders(action.config.text, { event: ev })
        : undefined,
      textColor: action.config.textColor,
      mediaUrl: action.config.mediaUrl,
      volume: action.volume,
      fadeInMs: action.fadeInMs,
      fadeOutMs: action.fadeOutMs,
      animationId: action.config.animationId,
    },
  };
}
