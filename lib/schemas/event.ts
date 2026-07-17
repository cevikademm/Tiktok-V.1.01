import { z } from "zod";

/**
 * Etkinlik tetikleyicileri — PRD §5.3 "Etkinlik tetikleyicileri (15)".
 * Enum adları orijinalle birebir; etiket i18n'den (`actionsandevents.trigger.<enum>`).
 */
export const triggerTypeSchema = z.enum([
  "chat",
  "command",
  "follow",
  "invite", // Share
  "subscribe",
  "join",
  "raid",
  "first_activity",
  "gift_min",
  "gift_specific",
  "gift_likes_min",
  "emote_specific",
  "sticker_specific",
  "fanclub_sticker_specific",
  "shop_purchase",
]);
export type TriggerType = z.infer<typeof triggerTypeSchema>;

/** "Kim tetikleyebilir" — PRD §5.3 (6 rol). */
export const triggerWhoSchema = z.enum([
  "any",
  "followers",
  "subscribers",
  "moderators",
  "topgifter",
  "specific_user",
]);
export type TriggerWho = z.infer<typeof triggerWhoSchema>;

/**
 * Üçüncü taraf API triggerTypeId haritası — PRD §9.
 * 1=Share 2=Command 3=Gift(min) 4=Gift(specific) 6=Join 7=Likes 9=Follow
 * 10=Subscribe 11=Chat 12=Emote 13=FirstActivity
 */
export const THIRD_PARTY_TRIGGER_ID: Partial<Record<TriggerType, number>> = {
  invite: 1,
  command: 2,
  gift_min: 3,
  gift_specific: 4,
  join: 6,
  gift_likes_min: 7,
  follow: 9,
  subscribe: 10,
  chat: 11,
  emote_specific: 12,
  first_activity: 13,
};

/* -------------------------------------------------------------------------- */
/* Koşullar                                                                    */
/* -------------------------------------------------------------------------- */

export const eventConditionsSchema = z.object({
  /** command — "! veya / ile başlamalı" (PRD §5.3). */
  command: z
    .string()
    .regex(/^[!/]\S+$/, { message: "commandPrefix" })
    .optional(),
  /** command — TikTok team level eşiği. */
  minTeamLevel: z.number().int().min(0).optional(),
  /** command — puan seviyesi eşiği. */
  minPointsLevel: z.number().int().min(0).optional(),
  /** gift_min */
  minCoins: z.number().int().min(1).optional(),
  /** gift_specific */
  giftId: z.string().optional(),
  giftName: z.string().optional(),
  /** gift_likes_min */
  minLikes: z.number().int().min(1).optional(),
  /** emote_specific */
  emoteId: z.string().optional(),
  /** sticker_specific / fanclub_sticker_specific */
  stickerId: z.string().optional(),
  /** shop_purchase — "Product name contains (optional)" */
  productNameContains: z.string().optional(),
  /** topgifter — "Allowed number of top gifters" */
  topGifterCount: z.number().int().min(1).optional(),
  /** specific_user */
  specificUsername: z.string().optional(),
});
export type EventConditions = z.infer<typeof eventConditionsSchema>;

/** Hangi tetikleyicinin hangi koşul alanını zorunlu kıldığı (PRD §5.3 tablosu). */
export const REQUIRED_CONDITION: Partial<
  Record<TriggerType, keyof EventConditions>
> = {
  command: "command",
  gift_min: "minCoins",
  gift_specific: "giftId",
  gift_likes_min: "minLikes",
  emote_specific: "emoteId",
  sticker_specific: "stickerId",
  fanclub_sticker_specific: "stickerId",
};

/* -------------------------------------------------------------------------- */
/* Etkinlik                                                                    */
/* -------------------------------------------------------------------------- */

export const eventSchema = z
  .object({
    id: z.string(),
    active: z.boolean().default(true),
    trigger: triggerTypeSchema,
    who: triggerWhoSchema.default("any"),
    conditions: eventConditionsSchema.default({}),
    /** "Trigger all of these actions" */
    actionsAll: z.array(z.string()).default([]),
    /** "Trigger one of these actions (random)" */
    actionsRandom: z.array(z.string()).default([]),
  })
  .refine((e) => e.actionsAll.length + e.actionsRandom.length > 0, {
    message: "noActionsLinked",
    path: ["actionsAll"],
  })
  .refine(
    (e) => {
      const key = REQUIRED_CONDITION[e.trigger];
      return !key || e.conditions[key] !== undefined;
    },
    { message: "conditionRequired", path: ["conditions"] },
  );
export type StreamEvent = z.infer<typeof eventSchema>;

/**
 * Tekrar tespiti — PRD §5.3: "An event already exists with the same trigger settings…"
 * Aynı trigger + who + koşul kümesi ikinci kez tanımlanamaz.
 */
export function eventSignature(e: {
  trigger: TriggerType;
  who: TriggerWho;
  conditions: EventConditions;
}): string {
  const cond = Object.entries(e.conditions)
    .filter(([, v]) => v !== undefined && v !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${String(v)}`)
    .join("&");
  return `${e.trigger}|${e.who}|${cond}`;
}

/* -------------------------------------------------------------------------- */
/* Zamanlayıcı (PRD §5.3 Timers tablosu)                                       */
/* -------------------------------------------------------------------------- */

export const timerSchema = z.object({
  id: z.string(),
  active: z.boolean().default(true),
  intervalMinutes: z.number().int().min(1).max(1440),
  actionId: z.string().min(1),
});
export type StreamTimer = z.infer<typeof timerSchema>;
