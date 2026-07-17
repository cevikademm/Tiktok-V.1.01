import type { LiveEvent } from "@/lib/schemas/live";

/**
 * Placeholder ikamesi — PRD §5.3 değişken listesi.
 * `{username}` → gerçek değer. Bilinmeyen placeholder olduğu gibi bırakılır.
 */

export interface PlaceholderContext {
  event?: LiveEvent;
  points?: number;
  level?: number;
  rank?: number;
  currencyName?: string;
  amount?: number;
  destination?: string;
  playerName?: string;
}

export function buildPlaceholderMap(ctx: PlaceholderContext): Record<string, string> {
  const ev = ctx.event;
  const map: Record<string, string> = {};

  if (ev) {
    map.username = ev.user.uniqueId;
    map.nickname = ev.user.nickname;
    if (ev.comment !== undefined) map.comment = ev.comment;
    if (ev.giftName !== undefined) map.giftname = ev.giftName;
    if (ev.coins !== undefined) map.coins = String(ev.coins);
    if (ev.repeatCount !== undefined) map.repeatcount = String(ev.repeatCount);
    if (ev.likeCount !== undefined) map.likecount = String(ev.likeCount);
    if (ev.totalLikeCount !== undefined)
      map.totallikecount = String(ev.totalLikeCount);
    if (ev.subMonth !== undefined) map.submonth = String(ev.subMonth);
  }

  if (ctx.points !== undefined) map.points = String(ctx.points);
  if (ctx.level !== undefined) map.level = String(ctx.level);
  if (ctx.rank !== undefined) map.rank = String(ctx.rank);
  if (ctx.currencyName !== undefined) map.currencyname = ctx.currencyName;
  if (ctx.amount !== undefined) map.amount = String(ctx.amount);
  if (ctx.destination !== undefined) map.destination = ctx.destination;
  if (ctx.playerName !== undefined) map.playername = ctx.playerName;

  return map;
}

export function renderPlaceholders(
  template: string,
  ctx: PlaceholderContext,
): string {
  const map = buildPlaceholderMap(ctx);
  return template.replace(/\{([a-z_]+)\}/gi, (match, key: string) => {
    const value = map[key.toLowerCase()];
    return value !== undefined ? value : match;
  });
}
