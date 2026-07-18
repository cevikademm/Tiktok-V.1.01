/**
 * EulerStream Cloud WebSocket bağlantısı — taşınabilir sunucu modülü.
 *
 * `app/api/tiktok/stream/route.ts` içindeki upstream WS + frame ayrıştırma +
 * `mapTikTokEvent` yönlendirmesi buraya çıkarıldı; HEM tiktok SSE route'u HEM
 * overlay hub'ı (`lib/server/overlay-hub.ts`) aynı fonksiyonu kullanır.
 *
 * Ücretsiz katman: 25 eşzamanlı WebSocket / 2500 istek/gün; TikTok'un ücretli
 * "Webcast Signature" eklentisini GEREKTİRMEZ.
 *
 * Ortam: EULER_STREAM_API_KEY (https://www.eulerstream.com — ücretsiz).
 * Yalnızca Node runtime'da import edilmelidir (global WebSocket, Node 22+).
 */

import { mapTikTokEvent } from "@/lib/tiktok/event-mapper";
import type { LiveEvent } from "@/lib/schemas/live";

const CLOUD_WS_URL = "wss://ws.eulerstream.com";

/**
 * Euler Cloud WebSocket mesaj tipi → projenin iç olay tipi (event-mapper case'leri).
 * WebcastSocialMessage (follow/share) tek tip gelir; ayrımı `resolveSocialType` yapar.
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

export interface EulerHandle {
  /** Upstream WebSocket'i kapatır (idempotent). */
  close(): void;
}

export interface EulerCallbacks {
  /** Bir TikTok olayı iç `LiveEvent`'e dönüştürüldüğünde. */
  onEvent: (eventType: string, ev: LiveEvent) => void;
  /** Bağlantı durum değişimi (oda bilgisi / yayın sonu). */
  onStatus?: (status: "connected" | "disconnected", info?: unknown) => void;
  /** Kurtarılamaz hata (offline, kota, geçersiz anahtar...). */
  onError?: (message: string, code: string) => void;
}

/**
 * Verilen `username` için Euler Cloud WebSocket'ine bağlanır ve olayları
 * callback'lerle iletir. Dönen `EulerHandle.close()` bağlantıyı kapatır.
 *
 * NOT: `username` `@` olmadan, temizlenmiş beklenir; yine de güvenlik için temizlenir.
 */
export function connectEulerStream(
  username: string,
  cb: EulerCallbacks,
): EulerHandle {
  const cleanName = username.trim().replace(/^@/, "");
  let closed = false;
  let connectedSent = false;
  let ws: WebSocket | null = null;

  const status = (s: "connected" | "disconnected", info?: unknown) => {
    if (!closed) cb.onStatus?.(s, info);
  };
  const fail = (message: string, code: string) => {
    if (!closed) cb.onError?.(message, code);
  };

  const handle: EulerHandle = {
    close() {
      if (closed) return;
      closed = true;
      try {
        ws?.close();
      } catch {
        // Zaten kapalı.
      }
    },
  };

  const apiKey = process.env.EULER_STREAM_API_KEY?.trim();
  if (!apiKey) {
    fail(
      "EULER_STREAM_API_KEY tanımlı değil. https://www.eulerstream.com " +
        "adresinden ücretsiz bir anahtar alıp .env.local'e ekleyin ve sunucuyu yeniden başlatın.",
      "SIGN_KEY_REQUIRED",
    );
    return handle;
  }

  // Node 22+ (bu proje Node 24) global WebSocket sağlar.
  const WS = (globalThis as { WebSocket?: typeof WebSocket }).WebSocket;
  if (!WS) {
    fail("Sunucu ortamında WebSocket bulunamadı (Node 22+ gerekir).", "NO_WEBSOCKET");
    return handle;
  }

  const url =
    `${CLOUD_WS_URL}?uniqueId=${encodeURIComponent(cleanName)}` +
    `&apiKey=${encodeURIComponent(apiKey)}`;
  ws = new WS(url);

  ws.onmessage = (event: MessageEvent) => {
    if (closed) return;
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
          fail(`@${cleanName} şu anda canlı yayında değil.`, "USER_OFFLINE");
          handle.close();
          return;
        }
        if (!connectedSent) {
          connectedSent = true;
          status("connected", { roomId: info?.id ?? null, roomInfo: info ?? null });
        }
        continue;
      }

      if (type === "tiktok.connect" || type === "connected") {
        if (!connectedSent) {
          connectedSent = true;
          status("connected", { roomId: null });
        }
        continue;
      }

      if (type === "tiktok.disconnect" || type === "disconnect") {
        status("disconnected", { reason: "Yayın sona erdi" });
        handle.close();
        return;
      }

      // ── Olay mesajları ──
      if (type === "WebcastSocialMessage") {
        const socialType = resolveSocialType(data);
        if (socialType) {
          const mapped = mapTikTokEvent(socialType, data);
          if (mapped && !closed) cb.onEvent(socialType, mapped);
        }
        continue;
      }

      const internalType = EVENT_TYPE_MAP[type];
      if (!internalType) continue; // İlgilenmediğimiz mesaj tipi.

      const mapped = mapTikTokEvent(internalType, data);
      if (mapped && !closed) cb.onEvent(internalType, mapped);
    }
  };

  ws.onerror = () => {
    if (!connectedSent) {
      fail(
        "TikTok LIVE bağlantısı kurulamadı. Kullanıcı adını, yayının açık " +
          "olduğunu ve Euler Stream kotanızı kontrol edin.",
        "WS_ERROR",
      );
    }
    handle.close();
  };

  ws.onclose = (event: CloseEvent) => {
    // Hiç bağlanamadan kapandıysa nedeni ilet (geçersiz anahtar, kota, offline...).
    if (!connectedSent) {
      fail(
        event.reason?.trim() ||
          `Bağlantı kapandı (kod ${event.code}). Yayın kapalı olabilir ` +
            `veya Euler Stream kotanız dolmuş olabilir.`,
        "WS_CLOSED",
      );
    } else {
      status("disconnected", { code: event.code, reason: event.reason ?? "" });
    }
    closed = true;
  };

  return handle;
}
