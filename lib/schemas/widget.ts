import { z } from "zod";
import { screenSchema } from "./action";

/**
 * Widget envanteri — PRD §5.4. `id` = URL endpoint'i (`/widget/<id>?cid=<channelId>`).
 * Faz 1'de yalnız `myactions` render edilir; diğerleri galeride "yakında" durumunda.
 */
export const widgetIdSchema = z.enum([
  "myactions",
  "gifts",
  "chat",
  "activity-feed",
  "viewercount",
  "followercounter",
  "topgifter",
  "topliker",
  "ranking",
  "transactionviewer",
  "userinfo",
  "carousel",
  "goal",
  "countdowngoals",
  "gcounter",
  "lastx",
  "timer",
  "wheel",
  "wheelofactions",
  "cannon",
  "firework",
  "likes",
  "christmasevent",
  "songrequests",
  "coindrop",
  "quiz",
]);
export type WidgetId = z.infer<typeof widgetIdSchema>;

/** Galeri grupları — PRD §5.4 sıralaması. */
export const widgetCategorySchema = z.enum([
  "actions",
  "feeds",
  "counters",
  "goals",
  "games",
  "graphics",
]);
export type WidgetCategory = z.infer<typeof widgetCategorySchema>;

export const widgetMetaSchema = z.object({
  id: widgetIdSchema,
  category: widgetCategorySchema,
  /** PRO kilidi — PRD §5.4 / §10 gating. */
  pro: z.boolean().default(false),
  /** Faz 1'de render edilebilir mi (aksi "yakında"). */
  implemented: z.boolean().default(false),
  /** URL'e eklenen ek parametreler (screen, x, c, metric…). */
  params: z.array(z.enum(["screen", "x", "c", "metric"])).default([]),
});
export type WidgetMeta = z.infer<typeof widgetMetaSchema>;

/** Overlay ekranı — PRD §5.3 "Overlay Screens (8 adet)". */
export const overlayScreenSchema = z.object({
  screen: screenSchema,
  name: z.string().min(1).max(60),
  maxQueueLength: z.number().int().min(1).max(100).default(10),
  /** Heartbeat ile belirlenir (PRD §6.2). */
  online: z.boolean().default(false),
});
export type OverlayScreen = z.infer<typeof overlayScreenSchema>;

/**
 * Widget ayarları — PRD §5.4 "ortak özelleştirme ayarları".
 * Canlı olarak sokete push edilir (`widgetSettings` eventi).
 */
export const widgetSettingsSchema = z.object({
  fontFamily: z.string().default("Inter"),
  fontSize: z.number().int().min(8).max(200).default(28),
  lineHeight: z.number().min(0.5).max(3).default(1.2),
  letterSpacing: z.number().min(-5).max(20).default(0),
  rtl: z.boolean().default(false),
  textColor: z.string().default("#FFFFFF"),
  backgroundColor: z.string().default("transparent"),
  hue: z.number().int().min(0).max(360).default(0),
  saturation: z.number().int().min(0).max(200).default(100),
  grayscale: z.number().int().min(0).max(100).default(0),
  soundEnabled: z.boolean().default(true),
  volume: z.number().int().min(0).max(100).default(50),
  displayDurationSec: z.number().min(0).max(600).default(5),
});
export type WidgetSettings = z.infer<typeof widgetSettingsSchema>;

/** PRD §4.2 — overlay özelleştirme için 35 Google Font kataloğu. */
export const OVERLAY_FONTS = [
  "Inter",
  "Open Sans",
  "Source Sans Pro",
  "Roboto",
  "Noto Sans",
  "Lato",
  "Macondo",
  "Exo 2",
  "Koulen",
  "Pacifico",
  "Kalam",
  "Permanent Marker",
  "Gloria Hallelujah",
  "Sacramento",
  "Codystar",
  "Geo",
  "Lacquer",
  "Sriracha",
  "Monoton",
  "Major Mono Display",
  "Chewy",
  "Shrikhand",
  "Syncopate",
  "Luckiest Guy",
  "Bangers",
  "Cinzel Decorative",
  "DM Serif Display",
  "Shadows Into Light",
  "Indie Flower",
  "Mountains of Christmas",
  "Fontdiner Swanky",
  "Akronim",
  "Caesar Dressing",
  "Eater",
  "Faster One",
  "Press Start 2P",
] as const;

/* -------------------------------------------------------------------------- */
/* Widget kanal protokolü — PRD §6.3                                           */
/* -------------------------------------------------------------------------- */

/** Sunucu → widget mesajları. */
export const widgetInboundSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("action"),
    payload: z.object({
      actionId: z.string(),
      queueId: z.string(),
      durationSec: z.number(),
      types: z.array(z.string()),
      text: z.string().optional(),
      textColor: z.string().optional(),
      mediaUrl: z.string().optional(),
      volume: z.number().optional(),
      fadeInMs: z.number().optional(),
      fadeOutMs: z.number().optional(),
    }),
  }),
  z.object({ kind: z.literal("widgetSettings"), payload: widgetSettingsSchema }),
  z.object({ kind: z.literal("stateSync"), payload: z.unknown() }),
  z.object({ kind: z.literal("heartbeat"), ts: z.number() }),
]);
export type WidgetInbound = z.infer<typeof widgetInboundSchema>;

/** Widget → sunucu mesajları. */
export const widgetOutboundSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("status"),
    screen: screenSchema,
    online: z.boolean(),
    queueLength: z.number().int(),
  }),
  z.object({ kind: z.literal("actionDone"), queueId: z.string() }),
]);
export type WidgetOutbound = z.infer<typeof widgetOutboundSchema>;
