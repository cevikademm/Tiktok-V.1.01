/**
 * TikTok LIVE entegrasyonu — modül ihracatları.
 *
 * Kullanım:
 *   import { createTikTokConnection, createTikTokBus } from "@/lib/tiktok";
 *   import { mapTikTokEvent } from "@/lib/tiktok/event-mapper";
 *   import type { TikTokUser, TikTokGiftEvent } from "@/lib/tiktok/types";
 */

export { createTikTokConnection, createTikTokBus } from "./client";
export { mapTikTokEvent } from "./event-mapper";
export type {
  TikTokUser,
  TikTokGiftEvent,
  TikTokChatEvent,
  TikTokMemberEvent,
  TikTokLikeEvent,
  TikTokSocialEvent,
  TikTokSubscribeEvent,
  TikTokEmoteEvent,
  TikTokEnvelopeEvent,
  TikTokRoomUserEvent,
  TikTokConnectionConfig,
  TikTokSSEMessage,
  TikTokSSEEventMessage,
  TikTokSSEConnectedMessage,
  TikTokSSEErrorMessage,
} from "./types";
