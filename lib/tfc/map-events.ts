import { newId } from "@/lib/data/mock/store";
import {
  eventConditionsSchema,
  eventSchema,
  eventSignature,
  REQUIRED_CONDITION,
  THIRD_PARTY_TRIGGER_ID,
  timerSchema,
  triggerTypeSchema,
  triggerWhoSchema,
  type EventConditions,
  type StreamEvent,
  type StreamTimer,
  type TriggerType,
  type TriggerWho,
} from "@/lib/schemas/event";
import {
  asArray,
  bool,
  int,
  normalizeKey,
  pick,
  rec,
  str,
  type RawRecord,
} from "./read";
import { IssueCollector } from "./types";

/**
 * ETKİNLİK (tetikleyici) HARİTALAMA — ADR-0007.
 *
 * Kritik köprü: TikFinity etkinlikleri 3. taraf API'sindeki SAYISAL
 * `triggerTypeId` ile yazıyor. Bu eşleme projede ZATEN var
 * (`THIRD_PARTY_TRIGGER_ID`, lib/schemas/event.ts) — burada yalnız tersi
 * türetilir, yeni bir sözlük uydurulmaz.
 */

/** `THIRD_PARTY_TRIGGER_ID`'nin tersi: 3 → "gift_min". */
export const TRIGGER_BY_THIRD_PARTY_ID: ReadonlyMap<number, TriggerType> = new Map(
  Object.entries(THIRD_PARTY_TRIGGER_ID)
    .filter((entry): entry is [TriggerType, number] => entry[1] !== undefined)
    .map(([trigger, id]) => [id, trigger as TriggerType]),
);

const CANONICAL_TRIGGERS = new Map<string, TriggerType>(
  triggerTypeSchema.options.map((t) => [normalizeKey(t), t]),
);

/** Kanonik adın dışındaki varyantlar. */
const TRIGGER_SYNONYMS: Record<string, TriggerType> = {
  share: "invite",
  shared: "invite",
  gift: "gift_min",
  giftmin: "gift_min",
  giftminimum: "gift_min",
  mingift: "gift_min",
  giftspecific: "gift_specific",
  specificgift: "gift_specific",
  like: "gift_likes_min",
  likes: "gift_likes_min",
  likesmin: "gift_likes_min",
  emote: "emote_specific",
  sticker: "sticker_specific",
  fanclubsticker: "fanclub_sticker_specific",
  firstactivity: "first_activity",
  first: "first_activity",
  purchase: "shop_purchase",
  shop: "shop_purchase",
  comment: "chat",
  message: "chat",
  chatcommand: "command",
  newfollower: "follow",
  follower: "follow",
  sub: "subscribe",
  subscription: "subscribe",
  viewerjoin: "join",
};

const CANONICAL_WHO = new Map<string, TriggerWho>(
  triggerWhoSchema.options.map((w) => [normalizeKey(w), w]),
);

const WHO_SYNONYMS: Record<string, TriggerWho> = {
  everyone: "any",
  all: "any",
  anyone: "any",
  follower: "followers",
  subscriber: "subscribers",
  subs: "subscribers",
  moderator: "moderators",
  mods: "moderators",
  topgifters: "topgifter",
  specificuser: "specific_user",
  user: "specific_user",
};

/**
 * TikFinity "kim tetikleyebilir" alanını sayı olarak da yazabiliyor.
 * Sıra PRD §5.3'teki UI sırasıyla aynıdır.
 */
const WHO_BY_INDEX: readonly TriggerWho[] = [
  "any",
  "followers",
  "subscribers",
  "moderators",
  "topgifter",
  "specific_user",
];

export function resolveTrigger(raw: unknown): TriggerType | undefined {
  if (typeof raw === "number") return TRIGGER_BY_THIRD_PARTY_ID.get(raw);
  if (typeof raw !== "string") return undefined;

  // Sayısal string ("3") — TikFinity bazı sürümlerde string yazıyor.
  if (/^\d+$/.test(raw.trim())) {
    return TRIGGER_BY_THIRD_PARTY_ID.get(Number(raw.trim()));
  }
  const key = normalizeKey(raw);
  return CANONICAL_TRIGGERS.get(key) ?? TRIGGER_SYNONYMS[key];
}

