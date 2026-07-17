/**
 * TikTok LIVE SSE Endpoint — /api/tiktok/stream
 *
 * Server-Sent Events (SSE) ile TikTok canlı yayın olaylarını istemciye
 * gerçek zamanlı aktarır. Sunucu, Euler Stream'in **Cloud WebSocket**'ine
 * (wss://ws.eulerstream.com) bağlanır — bu yol ücretsiz katmanda çalışır
 * (25 eşzamanlı WebSocket / 2500 istek/gün) ve TikTok'un ücretli "Webcast
 * Signature" imza eklentisini GEREKTİRMEZ.
 *
 * Kullanım: GET /api/tiktok/stream?username=streamer_name
 * Ortam:   EULER_STREAM_API_KEY (https://www.eulerstream.com — ücretsiz)
 *
 * PRD §6.1: connector → event mapper → SSE → istemci → kural motoru.
 */

import { mapTikTokEvent } from "@/lib/tiktok/event-mapper";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CLOUD_WS_URL = "wss://ws.eulerstream.com";

/**
 * Euler Cloud WebSocket mesaj tipi → projenin iç olay tipi (event-mapper case'leri).
 * WebcastSocialMessage (follow/share) tek tip gelir; ayrımı aşağıda displayType/action ile yaparız.
 */
const EVENT_TYPE_MAP: Record<string, string> = {
  WebcastChatMessage: "chat",
  WebcastGiftMessage: "gift",
  WebcastMemberMessage: "member",
  WebcastLikeMessage: "like",
  WebcastEmoteChatMessage: "emote",
  WebcastEnvelopeMessage: "envelope",
  WebcastSubNotifyMessage: "subscribe",
  WebcastRoomUserSeqMessage: "roomUser",
};

/** Euler Cloud WebSocket'ten gelen tek bir mesaj. */
interface CloudMessage {
  type: string;
  data?: {
    roomInfo?: { isLive?: boolean; status?: number; id?: string | number };
    action?: number;
    common?: { displayText?: { displayType?: string } };
    [k: string]: unknown;
  };
}
interface CloudFrame {
  messages?: CloudMessage[];
  type?: string;
  data?: CloudMessage["data"];
}

/** WebcastSocialMessage'ı follow/share olarak ayırır. */
function resolveSocialType(data: CloudMessage["data"]): "follow" | "share" | null {
  const dt = (data?.common?.displayText?.displayType ?? "").toLowerCase();
  const action = data?.action;
  if (dt.includes("follow") || action === 1) return "follow";
  if (dt.includes("share") || action === 3) return "share";
  return null;
}

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
      let connectedSent = false;

      /** SSE formatında mesaj gönderir. */
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

      const apiKey = process.env.EULER_STREAM_API_KEY?.trim();
      if (!apiKey) {
        send("error", {
          message:
            "EULER_STREAM_API_KEY tanımlı değil. https://www.eulerstream.com " +
            "adresinden ücretsiz bir anahtar alıp .env.local'e ekleyin ve sunucuyu yeniden başlatın.",
          code: "SIGN_KEY_REQUIRED",
        });
        closeController();
        return;
      }

      // Node 22+ (bu proje Node 24) global WebSocket sağlar.
      const WS = (globalThis as { WebSocket?: typeof WebSocket }).WebSocket;
      if (!WS) {
        send("error", {
          message: "Sunucu ortamında WebSocket bulunamadı (Node 22+ gerekir).",
          code: "NO_WEBSOCKET",
        });
        closeController();
        return;
      }

      const url =
        `${CLOUD_WS_URL}?uniqueId=${encodeURIComponent(username)}` +
        `&apiKey=${encodeURIComponent(apiKey)}`;
      const ws = new WS(url);

      ws.onmessage = (event: MessageEvent) => {
        let frame: CloudFrame;
        try {
          frame = JSON.parse(
            typeof event.data === "string" ? event.data : String(event.data),
          ) as CloudFrame;
        } catch {
          return;
        }

        const messages = frame.messages ?? (frame.type ? [frame as CloudMessage] : []);

        for (const msg of messages) {
          const { type, data } = msg;

          // ── Kontrol / oda bilgisi ──
          if (type === "roomInfo") {
            const info = data?.roomInfo;
            if (info && info.isLive === false) {
              send("error", {
                message: `@${username} şu anda canlı yayında değil.`,
                code: "USER_OFFLINE",
              });
              ws.close();
              closeController();
              return;
            }
            if (!connectedSent) {
              connectedSent = true;
              send("connected", { roomId: info?.id ?? null, roomInfo: info ?? null });
            }
            continue;
          }

          if (type === "tiktok.connect" || type === "connected") {
            if (!connectedSent) {
              connectedSent = true;
              send("connected", { roomId: null });
            }
            continue;
          }

          if (type === "tiktok.disconnect" || type === "disconnect") {
            send("disconnected", { reason: "Yayın sona erdi" });
            ws.close();
            closeController();
            return;
          }

          // ── Olay mesajları ──
          if (type === "WebcastSocialMessage") {
            const socialType = resolveSocialType(data);
            if (socialType) {
              const mapped = mapTikTokEvent(socialType, data);
              if (mapped) send("event", { eventType: socialType, liveEvent: mapped });
            }
            continue;
          }

          const internalType = EVENT_TYPE_MAP[type];
          if (!internalType) continue; // İlgilenmediğimiz mesaj tipi.

          const mapped = mapTikTokEvent(internalType, data);
          if (mapped) send("event", { eventType: internalType, liveEvent: mapped });
        }
      };

      ws.onerror = () => {
        if (!connectedSent) {
          send("error", {
            message:
              "TikTok LIVE bağlantısı kurulamadı. Kullanıcı adını, yayının açık " +
              "olduğunu ve Euler Stream kotanızı kontrol edin.",
            code: "WS_ERROR",
          });
        }
        ws.close();
        closeController();
      };

      ws.onclose = (event: CloseEvent) => {
        // Hiç bağlanamadan kapandıysa nedeni ilet (geçersiz anahtar, kota, offline...).
        if (!connectedSent) {
          send("error", {
            message:
              event.reason?.trim() ||
              `Bağlantı kapandı (kod ${event.code}). Yayın kapalı olabilir ` +
                `veya Euler Stream kotanız dolmuş olabilir.`,
            code: "WS_CLOSED",
          });
        } else {
          send("disconnected", { code: event.code, reason: event.reason ?? "" });
        }
        closeController();
      };

      // ── İstemci bağlantıyı kestiğinde temizlik ──
      request.signal.addEventListener("abort", () => {
        try {
          ws.close();
        } catch {
          // Zaten kapalı.
        }
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
