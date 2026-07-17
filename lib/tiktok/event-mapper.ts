/**
 * TikTok olay dönüştürücü — tiktok-live-connector payload'larını
 * projenin `LiveEvent` şemasına (lib/schemas/live.ts) eşler.
 *
 * PRD §6.1: connector → event mapper → kural motoru → widget'lar.
 */

import type { LiveEvent, LiveUser } from "@/lib/schemas/live";
import type {
  TikTokChatEvent,
  TikTokEmoteEvent,
  TikTokEnvelopeEvent,
  TikTokGiftEvent,
  TikTokLikeEvent,
  TikTokMemberEvent,
  TikTokRoomUserEvent,
  TikTokSocialEvent,
  TikTokSubscribeEvent,
  TikTokUser,
} from "./types";

let eventCounter = 0;

/** Benzersiz olay ID'si üretir. */
function nextId(): string {
  return `tt_${Date.now()}_${++eventCounter}`;
}

/** TikTok kullanıcısını projenin LiveUser şemasına dönüştürür.
 *  Hem tiktok-live-connector'ın düz biçimini hem de Euler Cloud WebSocket'in
 *  ham (proto) biçimini destekler. */
function mapUser(raw: TikTokUser): LiveUser {
  return {
    uniqueId: raw.uniqueId ?? "",
    nickname: raw.nickname ?? raw.uniqueId ?? "",
    userId: raw.userId ?? "",
    profilePictureUrl: raw.profilePictureUrl ?? raw.profilePicture?.url?.[0],
    isFollower:
      (raw.followRole ?? 0) >= 1 || (raw.followInfo?.followStatus ?? 0) >= 1,
    isSubscriber: raw.isSubscriber ?? false,
    isModerator: raw.isModerator ?? false,
    teamMemberLevel: raw.teamMemberLevel ?? 0,
  };
}

/** Sohbet mesajını LiveEvent'e dönüştürür. */
export function mapChatEvent(data: TikTokChatEvent): LiveEvent {
  return {
    id: nextId(),
    type: "chat",
    ts: Date.now(),
    user: mapUser(data.user),
    comment: data.comment,
  };
}

/** Hediye olayını LiveEvent'e dönüştürür.
 *  Hediye adı/değeri connector'da `giftDetails`, Cloud WebSocket'te `gift`
 *  altında gelir — ikisini de destekler. */
export function mapGiftEvent(data: TikTokGiftEvent): LiveEvent {
  return {
    id: nextId(),
    type: "gift",
    ts: Date.now(),
    user: mapUser(data.user),
    giftId: String(data.giftId ?? data.gift?.id ?? ""),
    giftName: data.giftDetails?.giftName ?? data.gift?.name,
    coins: data.giftDetails?.diamondCount ?? data.gift?.diamondCount ?? 0,
    repeatCount: data.repeatCount,
    repeatEnd: data.repeatEnd,
  };
}

/** Üye katılım olayını LiveEvent'e dönüştürür. */
export function mapMemberEvent(data: TikTokMemberEvent): LiveEvent {
  return {
    id: nextId(),
    type: "member",
    ts: Date.now(),
    user: mapUser(data.user),
    viewerCount: data.memberCount,
  };
}

/** Beğeni olayını LiveEvent'e dönüştürür. */
export function mapLikeEvent(data: TikTokLikeEvent): LiveEvent {
  return {
    id: nextId(),
    type: "like",
    ts: Date.now(),
    user: mapUser(data.user),
    likeCount: data.likeCount,
    totalLikeCount: data.totalLikeCount,
  };
}

/** Takip/paylaşım olayını LiveEvent'e dönüştürür. */
export function mapSocialEvent(
  data: TikTokSocialEvent,
  socialType: "follow" | "share",
): LiveEvent {
  return {
    id: nextId(),
    type: socialType,
    ts: Date.now(),
    user: mapUser(data.user),
  };
}

/** Abone olayını LiveEvent'e dönüştürür. */
export function mapSubscribeEvent(data: TikTokSubscribeEvent): LiveEvent {
  return {
    id: nextId(),
    type: "subscribe",
    ts: Date.now(),
    user: mapUser(data.user),
    subMonth: data.subMonth,
  };
}

/** Emoji olayını LiveEvent'e dönüştürür. */
export function mapEmoteEvent(data: TikTokEmoteEvent): LiveEvent {
  return {
    id: nextId(),
    type: "emote",
    ts: Date.now(),
    user: mapUser(data.user),
    emoteId: data.emoteId,
    emoteImageUrl: data.emoteImageUrl,
  };
}

/** Zarf olayını LiveEvent'e dönüştürür. */
export function mapEnvelopeEvent(data: TikTokEnvelopeEvent): LiveEvent {
  return {
    id: nextId(),
    type: "envelope",
    ts: Date.now(),
    user: mapUser(data.user),
    coins: data.coins,
  };
}

/** Oda kullanıcı istatistiğini LiveEvent'e dönüştürür. */
export function mapRoomUserEvent(data: TikTokRoomUserEvent): LiveEvent {
  return {
    id: nextId(),
    type: "roomUser",
    ts: Date.now(),
    user: {
      uniqueId: "system",
      nickname: "System",
      userId: "0",
      isFollower: false,
      isSubscriber: false,
      isModerator: false,
      teamMemberLevel: 0,
    },
    viewerCount: data.viewerCount,
  };
}

/**
 * Ham TikTok olayını olay türüne göre uygun mapper'a yönlendirir.
 * API Route'ta kullanılır.
 */
export function mapTikTokEvent(
  eventType: string,
  payload: unknown,
): LiveEvent | null {
  try {
    switch (eventType) {
      case "chat":
        return mapChatEvent(payload as TikTokChatEvent);
      case "gift":
        return mapGiftEvent(payload as TikTokGiftEvent);
      case "member":
        return mapMemberEvent(payload as TikTokMemberEvent);
      case "like":
        return mapLikeEvent(payload as TikTokLikeEvent);
      case "follow":
        return mapSocialEvent(payload as TikTokSocialEvent, "follow");
      case "share":
        return mapSocialEvent(payload as TikTokSocialEvent, "share");
      case "subscribe":
        return mapSubscribeEvent(payload as TikTokSubscribeEvent);
      case "emote":
        return mapEmoteEvent(payload as TikTokEmoteEvent);
      case "envelope":
        return mapEnvelopeEvent(payload as TikTokEnvelopeEvent);
      case "roomUser":
        return mapRoomUserEvent(payload as TikTokRoomUserEvent);
      default:
        return null;
    }
  } catch {
    console.warn(`[TikTok] Olay dönüştürme hatası: ${eventType}`, payload);
    return null;
  }
}
