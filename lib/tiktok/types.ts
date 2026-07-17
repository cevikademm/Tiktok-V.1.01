/**
 * TikTok LIVE Connector olay tipleri — tiktok-live-connector paketindeki
 * WebcastEvent enum'larının karşılığı.
 *
 * Bu dosya, tiktok-live-connector paketinden gelen ham olay verilerinin
 * TypeScript tip tanımlarını içerir. Paket sunucu tarafında (API Route) çalışır;
 * bu tipler hem sunucu hem istemci tarafında kullanılabilir.
 */

/* ── TikTok Kullanıcı ── */
export interface TikTokUser {
  uniqueId: string;
  nickname: string;
  userId: string;
  profilePictureUrl?: string;
  followRole?: number; // 0 = takipçi değil, 1 = takipçi, 2 = arkadaş
  isModerator?: boolean;
  isNewGifter?: boolean;
  isSubscriber?: boolean;
  topGifterRank?: number;
  teamMemberLevel?: number;
  // Euler Cloud WebSocket ham (proto) biçimindeki alternatif alanlar:
  profilePicture?: { url?: string[] };
  followInfo?: { followStatus?: number };
}

/* ── Hediye Detayları ── */
export interface TikTokGiftDetails {
  giftName: string;
  giftType: number; // 1 = streak hediye, diğer = tek seferlik
  diamondCount: number;
  describe?: string;
  giftPictureUrl?: string;
}

/* ── Ham Olay Payload'ları ── */
export interface TikTokChatEvent {
  user: TikTokUser;
  comment: string;
  userId: string;
}

export interface TikTokGiftEvent {
  user: TikTokUser;
  giftId: number;
  giftDetails?: TikTokGiftDetails;
  repeatCount: number;
  repeatEnd: boolean;
  userId: string;
  // Euler Cloud WebSocket ham (proto) hediye yapısı — giftDetails yoksa buradan okunur.
  gift?: { id?: number; name?: string; diamondCount?: number };
}

export interface TikTokMemberEvent {
  user: TikTokUser;
  memberCount?: number;
  userId: string;
}

export interface TikTokLikeEvent {
  user: TikTokUser;
  likeCount: number;
  totalLikeCount: number;
  userId: string;
}

export interface TikTokSocialEvent {
  user: TikTokUser;
  userId: string;
  displayType?: string; // "follow" | "share"
}

export interface TikTokSubscribeEvent {
  user: TikTokUser;
  userId: string;
  subMonth?: number;
}

export interface TikTokEmoteEvent {
  user: TikTokUser;
  userId: string;
  emoteId?: string;
  emoteImageUrl?: string;
}

export interface TikTokRoomUserEvent {
  viewerCount: number;
  ranksList?: Array<{
    user: TikTokUser;
    coinCount: number;
  }>;
}

export interface TikTokEnvelopeEvent {
  user: TikTokUser;
  userId: string;
  coins?: number;
}

/* ── SSE Mesaj Formatı ── */
export interface TikTokSSEMessage {
  type: "connected" | "disconnected" | "event" | "error" | "roomInfo";
  data: unknown;
}

export interface TikTokSSEEventMessage extends TikTokSSEMessage {
  type: "event";
  data: {
    eventType: string;
    payload: unknown;
  };
}

export interface TikTokSSEConnectedMessage extends TikTokSSEMessage {
  type: "connected";
  data: {
    roomId: string;
    roomInfo?: unknown;
  };
}

export interface TikTokSSEErrorMessage extends TikTokSSEMessage {
  type: "error";
  data: {
    message: string;
    code?: string;
  };
}

/* ── Bağlantı Durumu ── */
export interface TikTokConnectionConfig {
  /** Euler Stream API anahtarı (opsiyonel — imza doğrulaması için). */
  signApiKey?: string;
  /** Hediye detaylarını (isim, değer) getir. */
  enableExtendedGiftInfo?: boolean;
  /** Bağlantı sırasında mevcut mesajları işle. */
  processInitialData?: boolean;
  /** Bağlantı sırasında oda bilgisini getir. */
  fetchRoomInfoOnConnect?: boolean;
}
