import { z } from "zod";

/**
 * TikTok Webcast olay tipleri — PRD Ek A "Bilinen event payload tipleri" +
 * §5.11 Event API. Connector (TikTok-Live-Connector) bu payload'ları üretir;
 * Faz 0-1'de mock üretici aynı şekli taklit eder.
 */
export const liveEventTypeSchema = z.enum([
  "chat",
  "gift",
  "like",
  "follow",
  "share",
  "member", // join
  "subscribe",
  "emote",
  "envelope",
  "roomUser",
  "timer", // kullanıcısız/sistem kaynağı — Zamanlayıcı (PRD §6.2 "Timer olayları")
]);
export type LiveEventType = z.infer<typeof liveEventTypeSchema>;

/** Olayı gönderen izleyici. */
export const liveUserSchema = z.object({
  uniqueId: z.string(),
  nickname: z.string(),
  userId: z.string(),
  profilePictureUrl: z.string().optional(),
  isFollower: z.boolean().default(false),
  isSubscriber: z.boolean().default(false),
  isModerator: z.boolean().default(false),
  teamMemberLevel: z.number().int().min(0).default(0),
});
export type LiveUser = z.infer<typeof liveUserSchema>;

export const liveEventSchema = z.object({
  /** Idempotency anahtarı — PRD §6.2: aynı olay iki kez işlenmez. */
  id: z.string(),
  type: liveEventTypeSchema,
  ts: z.number().int(),
  user: liveUserSchema,
  /** chat / command */
  comment: z.string().optional(),
  /** gift */
  giftId: z.string().optional(),
  giftName: z.string().optional(),
  coins: z.number().int().min(0).optional(),
  repeatCount: z.number().int().min(1).optional(),
  /** gift combo bitti mi — combo sürerken eylem tetiklenmez. */
  repeatEnd: z.boolean().optional(),
  /** like */
  likeCount: z.number().int().min(0).optional(),
  totalLikeCount: z.number().int().min(0).optional(),
  /** subscribe */
  subMonth: z.number().int().min(1).optional(),
  /** emote */
  emoteId: z.string().optional(),
  emoteImageUrl: z.string().optional(),
  /** sticker */
  stickerId: z.string().optional(),
  /** shop_purchase */
  productName: z.string().optional(),
  /** roomUser */
  viewerCount: z.number().int().min(0).optional(),
  /** ilk aktivite bayrağı — kural motoru first_activity için kullanır. */
  isFirstActivity: z.boolean().optional(),
});
export type LiveEvent = z.infer<typeof liveEventSchema>;

/** Boş/sistem izleyici — kullanıcısı olmayan olaylar (Zamanlayıcı) için. */
const SYSTEM_USER: LiveUser = {
  uniqueId: "",
  nickname: "",
  userId: "",
  isFollower: false,
  isSubscriber: false,
  isModerator: false,
  teamMemberLevel: 0,
};

/**
 * Kullanıcısız bir "sistem" olayı üretir — Zamanlayıcı gibi tetikleyicisiz
 * kaynaklar için. Eşleştirmeden geçmez (RuleEngine.fireAction doğrudan çalıştırır);
 * yalnız placeholder render'ı için LiveEvent şekline ihtiyaç vardır. `{username}`
 * gibi kullanıcı placeholder'ları boş çözülür.
 *
 * `id`/`ts` testlerde belirlenebilir olması için dışarıdan verilebilir.
 */
export function systemLiveEvent(
  overrides?: Partial<Pick<LiveEvent, "id" | "ts">>,
): LiveEvent {
  const ts = overrides?.ts ?? Date.now();
  return {
    id: overrides?.id ?? `sys_${ts}_${Math.floor(Math.random() * 1_000_000)}`,
    type: "timer",
    ts,
    user: { ...SYSTEM_USER },
  };
}

/**
 * Placeholder değişkenleri — PRD §5.3 (birebir).
 * Eylem metinlerinde `{username}` gibi kullanılır.
 */
export const PLACEHOLDERS = [
  "username",
  "nickname",
  "comment",
  "giftname",
  "coins",
  "repeatcount",
  "likecount",
  "totallikecount",
  "submonth",
  "playername",
  "level",
  "rank",
  "points",
  "currencyname",
  "amount",
  "destination",
] as const;
export type Placeholder = (typeof PLACEHOLDERS)[number];

/** Minecraft komut yardımcıları — PRD §5.3. */
export const MC_HELPERS = ["delay <ms>", "break_delays", "skip_delays"] as const;

/** Bağlantı durum makinesi — PRD §12.4. */
export const connectionStateSchema = z.enum([
  "disconnected",
  "connecting",
  "live",
  "error",
]);
export type ConnectionState = z.infer<typeof connectionStateSchema>;
