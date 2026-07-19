import { z } from "zod";

/**
 * Akış Profilleri (Stream Profiles) — PRD §3 "Stream Profiles" + §10 limit tablosu
 * (Free 1 / Pro 10). Her profil bağımsız bir ayar seti taşır ve bir oyuna bağlanır;
 * yayındaki oyun değiştiğinde profil otomatik değişir (bkz. lib/engine/profile-switcher).
 *
 * Liste DİNAMİKTİR: içe aktarma/kopyalama profil sayısını artırır, silme azaltır
 * (ADR-0006). Sıra dizinin kendi sırasıdır; topbar "Stream Profile {n}" için index kullanır.
 *
 * Profil ADI kullanıcı verisidir (i18n kapsamı dışı). Boş bırakılırsa UI, bağlı oyunun
 * çevirisini (`streamProfiles.games.<id>`) gösterir — böylece hardcoded string doğmaz.
 */

/** PRD §10 üst sınırı — liste bu sayıyı aşamaz; dolduğunda kullanıcı silerek yer açar. */
export const MAX_STREAM_PROFILES = 10;

export const GAME_IDS = [
  "pubg-mobile",
  "free-fire",
  "valorant",
  "league-of-legends",
  "cs2",
  "minecraft",
  "gta-rp",
  "fortnite",
  "roblox",
  "just-chatting",
] as const;

export const gameIdSchema = z.enum(GAME_IDS);
export type GameId = (typeof GAME_IDS)[number];

export interface GameMeta {
  id: GameId;
  emoji: string;
  /**
   * Yayın başlığında aranan kelimeler. Eşleşme KELİME SINIRIYLA yapılır
   * ("ff" → "off" içinde eşleşmez), bu yüzden kısa kısaltmalar da güvenlidir.
   */
  keywords: readonly string[];
}

/** Oyun kataloğu — 10 slot için varsayılan bağlama. Etiketler i18n'den gelir. */
export const GAME_CATALOG: readonly GameMeta[] = [
  { id: "pubg-mobile", emoji: "🎯", keywords: ["pubg", "pubgm", "erangel", "metro royale"] },
  { id: "free-fire", emoji: "🔥", keywords: ["free fire", "freefire", "ff", "garena"] },
  { id: "valorant", emoji: "🔫", keywords: ["valorant", "valo", "vlr"] },
  { id: "league-of-legends", emoji: "⚔️", keywords: ["league of legends", "lol", "aram"] },
  { id: "cs2", emoji: "💣", keywords: ["cs2", "csgo", "counter strike", "counter-strike"] },
  { id: "minecraft", emoji: "⛏️", keywords: ["minecraft", "skyblock", "bedwars"] },
  { id: "gta-rp", emoji: "🚗", keywords: ["gta", "gta v", "gta 5", "fivem", "roleplay"] },
  { id: "fortnite", emoji: "🪂", keywords: ["fortnite", "zero build"] },
  { id: "roblox", emoji: "🧱", keywords: ["roblox", "brookhaven", "adopt me"] },
  { id: "just-chatting", emoji: "💬", keywords: ["sohbet", "just chatting", "muhabbet"] },
] as const;

export function gameMeta(id: GameId): GameMeta {
  const meta = GAME_CATALOG.find((g) => g.id === id);
  // Katalog GAME_IDS ile aynı kaynaktan türer; bulunamaması tip dışı bir çağrı demektir.
  if (!meta) throw new Error(`Bilinmeyen oyun: ${id}`);
  return meta;
}

/* -------------------------------------------------------------------------- */
/* Profil ayar seti                                                            */
/* -------------------------------------------------------------------------- */

export const profileSettingsSchema = z.object({
  ttsEnabled: z.boolean().default(true),
  ttsVolume: z.number().int().min(0).max(100).default(70),
  soundsEnabled: z.boolean().default(true),
  soundsVolume: z.number().int().min(0).max(100).default(70),
  actionsEnabled: z.boolean().default(true),
  chatbotEnabled: z.boolean().default(true),
  songRequestsEnabled: z.boolean().default(false),
  /** Puan çarpanı yüzde olarak — 100 = 1x. Tamsayı (float yasak, CLAUDE.md §5.6). */
  pointsMultiplierPercent: z.number().int().min(0).max(1000).default(100),
  /** Bu profilin kullandığı overlay kuyruğu — PRD §5.4 (8 ekran). */
  overlayScreen: z.number().int().min(1).max(8).default(1),
  /** Hediye eylemleri için asgari coin eşiği. */
  giftMinCoins: z.number().int().min(0).default(1),
  /** Eylem başına genel bekleme (sn) — rekabetçi oyunlarda spam kısma. */
  cooldownSeconds: z.number().int().min(0).max(3600).default(0),
});
export type ProfileSettings = z.infer<typeof profileSettingsSchema>;
export type ProfileSettingsInput = z.input<typeof profileSettingsSchema>;

