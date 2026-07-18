import type { StreamEvent, TriggerType, TriggerWho } from "@/lib/schemas/event";
import type { LiveEvent } from "@/lib/schemas/live";

/**
 * Kural motoru — eşleştirme (PRD §6.2).
 * Saf TypeScript: DOM/framework bağımlılığı YOK.
 */

/** Canlı olay tipi → hangi tetikleyicileri besleyebilir. */
const TRIGGERS_FOR_EVENT: Record<LiveEvent["type"], TriggerType[]> = {
  chat: ["chat", "command"],
  gift: ["gift_min", "gift_specific"],
  like: ["gift_likes_min"],
  follow: ["follow"],
  share: ["invite"],
  member: ["join"],
  subscribe: ["subscribe"],
  emote: ["emote_specific"],
  envelope: [],
  roomUser: [],
  // Zamanlayıcı olayları eşleştirmeden geçmez (fireAction doğrudan çalıştırır).
  timer: [],
};

/** Rol filtresi — "Kim tetikleyebilir" (PRD §5.3). */
export function matchesWho(
  who: TriggerWho,
  ev: LiveEvent,
  ctx: { topGifterIds?: string[]; topGifterCount?: number; specificUsername?: string },
): boolean {
  switch (who) {
    case "any":
      return true;
    case "followers":
      return ev.user.isFollower;
    case "subscribers":
      return ev.user.isSubscriber;
    case "moderators":
      return ev.user.isModerator;
    case "topgifter": {
      const limit = ctx.topGifterCount ?? 1;
      const top = (ctx.topGifterIds ?? []).slice(0, limit);
      return top.includes(ev.user.userId);
    }
    case "specific_user": {
      const target = ctx.specificUsername?.replace(/^@/, "").toLowerCase();
      return !!target && ev.user.uniqueId.toLowerCase() === target;
    }
  }
}

/** Komut eşleşmesi — yorum komutla başlıyor mu (büyük/küçük harf duyarsız). */
export function matchesCommand(comment: string | undefined, command: string): boolean {
  if (!comment) return false;
  const first = comment.trim().split(/\s+/)[0]?.toLowerCase();
  return first === command.trim().toLowerCase();
}

/** Koşul alanları — tetikleyici tipine göre (PRD §5.3 tablosu). */
export function matchesConditions(rule: StreamEvent, ev: LiveEvent): boolean {
  const c = rule.conditions;

  switch (rule.trigger) {
    case "command":
      if (!c.command || !matchesCommand(ev.comment, c.command)) return false;
      if (c.minTeamLevel !== undefined && ev.user.teamMemberLevel < c.minTeamLevel)
        return false;
      return true;

    case "chat":
      return ev.type === "chat";

    case "gift_min":
      // Combo sürerken tetiklenmez; combo bitince toplam coin değerlendirilir.
      if (ev.repeatEnd === false) return false;
      return (ev.coins ?? 0) >= (c.minCoins ?? 1);

    case "gift_specific":
      if (ev.repeatEnd === false) return false;
      return !!c.giftId && ev.giftId === c.giftId;

    case "gift_likes_min":
      return (ev.likeCount ?? 0) >= (c.minLikes ?? 1);

    case "emote_specific":
      return !!c.emoteId && ev.emoteId === c.emoteId;

    case "sticker_specific":
    case "fanclub_sticker_specific":
      return !!c.stickerId && ev.stickerId === c.stickerId;

    case "shop_purchase": {
      if (!c.productNameContains) return true;
      return (ev.productName ?? "")
        .toLowerCase()
        .includes(c.productNameContains.toLowerCase());
    }

    case "first_activity":
      return ev.isFirstActivity === true;

    case "follow":
    case "invite":
    case "subscribe":
    case "join":
    case "raid":
      return true;
  }
}

/** Bir canlı olayın tetiklediği etkinlik kurallarını döndürür. */
export function matchEvents(
  rules: StreamEvent[],
  ev: LiveEvent,
  ctx: { topGifterIds?: string[] } = {},
): StreamEvent[] {
  const candidates = TRIGGERS_FOR_EVENT[ev.type] ?? [];
  // first_activity her olay tipinden gelebilir (PRD §5.3).
  const allowed: TriggerType[] = ev.isFirstActivity
    ? [...candidates, "first_activity"]
    : candidates;

  return rules.filter((rule) => {
    if (!rule.active) return false;
    if (!allowed.includes(rule.trigger)) return false;
    if (
      !matchesWho(rule.who, ev, {
        topGifterIds: ctx.topGifterIds,
        topGifterCount: rule.conditions.topGifterCount,
        specificUsername: rule.conditions.specificUsername,
      })
    )
      return false;
    return matchesConditions(rule, ev);
  });
}

/**
 * Bir kuralın çalıştıracağı eylem id'leri.
 * "Trigger all of these actions" hepsini; "one of these (random)" birini seçer.
 */
export function resolveActionIds(
  rule: StreamEvent,
  pickRandom: (n: number) => number = (n) => Math.floor(Math.random() * n),
): string[] {
  const ids = [...rule.actionsAll];
  if (rule.actionsRandom.length > 0) {
    ids.push(rule.actionsRandom[pickRandom(rule.actionsRandom.length)]);
  }
  return ids;
}
