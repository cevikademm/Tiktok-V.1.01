import {
  gameMeta,
  type AutoSwitchState,
  type GameSignal,
  type StreamProfile,
  type SwitchDecision,
} from "@/lib/schemas/stream-profile";

/**
 * Profil otomatik geçiş çözücüsü — saf TypeScript (CLAUDE.md §5.5).
 * DOM/React bağımlılığı yok, zaman dışarıdan enjekte edilir (test edilebilirlik).
 *
 * Öncelik sırası:
 *   1. Ana anahtar kapalı        → geçiş yok
 *   2. Elle seçim askısı sürüyor → geçiş yok (yayıncının bilinçli seçimi korunur)
 *   3. gameId birebir eşleşme    → en güçlü sinyal
 *   4. Başlık kelime eşleşmesi   → en UZUN eşleşen kelime kazanır ("gta v" > "gta")
 *   5. Hedef zaten aktif         → geçiş yok
 *   6. Asgari kalma süresi (dwell) dolmadı → geçiş yok (flapping kalkanı)
 */

export interface SwitchContext {
  profiles: StreamProfile[];
  activeProfileId: string;
  signal: GameSignal;
  state: AutoSwitchState;
  /** Aktif profile en son geçilen an (ms epoch). */
  lastSwitchAt: number;
  now: number;
}

/** Birleşen aksan işaretleri (U+0300–U+036F) — NFD sonrası atılır. */
const COMBINING_MARKS = /[̀-ͯ]/g;

/**
 * Aksan/nokta katlayan normalleştirme — hem başlık hem kelime aynı süzgeçten geçer.
 *
 * DİKKAT: `toLocaleLowerCase("tr")` KULLANILMAZ. Türkçe kuralı "FREE FIRE" → "free fıre"
 * üretir ve İngilizce oyun adı katalogla eşleşmez. Bunun yerine önce aksanlar ayrıştırılıp
 * atılır, sonra İ/I/ı tek bir "i" harfine katlanır: "PUBG'İ" → "pubg'i", "Şarkı" → "sarki".
 */
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .replace(/[İIı]/g, "i")
    .toLowerCase();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Kelime sınırıyla arama. `\b` Unicode harflerde güvenilir değildir; harf/rakam
 * olmayan komşuluk şartı kullanılır — böylece "ff" kelimesi "off" içinde eşleşmez.
 */
function containsKeyword(haystack: string, keyword: string): boolean {
  const kw = normalize(keyword).trim();
  if (!kw) return false;
  const re = new RegExp(
    `(?<![\\p{L}\\p{N}])${escapeRegExp(kw)}(?![\\p{L}\\p{N}])`,
    "u",
  );
  return re.test(haystack);
}

/** Profilin tüm arama kelimeleri: katalog kelimeleri + kullanıcının eklediği kelimeler. */
export function profileKeywords(profile: StreamProfile): string[] {
  const fromCatalog = profile.autoSwitch.gameId
    ? [...gameMeta(profile.autoSwitch.gameId).keywords]
    : [];
  return [...fromCatalog, ...profile.autoSwitch.keywords];
}

/**
 * Sinyale en uygun profili bulur. Karar vermez; yalnız adayı döner
 * (kararın tamamı `resolveSwitch` içinde, tek yerde).
 */
export function matchProfile(
  profiles: StreamProfile[],
  signal: GameSignal,
): { profile: StreamProfile; matchedBy: "gameId" | "keyword" } | null {
  const candidates = profiles.filter((p) => p.autoSwitch.enabled);

  if (signal.gameId) {
    const exact = candidates.find((p) => p.autoSwitch.gameId === signal.gameId);
    if (exact) return { profile: exact, matchedBy: "gameId" };
  }

  const title = normalize(signal.title ?? "");
  if (!title) return null;

  let best: { profile: StreamProfile; score: number } | null = null;
  for (const profile of candidates) {
    for (const keyword of profileKeywords(profile)) {
      if (!containsKeyword(title, keyword)) continue;
      const score = normalize(keyword).trim().length;
      // Eşitlikte listede önce gelen kazanır — sonuç deterministik olmalı.
      if (!best || score > best.score) best = { profile, score };
    }
  }

  return best ? { profile: best.profile, matchedBy: "keyword" } : null;
}

export function resolveSwitch(ctx: SwitchContext): SwitchDecision {
  const { profiles, activeProfileId, signal, state, lastSwitchAt, now } = ctx;

  if (!state.enabled) return { switched: false, reason: "disabled" };
  if (now < state.manualHoldUntil) return { switched: false, reason: "manualHold" };

  const match = matchProfile(profiles, signal);
  if (!match) return { switched: false, reason: "noMatch" };

  if (match.profile.id === activeProfileId) {
    return { switched: false, reason: "alreadyActive" };
  }

  const dwellMs = state.minDwellSeconds * 1000;
  if (dwellMs > 0 && now - lastSwitchAt < dwellMs) {
    return { switched: false, reason: "dwell" };
  }

  return { switched: true, profileId: match.profile.id, matchedBy: match.matchedBy };
}