/** Profili hangi sinyalin seçeceği. */
export const autoSwitchRuleSchema = z.object({
  enabled: z.boolean().default(true),
  gameId: gameIdSchema.nullable().default(null),
  /** Kullanıcının eklediği ek başlık kelimeleri (katalog kelimelerine EK). */
  keywords: z.array(z.string().min(1).max(32)).max(10).default([]),
});
export type AutoSwitchRule = z.infer<typeof autoSwitchRuleSchema>;

/** Kimliksiz profil gövdesi — oluşturma/kopyalama/içe aktarma girdisi. */
export const streamProfileDraftSchema = z.object({
  /** Kullanıcı verisi; boşsa UI oyun çevirisine düşer. */
  name: z.string().max(32).default(""),
  emoji: z.string().min(1).max(8).default("🌹"),
  // `.default({})` zod tipinde TAM nesne ister; her ayrıştırmada taze varsayılan
  // üretmek için fabrika kullanılır (paylaşılan referans mutasyonu da böylece olmaz).
  autoSwitch: autoSwitchRuleSchema.default(() => autoSwitchRuleSchema.parse({})),
  settings: profileSettingsSchema.default(() => profileSettingsSchema.parse({})),
});
export type StreamProfileDraft = z.infer<typeof streamProfileDraftSchema>;

export const streamProfileSchema = streamProfileDraftSchema.extend({
  id: z.string().min(1),
});
export type StreamProfile = z.infer<typeof streamProfileSchema>;

/**
 * Dosya biçimi — "Profili Dışa Aktar" / "İçe Aktar".
 * `kind` + `version` ileride biçim değişirse göç yazabilmek için zorunlu.
 */
export const streamProfileFileSchema = z.object({
  kind: z.literal("livekit.streamProfile"),
  version: z.literal(1),
  profile: streamProfileDraftSchema,
});
export type StreamProfileFile = z.infer<typeof streamProfileFileSchema>;

/** Profil limiti dolduğunda repo bu kodu fırlatır; UI mesajı i18n'den gelir. */
export const PROFILE_LIMIT_ERROR = "STREAM_PROFILE_LIMIT";
/** Son profil silinemez — en az bir aktif profil kalmalı. */
export const PROFILE_LAST_ERROR = "STREAM_PROFILE_LAST";

/* -------------------------------------------------------------------------- */
/* Otomatik geçiş durumu ve sinyali                                            */
/* -------------------------------------------------------------------------- */

export const autoSwitchStateSchema = z.object({
  /** Ana anahtar — kapalıyken profil yalnız elle değişir. */
  enabled: z.boolean().default(true),
  /**
   * Elle profil seçildikten sonra otomatik geçişin askıya alınacağı süre (sn).
   * 0 = askı yok. Yayıncının bilinçli seçimini algılama ezmesin diye vardır.
   */
  manualHoldSeconds: z.number().int().min(0).max(3600).default(300),
  /** Bir geçişten sonra yeni geçiş için beklenecek asgari süre (sn) — flapping kalkanı. */
  minDwellSeconds: z.number().int().min(0).max(3600).default(60),
  /** Elle seçimin askı bitiş anı (ms epoch). */
  manualHoldUntil: z.number().int().min(0).default(0),
});
export type AutoSwitchState = z.infer<typeof autoSwitchStateSchema>;

/** Oyun sinyali — Faz 1'de elle/simülasyon, Faz 2'de connector besler. */
export const gameSignalSchema = z.object({
  gameId: gameIdSchema.nullable().default(null),
  /** Yayın başlığı — gameId yoksa kelime eşleşmesi buradan yapılır. */
  title: z.string().max(150).default(""),
  source: z.enum(["manual", "title", "connector"]).default("manual"),
  ts: z.number().int().min(0).default(0),
});
export type GameSignal = z.infer<typeof gameSignalSchema>;

/**
 * Geçiş kararı. `ports.ts` bu tipi döndürür; motor (lib/engine) üretir —
 * tip tek kaynakta (şema) tutulduğu için port katmanı motora bağımlı olmaz.
 */
export const switchDecisionSchema = z.discriminatedUnion("switched", [
  z.object({
    switched: z.literal(true),
    profileId: z.string(),
    matchedBy: z.enum(["gameId", "keyword"]),
  }),
  z.object({
    switched: z.literal(false),
    reason: z.enum(["disabled", "manualHold", "noMatch", "alreadyActive", "dwell"]),
  }),
]);
export type SwitchDecision = z.infer<typeof switchDecisionSchema>;

