/**
 * TOLERANSLI ALAN OKUYUCULARI — ADR-0007.
 *
 * TikFinity'nin `.tfc` şeması belgelenmemiş ve sürümler arasında alan adları
 * değişebiliyor (`duration` / `durationSec` / `display_duration` gibi). Sabit
 * bir şemaya bağlanmak yerine:
 *
 *   1) Her nesnenin anahtarları NORMALİZE edilir (küçük harf, `_`/`-`/boşluk
 *      atılır) → `points_per_coin`, `pointsPerCoin` ve `PointsPerCoin` aynı
 *      anahtara düşer, alias listeleri kısalır.
 *   2) `pick()` birden çok aday adı sırayla dener, ilk TANIMLI değeri döner.
 *   3) Tip dönüştürücüler ("5", 5, "true", 1 …) hoşgörülüdür — TikFinity bazı
 *      alanları string olarak yazıyor.
 *
 * Bu katman DOĞRULAMA yapmaz; doğrulama `lib/schemas/*` Zod şemalarındadır.
 */

export type RawRecord = Record<string, unknown>;

/** Anahtar normalizasyonu: `Points_Per Coin` → `pointspercoin`. */
export function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[\s_\-.]/g, "");
}

/**
 * Nesnenin normalize edilmiş anahtar indeksi.
 *
 * WeakMap ile önbelleklenir: aynı kaynak nesne onlarca kez okunuyor (bir eylem
 * için ~20 alan) ve her seferinde indeks kurmak binlerce kayıtta israf olur.
 */
const indexCache = new WeakMap<object, Map<string, unknown>>();

export function indexOf(source: unknown): Map<string, unknown> {
  if (typeof source !== "object" || source === null) return new Map();

  const cached = indexCache.get(source);
  if (cached) return cached;

  const map = new Map<string, unknown>();
  for (const [key, value] of Object.entries(source as RawRecord)) {
    const normalized = normalizeKey(key);
    // İlk gelen kazanır: `duration` ile `Duration` çakışırsa özgün sıra korunur.
    if (!map.has(normalized)) map.set(normalized, value);
  }
  indexCache.set(source, map);
  return map;
}

/** Aday adlardan ilk tanımlı (null/undefined olmayan) değeri döner. */
export function pick(source: unknown, ...aliases: string[]): unknown {
  const index = indexOf(source);
  for (const alias of aliases) {
    const value = index.get(normalizeKey(alias));
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
}

/** `pick` + varlık kontrolü — alanın hiç olmadığını anlamak için. */
export function has(source: unknown, ...aliases: string[]): boolean {
  return pick(source, ...aliases) !== undefined;
}

/* -------------------------------------------------------------------------- */
/* Tip dönüştürücüler                                                          */
/* -------------------------------------------------------------------------- */

export function asString(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  return undefined;
}

export function asNumber(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return undefined;
    // Virgüllü ondalık (TR yerel ayarıyla yazılmış olabilir).
    const parsed = Number(trimmed.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

export function asInt(value: unknown): number | undefined {
  const n = asNumber(value);
  return n === undefined ? undefined : Math.round(n);
}

/**
 * `true`/`"true"`/`"1"`/`1`/`"yes"`/`"on"` → true.
 * TikFinity bazı toggle'ları 0/1 sayı olarak yazıyor.
 */
export function asBool(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (["true", "1", "yes", "on", "evet"].includes(v)) return true;
    if (["false", "0", "no", "off", "hayir", "hayır"].includes(v)) return false;
  }
  return undefined;
}

/**
 * Diziye çevirir. Tek değer verilmişse tek elemanlı dizi, virgülle ayrılmış
 * string verilmişse bölünmüş dizi döner (TikFinity her ikisini de kullanıyor).
 */
export function asArray(value: unknown): unknown[] {
  if (value === undefined || value === null) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return [];
    if (trimmed.includes(",")) return trimmed.split(",").map((s) => s.trim());
    return [trimmed];
  }
  return [value];
}

export function asStringArray(value: unknown): string[] {
  return asArray(value)
    .map(asString)
    .filter((s): s is string => s !== undefined && s !== "");
}

export function asRecord(value: unknown): RawRecord | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as RawRecord)
    : undefined;
}

/* -------------------------------------------------------------------------- */
/* Kısayollar — `pick` + dönüştürme tek çağrıda                                */
/* -------------------------------------------------------------------------- */

export const str = (s: unknown, ...a: string[]) => asString(pick(s, ...a));
export const num = (s: unknown, ...a: string[]) => asNumber(pick(s, ...a));
export const int = (s: unknown, ...a: string[]) => asInt(pick(s, ...a));
export const bool = (s: unknown, ...a: string[]) => asBool(pick(s, ...a));
export const list = (s: unknown, ...a: string[]) => asArray(pick(s, ...a));
export const strList = (s: unknown, ...a: string[]) => asStringArray(pick(s, ...a));
export const rec = (s: unknown, ...a: string[]) => asRecord(pick(s, ...a));

/* -------------------------------------------------------------------------- */
/* Aralık kırpma                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Değeri şema aralığına çeker. `onClamp` çağrılırsa çağıran taraf uyarı
 * kaydeder — sessizce veri bozmak yerine kullanıcıya raporlanır.
 */
export function clamp(
  value: number | undefined,
  min: number,
  max: number,
  fallback: number,
  onClamp?: () => void,
): number {
  if (value === undefined) return fallback;
  if (value < min || value > max) {
    onClamp?.();
    return Math.min(max, Math.max(min, value));
  }
  return value;
}

/**
 * Süre alanı saniyeye çevrilir. TikFinity bazı sürümlerde milisaniye yazıyor;
 * alan adında "ms" geçiyorsa veya değer makul süre tavanını (600 sn) aşıyorsa
 * milisaniye varsayılır.
 */
export function toSeconds(source: unknown, ...aliases: string[]): number | undefined {
  const index = indexOf(source);
  for (const alias of aliases) {
    const key = normalizeKey(alias);
    const raw = index.get(key);
    if (raw === undefined || raw === null) continue;
    const value = asNumber(raw);
    if (value === undefined) continue;
    const isMs = key.includes("ms") || key.includes("millis") || value > 600;
    return isMs ? value / 1000 : value;
  }
  return undefined;
}

/** Süre alanı milisaniyeye çevrilir (fade in/out gibi). */
export function toMillis(source: unknown, ...aliases: string[]): number | undefined {
  const index = indexOf(source);
  for (const alias of aliases) {
    const key = normalizeKey(alias);
    const raw = index.get(key);
    if (raw === undefined || raw === null) continue;
    const value = asNumber(raw);
    if (value === undefined) continue;
    // "sec"/"s" içeren ad veya ≤10 gibi küçük değer saniye kabul edilir.
    const isSeconds = key.includes("sec") || (value > 0 && value <= 10);
    return isSeconds ? Math.round(value * 1000) : Math.round(value);
  }
  return undefined;
}