export function resolveWho(raw: unknown): TriggerWho | undefined {
  if (typeof raw === "number") return WHO_BY_INDEX[raw];
  if (typeof raw !== "string") return undefined;
  if (/^\d+$/.test(raw.trim())) return WHO_BY_INDEX[Number(raw.trim())];
  const key = normalizeKey(raw);
  return CANONICAL_WHO.get(key) ?? WHO_SYNONYMS[key];
}

/* -------------------------------------------------------------------------- */
/* Koşullar                                                                    */
/* -------------------------------------------------------------------------- */

/** Komut `!` veya `/` ile başlamalı (PRD §5.3); eksikse `!` eklenir. */
function normalizeCommand(raw: string | undefined): string | undefined {
  const value = raw?.trim();
  if (!value) return undefined;
  const first = value.split(/\s+/)[0];
  return /^[!/]/.test(first) ? first : `!${first}`;
}

function buildConditions(source: RawRecord): EventConditions {
  // Koşullar kökte ya da `conditions`/`filter`/`data` altında olabiliyor.
  const c = { ...source, ...(rec(source, "conditions", "filter", "data", "options") ?? {}) };

  const draft: EventConditions = {
    command: normalizeCommand(str(c, "command", "chatCommand", "cmd", "keyword")),
    minTeamLevel: int(c, "minTeamLevel", "teamLevel", "minTeamMemberLevel"),
    minPointsLevel: int(c, "minPointsLevel", "pointsLevel", "minLevel"),
    minCoins: int(c, "minCoins", "coins", "minDiamonds", "diamonds", "giftValue"),
    giftId: str(c, "giftId", "gift", "giftIdentifier"),
    giftName: str(c, "giftName", "giftTitle"),
    minLikes: int(c, "minLikes", "likes", "likeCount"),
    emoteId: str(c, "emoteId", "emote", "emoteIdentifier"),
    stickerId: str(c, "stickerId", "sticker"),
    productNameContains: str(c, "productNameContains", "productName", "product"),
    topGifterCount: int(c, "topGifterCount", "topGifters", "allowedTopGifters"),
    specificUsername: str(c, "specificUsername", "username", "user", "nickname")
      ?.replace(/^@/, ""),
  };

  const cleaned = Object.fromEntries(
    Object.entries(draft).filter(([, v]) => v !== undefined && v !== ""),
  );

  const parsed = eventConditionsSchema.safeParse(cleaned);
  if (parsed.success) return parsed.data;

  // Tek bir geçersiz koşul (ör. `!` almayan komut) tüm etkinliği düşürmesin.
  for (const issue of parsed.error.issues) {
    delete (cleaned as RawRecord)[String(issue.path[0])];
  }
  return eventConditionsSchema.parse(cleaned);
}

/* -------------------------------------------------------------------------- */
/* Etkinlik                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Etkinliğin işaret ettiği eylem referanslarını bizim id'lerimize çevirir.
 * TikFinity id'siyle bulunamayan referans, eylem ADIYLA da denenir
 * (`mapActions` her iki anahtarı da haritaya yazar).
 */
function resolveRefs(
  raw: unknown,
  idMap: Map<string, string>,
  issues: IssueCollector,
  ref: string,
): string[] {
  const resolved: string[] = [];

  for (const item of asArray(raw)) {
    // Referans düz string olabilir ya da `{ id, name }` nesnesi.
    const candidates =
      typeof item === "object" && item !== null
        ? [str(item, "id", "actionId", "uuid"), str(item, "name", "title")]
        : [typeof item === "string" || typeof item === "number" ? String(item) : undefined];

    let hit: string | undefined;
    for (const candidate of candidates) {
      if (!candidate) continue;
      hit = idMap.get(candidate) ?? idMap.get(`name:${candidate.toLowerCase()}`);
      if (hit) break;
    }

    if (hit) {
      if (!resolved.includes(hit)) resolved.push(hit);
    } else {
      issues.warn({
        code: "unresolvedActionRef",
        scope: "event",
        ref,
        detail: candidates.filter(Boolean).join(" / ") || "?",
      });
    }
  }

  return resolved;
}

