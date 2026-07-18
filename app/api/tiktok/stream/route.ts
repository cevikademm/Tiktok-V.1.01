/**
 * TikTok LIVE SSE Endpoint — /api/tiktok/stream
 *
 * Server-Sent Events (SSE) ile TikTok canlı yayın olaylarını istemciye
 * gerçek zamanlı aktarır. Upstream bağlantı (Euler Stream Cloud WebSocket)
 * mantığı `lib/server/eulerstream.ts`'e çıkarıldı; bu route yalnız o modülü
 * SSE'ye köprüleyen ince bir adaptördür (overlay hub ile paylaşılan çekirdek).
 *
 * Kullanım: GET /api/tiktok/stream?username=streamer_name
 * Ortam:   EULER_STREAM_API_KEY (https://www.eulerstream.com — ücretsiz)
 *
 * PRD §6.1: connector → event mapper → SSE → istemci → kural motoru.
 */

import { connectEulerStream } from "@/lib/server/eulerstream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get("username")?.trim().replace(/^@/, "");

  if (!username) {
    return Response.json(
      { error: "username parametresi gereklidir" },
      { status: 400 },
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;

      function send(type: string, data: unknown) {
        if (closed) return;
        try {
          const payload = JSON.stringify({ type, data });
          controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
        } catch {
          // Stream kapalıysa sessizce geç.
        }
      }

      function closeController() {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          // Zaten kapalı.
        }
      }

      const handle = connectEulerStream(username!, {
        onEvent: (eventType, liveEvent) => send("event", { eventType, liveEvent }),
        onStatus: (status, info) => {
          if (status === "connected") send("connected", info ?? {});
          else send("disconnected", info ?? {});
        },
        onError: (message, code) => {
          send("error", { message, code });
          closeController();
        },
      });

      // ── İstemci bağlantıyı kestiğinde temizlik ──
      request.signal.addEventListener("abort", () => {
        handle.close();
        closeController();
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
