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

/**
 * Euler'in WebSocket kapanış nedenini kullanıcıya anlatılabilir bir mesaja çevirir.
 *
 * NEDEN: Euler, yayında OLMAYAN bir hesap için bağlantıyı `1011 / "WS State Error"`
 * ile kapatır — bu ham metin kullanıcıya olduğu gibi gösterildiğinde hiçbir şey
 * anlatmaz ("tiktok live'a bağlanamadı, hata verdi"). Asıl neden neredeyse her
 * zaman "yayın kapalı" ya da "kullanıcı adı yanlış" olduğu için burada açıkça
 * söylenir ve `USER_OFFLINE` koduyla işaretlenir (UI bunu hata değil, durum
 * olarak gösterebilir).
 */
export function describeCloseReason(
  closeCode: number,
  reason: string,
  name: string,
): { message: string; code: string } {
  const r = reason.trim();
  const lower = r.toLowerCase();

  // Kota/oran sınırı — Euler açıkça söyler.
  if (lower.includes("rate limit") || lower.includes("quota") || closeCode === 1013) {
    return {
      message:
        "Euler Stream kotanız doldu. Bir süre bekleyin veya planınızı yükseltin " +
        "(ücretsiz katman: 2500 istek/gün).",
      code: "RATE_LIMITED",
    };
  }

  // Geçersiz/eksik anahtar.
  if (
    lower.includes("api key") ||
    lower.includes("unauthorized") ||
    lower.includes("401")
  ) {
    return {
      message:
        "Euler Stream API anahtarı reddedildi. .env.local içindeki " +
        "EULER_STREAM_API_KEY değerini kontrol edin.",
      code: "INVALID_KEY",
    };
  }

  // Euler'in "yayında değil" karşılığı: oda durumu alınamadı.
  if (lower.includes("state error") || lower.includes("room") || !r) {
    return {
      message:
        `@${name} şu anda canlı yayında değil. TikTok'ta yayını başlatıp tekrar ` +
        "deneyin. (Yayın açıksa kullanıcı adını kontrol edin — @ olmadan, " +
        "profil adresindeki adın birebir aynısı olmalı.)",
      code: "USER_OFFLINE",
    };
  }

  return { message: `Bağlantı kapandı: ${r} (kod ${closeCode}).`, code: "WS_CLOSED" };
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
        `@${cleanName} için TikTok LIVE bağlantısı kurulamadı. ` +
          "Kullanıcı adını ve yayının açık olduğunu kontrol edin.",
        "WS_ERROR",
      );
    }
    handle.close();
  };

  ws.onclose = (event: CloseEvent) => {
    // Hiç bağlanamadan kapandıysa nedeni ilet (offline, geçersiz anahtar, kota...).
    if (!connectedSent) {
      const { message, code } = describeCloseReason(
        event.code,
        event.reason ?? "",
        cleanName,
      );
      fail(message, code);
    } else {
      status("disconnected", { code: event.code, reason: event.reason ?? "" });
    }
    closed = true;
  };

  return handle;
}
