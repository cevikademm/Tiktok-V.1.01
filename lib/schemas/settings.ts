import { z } from "zod";

/**
 * Setup (Kurmak) sayfası — 14 alt bölümün form şemaları (PRD §5.2).
 * Bölüm anahtarları alt menü sırasıyla birebir.
 */

export const SETUP_SECTIONS = [
  "tiktokAccount",
  "pointsSystem",
  "subscriberBonus",
  "levelSettings",
  "obsConnection",
  "streamerbotConnection",
  "minecraftConnection",
  "resetPoints",
  "pro",
  "patreon",
  "account",
  "importExport",
  "advanced",
  "debug",
] as const;
export type SetupSection = (typeof SETUP_SECTIONS)[number];

/** 1 — TikTok Hesabınızı Bağlayın */
export const tiktokAccountSchema = z.object({
  username: z
    .string()
    .min(1, { message: "required" })
    .max(24)
    .regex(/^@?[A-Za-z0-9._]+$/, { message: "invalidUsername" })
    .transform((v) => v.replace(/^@/, "")),
});
export type TiktokAccountForm = z.infer<typeof tiktokAccountSchema>;

/** 2 — Puan Sistemi */
export const pointsSystemSchema = z.object({
  currencyName: z.string().min(1).max(24).default("Puan"),
  pointsPerCoin: z.number().int().min(0).default(1),
  pointsPerShare: z.number().int().min(0).default(5),
  pointsPerChatMinute: z.number().int().min(0).default(1),
});
export type PointsSystemForm = z.infer<typeof pointsSystemSchema>;
/**
 * `.default()` kullanan şemalarda giriş tipi alanları opsiyoneldir, çıkış tipinde zorunlu.
 * React Hook Form her ikisini de ayrı ayrı ister: useForm<Input, unknown, Output>.
 */
export type PointsSystemInput = z.input<typeof pointsSystemSchema>;

/** 3 — Abone Bonusu (çarpan %) */
export const subscriberBonusSchema = z.object({
  bonusRatePercent: z.number().int().min(0).max(1000).default(100),
});

/** 4 — Seviye Ayarları */
export const levelSettingsSchema = z.object({
  /** Seviye Puanları — varsayılan 50 (PRD §5.2). */
  pointsPerLevel: z.number().int().min(1).default(50),
  /** Seviye Çarpanı — üstel eğri. */
  levelMultiplier: z.number().min(1).max(5).default(1.2),
});
export type LevelSettingsForm = z.infer<typeof levelSettingsSchema>;
export type LevelSettingsInput = z.input<typeof levelSettingsSchema>;

/** 5 — OBS Bağlantısı (obs-websocket v5) */
export const obsConnectionSchema = z.object({
  ip: z.string().min(1).default("127.0.0.1"),
  port: z.number().int().min(1).max(65535).default(4455),
  password: z.string().default(""),
});

/** 6 — Streamer.bot Bağlantısı */
export const streamerbotConnectionSchema = z.object({
  address: z.string().min(1).default("127.0.0.1"),
  port: z.number().int().min(1).max(65535).default(8080),
  endpoint: z.string().default("/"),
});

/** 7 — Minecraft Bağlantısı (Fabric mod / ServerTap plugin) */
export const minecraftConnectionSchema = z.object({
  mode: z.enum(["fabric", "servertap"]).default("fabric"),
  playerName: z.string().default(""),
  ip: z.string().default("127.0.0.1"),
  /** ServerTap varsayılan portu — PRD Ek A. */
  port: z.number().int().min(1).max(65535).default(4567),
  password: z.string().default(""),
});

/** 13 — Advanced Settings */
export const advancedSettingsSchema = z.object({
  serverSideConnection: z.boolean().default(false),
  openInNewWindow: z.boolean().default(false),
  localizedGiftNames: z.boolean().default(false),
  useDisplayNames: z.boolean().default(false),
  onlyFirstEmote: z.boolean().default(false),
  keystrokeQueue: z.boolean().default(false),
  tiktokLanguage: z.string().default("en-US"),
});

/** 14 — Debug Options */
export const debugSettingsSchema = z.object({
  debugMode: z.boolean().default(false),
});

/** Tüm setup durumu — mock adapter bunu saklar. */
export const setupSettingsSchema = z.object({
  tiktok: tiktokAccountSchema.partial(),
  points: pointsSystemSchema,
  subscriberBonus: subscriberBonusSchema,
  levels: levelSettingsSchema,
  obs: obsConnectionSchema,
  streamerbot: streamerbotConnectionSchema,
  minecraft: minecraftConnectionSchema,
  advanced: advancedSettingsSchema,
  debug: debugSettingsSchema,
});
export type SetupSettings = z.infer<typeof setupSettingsSchema>;

/** Bağlantı testi sonucu (OBS / Streamer.bot / Minecraft — mock). */
export const testResultSchema = z.object({
  ok: z.boolean(),
  /** i18n anahtarı — ham metin değil. */
  messageKey: z.string(),
  latencyMs: z.number().int().optional(),
});
export type TestResult = z.infer<typeof testResultSchema>;
