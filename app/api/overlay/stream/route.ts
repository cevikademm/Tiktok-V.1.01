/**
 * Overlay SSE Endpoint — /api/overlay/stream?id=<overlayId>&screen=N
 *
 * OBS / TikTok LIVE Studio browser source'un bağlandığı gerçek zamanlı kanal.
 * Sunucu-otoriteli hub (`lib/server/overlay-hub.ts`) eşleşen action komutlarını
 * `widgetInbound` mesajı olarak bu akışa push eder (ADR-0002).
 */

import { subscribe } from "@/lib/server/overlay-hub";
import { SCREEN_MAX, SCREEN_MIN } from "@/lib/schemas/action";
import type { WidgetInbound } from "@/lib/schemas/widget";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clampScreen(raw: string | null): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return SCREEN_MIN;
  return Math.min(SCREEN_MAX, Math.max(SCREEN_MIN, Math.trunc(n)));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id")?.trim();
  if (!id) {
    return Response.json({ error: "id parametresi gereklidir" }, { status: 400 });
  }
  const screen = clampScreen(searchParams.get("screen"));

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;

      const send = (msg: WidgetInbound) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(msg)}\n\n`));
        } catch {
          // Stream kapalıysa sessizce geç.
        }
      };

      // İlk flush — proxy tamponunu aç ve bağlantıyı doğrula.
      send({ kind: "heartbeat", ts: Date.now() });

      const unsubscribe = subscribe(id, screen, send);

      request.signal.addEventListener("abort", () => {
        closed = true;
        unsubscribe();
        try {
          controller.close();
        } catch {
          // Zaten kapalı.
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
