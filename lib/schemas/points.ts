import { z } from "zod";

/**
 * Puan ekonomisi — PRD §5.7 / §7.
 * KURAL: tüm puanlar TAMSAYI, ledger append-only (float yasak).
 */

export const viewerSchema = z.object({
  userId: z.string(),
  uniqueId: z.string(),
  nickname: z.string(),
  profilePictureUrl: z.string().optional(),
  points: z.number().int(),
  level: z.number().int().min(0),
  firstActivityTs: z.number().int(),
  lastActivityTs: z.number().int(),
});
export type Viewer = z.infer<typeof viewerSchema>;

/** Transactions defteri — append-only (PRD §5.7 kolonları). */
export const transactionSchema = z.object({
  id: z.string(),
  streamer: z.string(),
  userId: z.string(),
  uniqueId: z.string(),
  amount: z.number().int(),
  description: z.string().max(200),
  /** "count to level" bayrağı — seviyeye sayılsın mı. */
  countToLevel: z.boolean().default(true),
  ts: z.number().int(),
  /** Idempotency — aynı canlı olay iki kez ledger'a yazılmaz (PRD §13). */
  sourceEventId: z.string().optional(),
});
export type Transaction = z.infer<typeof transactionSchema>;

export const manualTransactionSchema = z.object({
  uniqueId: z.string().min(1),
  amount: z.number().int(),
  description: z.string().max(200).default(""),
  countToLevel: z.boolean().default(true),
});
export type ManualTransactionForm = z.infer<typeof manualTransactionSchema>;

/**
 * Seviye hesabı — PRD §5.2 "Seviye Puanları (varsayılan 50), Seviye Çarpanı (üstel eğri)".
 * Seviye N'ye çıkmak için gereken kümülatif puan:
 *   sum(i=0..N-1) pointsPerLevel * multiplier^i
 */
export function levelForPoints(
  points: number,
  pointsPerLevel: number,
  multiplier: number,
): number {
  if (points <= 0 || pointsPerLevel <= 0) return 0;
  let level = 0;
  let cumulative = 0;
  let step = pointsPerLevel;
  // Üst sınır: sonsuz döngü koruması (PRD §10 Pro kapasitesi 100k kullanıcı).
  while (level < 1000) {
    cumulative += step;
    if (points < cumulative) break;
    level += 1;
    step = Math.round(step * multiplier);
    if (step <= 0) break;
  }
  return level;
}

/** Seviye listesi ("Seviye listesini göster" — PRD §5.2). */
export function levelTable(
  pointsPerLevel: number,
  multiplier: number,
  count = 20,
): Array<{ level: number; required: number; cumulative: number }> {
  const rows: Array<{ level: number; required: number; cumulative: number }> =
    [];
  let cumulative = 0;
  let step = pointsPerLevel;
  for (let level = 1; level <= count; level++) {
    cumulative += step;
    rows.push({ level, required: step, cumulative });
    step = Math.round(step * multiplier);
  }
  return rows;
}

/** Halving — tüm puanları %X azalt, seviyeler sabit (PRD §5.7). */
export const halvingSchema = z.object({
  percent: z.number().int().min(1).max(99).default(50),
});

/** Kazanç kaynağı — ledger açıklamasında i18n anahtarı olarak kullanılır. */
export const earnSourceSchema = z.enum([
  "coin",
  "share",
  "chatMinute",
  "subscriberBonus",
  "manual",
  "action",
]);
export type EarnSource = z.infer<typeof earnSourceSchema>;