/* -------------------------------------------------------------------------- */
/* Varsayılan 10 profil — her oyun için farklı ayar seti                        */
/* -------------------------------------------------------------------------- */

/**
 * Oyun başına varsayılanlar. Mantık: rekabetçi FPS/MOBA'da (valorant, lol, cs2)
 * TTS kapalı + düşük ses + yüksek cooldown (odak), sandbox/sohbet yayınlarında
 * (minecraft, roblox, sohbet) TTS açık + şarkı isteği açık + düşük cooldown.
 * Overlay ekranları çakışmasın diye profil başına ayrı kuyruk verilir.
 */
const GAME_DEFAULTS: Record<GameId, ProfileSettingsInput> = {
  "pubg-mobile": {
    ttsEnabled: true,
    ttsVolume: 55,
    soundsVolume: 60,
    pointsMultiplierPercent: 100,
    overlayScreen: 1,
    giftMinCoins: 1,
    cooldownSeconds: 5,
  },
  "free-fire": {
    ttsEnabled: true,
    ttsVolume: 60,
    soundsVolume: 70,
    pointsMultiplierPercent: 120,
    overlayScreen: 2,
    giftMinCoins: 1,
    cooldownSeconds: 4,
  },
  valorant: {
    ttsEnabled: false,
    ttsVolume: 40,
    soundsVolume: 45,
    chatbotEnabled: true,
    pointsMultiplierPercent: 100,
    overlayScreen: 3,
    giftMinCoins: 5,
    cooldownSeconds: 10,
  },
  "league-of-legends": {
    ttsEnabled: false,
    ttsVolume: 40,
    soundsVolume: 50,
    pointsMultiplierPercent: 100,
    overlayScreen: 4,
    giftMinCoins: 5,
    cooldownSeconds: 12,
  },
  cs2: {
    ttsEnabled: false,
    ttsVolume: 35,
    soundsVolume: 40,
    pointsMultiplierPercent: 110,
    overlayScreen: 5,
    giftMinCoins: 10,
    cooldownSeconds: 15,
  },
  minecraft: {
    ttsEnabled: true,
    ttsVolume: 70,
    soundsVolume: 75,
    songRequestsEnabled: true,
    pointsMultiplierPercent: 150,
    overlayScreen: 6,
    giftMinCoins: 1,
    cooldownSeconds: 0,
  },
  "gta-rp": {
    ttsEnabled: true,
    ttsVolume: 65,
    soundsVolume: 55,
    songRequestsEnabled: true,
    pointsMultiplierPercent: 130,
    overlayScreen: 7,
    giftMinCoins: 1,
    cooldownSeconds: 3,
  },
  fortnite: {
    ttsEnabled: true,
    ttsVolume: 60,
    soundsVolume: 65,
    pointsMultiplierPercent: 110,
    overlayScreen: 8,
    giftMinCoins: 1,
    cooldownSeconds: 6,
  },
  roblox: {
    ttsEnabled: true,
    ttsVolume: 75,
    soundsVolume: 80,
    songRequestsEnabled: true,
    pointsMultiplierPercent: 140,
    overlayScreen: 1,
    giftMinCoins: 1,
    cooldownSeconds: 2,
  },
  "just-chatting": {
    ttsEnabled: true,
    ttsVolume: 85,
    soundsVolume: 70,
    songRequestsEnabled: true,
    pointsMultiplierPercent: 100,
    overlayScreen: 2,
    giftMinCoins: 1,
    cooldownSeconds: 0,
  },
};

/** Başlangıç seti — katalog sırasıyla 10 profil, her biri bir oyuna bağlı. */
export function defaultStreamProfiles(): StreamProfile[] {
  return GAME_CATALOG.map((game) =>
    streamProfileSchema.parse({
      id: `prf_${game.id}`,
      name: "",
      emoji: game.emoji,
      autoSwitch: { enabled: true, gameId: game.id, keywords: [] },
      settings: profileSettingsSchema.parse(GAME_DEFAULTS[game.id]),
    }),
  );
}

/** Yeni profil taslağı — bağlanacak oyun verilirse o oyunun varsayılanlarıyla gelir. */
export function draftForGame(gameId: GameId | null): StreamProfileDraft {
  const meta = gameId ? gameMeta(gameId) : null;
  return streamProfileDraftSchema.parse({
    name: "",
    emoji: meta?.emoji ?? "🌹",
    autoSwitch: { enabled: gameId !== null, gameId, keywords: [] },
    settings: profileSettingsSchema.parse(gameId ? GAME_DEFAULTS[gameId] : {}),
  });
}