export function mapEvents(
  rawEvents: unknown[],
  idMap: Map<string, string>,
  issues: IssueCollector,
): StreamEvent[] {
  const events: StreamEvent[] = [];
  const seenSignatures = new Set<string>();

  for (const raw of rawEvents) {
    if (typeof raw !== "object" || raw === null) continue;
    const source = raw as RawRecord;

    const externalId = str(source, "id", "eventId", "uuid");
    // `pick` normalize edilmiş anahtarla arar: `trigger_type_id` de yakalanır.
    const triggerRaw = pick(
      source,
      "triggerTypeId",
      "triggerType",
      "trigger",
      "type",
      "eventType",
    );

    const trigger = resolveTrigger(triggerRaw);
    const ref = str(source, "name", "title") ?? externalId ?? String(triggerRaw ?? "?");

    if (!trigger) {
      issues.skip({
        code: "unknownTrigger",
        scope: "event",
        ref,
        detail: String(triggerRaw ?? ""),
      });
      continue;
    }

    const who =
      resolveWho(pick(source, "who", "role", "userRole", "triggeredBy")) ?? "any";
    const conditions = buildConditions(source);

    // Zorunlu koşulu olmayan tetikleyici motorda hatalı eşleşme yaratır.
    const requiredKey = REQUIRED_CONDITION[trigger];
    if (requiredKey && conditions[requiredKey] === undefined) {
      issues.skip({
        code: "missingCondition",
        scope: "event",
        ref,
        detail: requiredKey,
      });
      continue;
    }

    const actionsAll = resolveRefs(
      pick(source, "actionsAll", "actions", "allActions", "actionIds"),
      idMap,
      issues,
      ref,
    );
    const actionsRandom = resolveRefs(
      pick(source, "actionsRandom", "randomActions", "oneOfActions"),
      idMap,
      issues,
      ref,
    );

    if (actionsAll.length + actionsRandom.length === 0) {
      issues.skip({ code: "noLinkedActions", scope: "event", ref });
      continue;
    }

    const signature = eventSignature({ trigger, who, conditions });
    if (seenSignatures.has(signature)) {
      issues.skip({ code: "duplicateEvent", scope: "event", ref, detail: signature });
      continue;
    }

    const parsed = eventSchema.safeParse({
      id: newId("evt"),
      active: bool(source, "active", "enabled", "isActive") ?? true,
      trigger,
      who,
      conditions,
      actionsAll,
      actionsRandom,
    });

    if (!parsed.success) {
      issues.skip({
        code: "invalidRecord",
        scope: "event",
        ref,
        detail: parsed.error.issues[0]?.message,
      });
      continue;
    }

    seenSignatures.add(signature);
    events.push(parsed.data);
  }

  return events;
}

/* -------------------------------------------------------------------------- */
/* Zamanlayıcılar                                                              */
/* -------------------------------------------------------------------------- */

export function mapTimers(
  rawTimers: unknown[],
  idMap: Map<string, string>,
  issues: IssueCollector,
): StreamTimer[] {
  const timers: StreamTimer[] = [];

  for (const raw of rawTimers) {
    if (typeof raw !== "object" || raw === null) continue;
    const source = raw as RawRecord;

    const ref = str(source, "name", "title", "id") ?? "?";
    const actionRefRaw =
      str(source, "actionId", "action", "targetAction") ?? undefined;
    const actionId = actionRefRaw
      ? (idMap.get(actionRefRaw) ?? idMap.get(`name:${actionRefRaw.toLowerCase()}`))
      : undefined;

    if (!actionId) {
      issues.skip({
        code: "unresolvedActionRef",
        scope: "timer",
        ref,
        detail: actionRefRaw,
      });
      continue;
    }

    // TikFinity dakika ya da saniye yazabiliyor; alan adı "sec" içeriyorsa çevir.
    const minutesRaw = int(source, "intervalMinutes", "interval", "everyMinutes");
    const secondsRaw = int(source, "intervalSeconds", "intervalSec");
    const minutes =
      minutesRaw ?? (secondsRaw !== undefined ? Math.max(1, Math.round(secondsRaw / 60)) : undefined);

    const parsed = timerSchema.safeParse({
      id: newId("tmr"),
      active: bool(source, "active", "enabled") ?? true,
      intervalMinutes: Math.min(1440, Math.max(1, minutes ?? 15)),
      actionId,
    });

    if (!parsed.success) {
      issues.skip({
        code: "invalidRecord",
        scope: "timer",
        ref,
        detail: parsed.error.issues[0]?.message,
      });
      continue;
    }

    if (minutes === undefined) {
      issues.warn({ code: "valueClamped", scope: "timer", ref, detail: "15" });
    }

    timers.push(parsed.data);
  }

  return timers;
}
