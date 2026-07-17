import { z } from "zod";

/**
 * Eylem tipleri — PRD §5.3 "Eylem tipleri (20 — enum birebir)".
 * Enum adları orijinalle birebir; UI etiketi i18n'den (`actionsandevents.actionType.<enum>`).
 */
export const actionTypeSchema = z.enum([
  "showText",
  "showImage",
  "showAnimation",
  "playAudio",
  "playVideoFile",
  "playVideo", // deprecated — UI'da gizli
  "speakText",
  "sendText",
  "switchObsScene",
  "activateObsSource",
  "triggerWebhook",
  "triggerMcCmd",
  "simulateKeystroke",
  "execThirdPartyAction",
  "controlCustomGoal",
  "setVoicemodVoice",
  "setStreamerbotAction",
  "controlTimer",
  "addPoints",
  "removePoints",
  "setSnapCamEffect", // devre dışı — UI'da gizli
]);
export type ActionType = z.infer<typeof actionTypeSchema>;

/** PRD §5.3: `playVideo` deprecated, `setSnapCamEffect` devre dışı → seçicide gösterilmez. */
export const HIDDEN_ACTION_TYPES: readonly ActionType[] = [
  "playVideo",
  "setSnapCamEffect",
];

export const SELECTABLE_ACTION_TYPES: readonly ActionType[] =
  actionTypeSchema.options.filter((t) => !HIDDEN_ACTION_TYPES.includes(t));

/** Eylem tablosunda hangi tipin hangi medya kolonunu doldurduğu (PRD §5.3 tablo). */
export const ACTION_MEDIA_COLUMN: Partial<
  Record<ActionType, "animation" | "picture" | "sound" | "video">
> = {
  showAnimation: "animation",
  showImage: "picture",
  playAudio: "sound",
  playVideoFile: "video",
};

/* -------------------------------------------------------------------------- */
/* Tip başına yapılandırma                                                     */
/* -------------------------------------------------------------------------- */

export const obsSceneBehaviorSchema = z.enum(["revertAfterDuration", "keep"]);

export const actionConfigSchema = z.object({
  /** showText */
  text: z.string().max(500).optional(),
  textColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  /** showImage / showAnimation / playAudio / playVideoFile */
  mediaUrl: z.string().optional(),
  mediaName: z.string().optional(),
  animationId: z.string().optional(),
  /** speakText (TTS) */
  ttsText: z.string().max(500).optional(),
  ttsVoice: z.string().optional(),
  ttsRate: z.number().min(0.1).max(3).optional(),
  ttsPitch: z.number().min(0).max(2).optional(),
  ttsRandomVoice: z.boolean().optional(),
  /** sendText (chatbot) */
  chatMessage: z.string().max(500).optional(),
  /** switchObsScene / activateObsSource */
  obsScene: z.string().optional(),
  obsSource: z.string().optional(),
  obsSceneBehavior: obsSceneBehaviorSchema.optional(),
  /** triggerWebhook */
  webhookUrl: z.url().optional(),
  /** triggerMcCmd */
  mcCommand: z.string().optional(),
  mcTemplateId: z.string().optional(),
  /** simulateKeystroke */
  keystrokes: z.array(z.string()).optional(),
  /** execThirdPartyAction */
  thirdPartyCategoryId: z.string().optional(),
  thirdPartyActionId: z.string().optional(),
  /** controlCustomGoal */
  goalId: z.string().optional(),
  goalOp: z.enum(["add", "set", "reset"]).optional(),
  goalValue: z.number().int().optional(),
  /** setVoicemodVoice */
  voicemodVoice: z.string().optional(),
  voicemodDuration: z.number().int().min(0).optional(),
  /** setStreamerbotAction */
  streamerbotActionId: z.string().optional(),
  /** controlTimer */
  timerSeconds: z.number().int().optional(),
  /** addPoints / removePoints */
  points: z.number().int().min(0).optional(),
});
export type ActionConfig = z.infer<typeof actionConfigSchema>;

/* -------------------------------------------------------------------------- */
/* Eylem                                                                       */
/* -------------------------------------------------------------------------- */

/** Overlay ekranları 1-8 (PRD §5.3 / §9 tanımlar). */
export const SCREEN_MIN = 1;
export const SCREEN_MAX = 8;
export const screenSchema = z.number().int().min(SCREEN_MIN).max(SCREEN_MAX);

export const actionSchema = z.object({
  id: z.string(),
  /** "What is the name of the action?" — tekrar hatası editörde kontrol edilir. */
  name: z.string().min(1).max(120),
  enabled: z.boolean().default(true),
  /** Bir eylem birden çok tip içerebilir (PRD §5.3 "Ne olsun?" çoklu seçim). */
  types: z.array(actionTypeSchema).min(1),
  config: actionConfigSchema.default({}),
  /** Görüntüleme süresi (saniye). */
  durationSec: z.number().min(0).max(600).default(5),
  /** Ödül/bedel: pozitif = ekle, negatif = düş (tamsayı — PRD §7 float yasak). */
  pointsDelta: z.number().int().default(0),
  screen: screenSchema.default(1),
  /** Medya ses seviyesi 0-100. */
  volume: z.number().int().min(0).max(100).default(50),
  globalCooldownSec: z.number().int().min(0).default(0),
  userCooldownSec: z.number().int().min(0).default(0),
  fadeInMs: z.number().int().min(0).default(200),
  fadeOutMs: z.number().int().min(0).default(200),
  /** "Repeat with gift combos" — repeatcount kadar tekrar. */
  repeatWithCombos: z.boolean().default(false),
  /** "Skip on next action" — sıradaki eylem gelince kuyruktan atla. */
  skipOnNextAction: z.boolean().default(false),
  description: z.string().max(300).default(""),
});
export type Action = z.infer<typeof actionSchema>;

/** Editör formu — id sunucuda üretilir. */
export const actionDraftSchema = actionSchema.omit({ id: true });
export type ActionDraft = z.infer<typeof actionDraftSchema>;
