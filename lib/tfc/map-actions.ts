import {
  actionConfigSchema,
  actionSchema,
  actionTypeSchema,
  type Action,
  type ActionConfig,
  type ActionType,
} from "@/lib/schemas/action";
import { newId } from "@/lib/data/mock/store";
import {
  bool,
  clamp,
  indexOf,
  int,
  normalizeKey,
  num,
  rec,
  str,
  strList,
  toMillis,
  toSeconds,
  type RawRecord,
} from "./read";
import { IssueCollector } from "./types";

/**
 * EYLEM HARİTALAMA — ADR-0007.
 *
 * `lib/schemas/action.ts` enum'ları PRD'den TikFinity adlarıyla BİREBİR
 * türetildiği için eşleme büyük ölçüde 1:1'dir; burada yapılan iş sürüm
 * farklarını (alan adı varyantları, tip gösteriminin 4 farklı biçimi)
 * soğurmaktır.
 */

/* -------------------------------------------------------------------------- */
/* Eylem tipi sözlüğü                                                          */
/* -------------------------------------------------------------------------- */

/** Kanonik enum adlarının normalize edilmiş hâli → enum. */
const CANONICAL_TYPES = new Map<string, ActionType>(
  actionTypeSchema.options.map((t) => [normalizeKey(t), t]),
);

/**
 * TikFinity sürümlerinde görülen alternatif adlar. Kanonik ad zaten
 * `CANONICAL_TYPES` üzerinden yakalanır; buraya yalnız SAPMALAR yazılır.
 */
const TYPE_SYNONYMS: Record<string, ActionType> = {
  text: "showText",
  displaytext: "showText",
  message: "showText",
  image: "showImage",
  picture: "showImage",
  showpicture: "showImage",
  animation: "showAnimation",
  gif: "showAnimation",
  sound: "playAudio",
  audio: "playAudio",
  playsound: "playAudio",
  video: "playVideoFile",
  playvideofile: "playVideoFile",
  tts: "speakText",
  texttospeech: "speakText",
  speak: "speakText",
  chat: "sendText",
  chatmessage: "sendText",
  sendchat: "sendText",
  obsscene: "switchObsScene",
  scene: "switchObsScene",
  obssource: "activateObsSource",
  source: "activateObsSource",
  webhook: "triggerWebhook",
  http: "triggerWebhook",
  minecraft: "triggerMcCmd",
  mccmd: "triggerMcCmd",
  minecraftcommand: "triggerMcCmd",
  keystroke: "simulateKeystroke",
  keypress: "simulateKeystroke",
  hotkey: "simulateKeystroke",
  thirdparty: "execThirdPartyAction",
  thirdpartyaction: "execThirdPartyAction",
  goal: "controlCustomGoal",
  customgoal: "controlCustomGoal",
  voicemod: "setVoicemodVoice",
  streamerbot: "setStreamerbotAction",
  streamerbotaction: "setStreamerbotAction",
  timer: "controlTimer",
  points: "addPoints",
  addpoint: "addPoints",
  removepoint: "removePoints",
  snapcam: "setSnapCamEffect",
};

/** Tek bir tip adını enum'a çevirir; tanınmazsa `undefined`. */
export function resolveActionType(raw: unknown): ActionType | undefined {
  if (typeof raw !== "string") return undefined;
  const key = normalizeKey(raw);
  return CANONICAL_TYPES.get(key) ?? TYPE_SYNONYMS[key];
}

/**
 * Eylem tiplerini çıkarır. TikFinity'de dört farklı gösterim görülüyor:
 *   1) `types: ["showText", "playAudio"]`
 *   2) `type: "showText"`  (tekil)
 *   3) üst düzey boolean bayraklar: `{ showText: true, playAudio: true }`
 *   4) `actions: [{ type: "showText" }, …]`  (iç içe)
 * Hepsi denenir, sonuç tekilleştirilir.
 */
function extractTypes(
  source: RawRecord,
  issues: IssueCollector,
  ref: string,
): ActionType[] {
  const found = new Set<ActionType>();
  const unknown = new Set<string>();

  const consume = (raw: unknown) => {
    if (typeof raw !== "string") return;
    const resolved = resolveActionType(raw);
    if (resolved) found.add(resolved);
    else unknown.add(raw);
  };

  // 1 + 2 — dizi veya tekil alan
  for (const raw of strList(source, "types", "actionTypes", "type", "actionType")) {
    consume(raw);
  }

  // 4 — iç içe eylem listesi
  const nested = pickNestedList(source);
  for (const item of nested) {
    consume(str(item, "type", "actionType", "kind"));
  }

  // 3 — boolean bayraklar (yalnız hiçbir şey bulunamadıysa; yanlış pozitifi önler)
  if (found.size === 0) {
    const index = indexOf(source);
    for (const [key, value] of index) {
      if (value !== true) continue;
      const resolved = CANONICAL_TYPES.get(key) ?? TYPE_SYNONYMS[key];
      if (resolved) found.add(resolved);
    }
  }

  for (const name of unknown) {
    issues.warn({ code: "unknownActionType", scope: "action", ref, detail: name });
  }

  return [...found];
}

function pickNestedList(source: RawRecord): RawRecord[] {
  const raw = source.actions ?? source.steps ?? source.effects;
  if (!Array.isArray(raw)) return [];
  return raw.filter((i): i is RawRecord => typeof i === "object" && i !== null);
}

/* -------------------------------------------------------------------------- */
/* Yapılandırma alanları                                                       */
/* -------------------------------------------------------------------------- */

/** `#RGB` / `rgb(…)` / `RRGGBB` → `#RRGGBB`; çevrilemezse `undefined`. */
function normalizeHexColor(raw: unknown): string | undefined {
  const value = typeof raw === "string" ? raw.trim() : undefined;
  if (!value) return undefined;

  const hex = value.startsWith("#") ? value.slice(1) : value;
  if (/^[0-9a-fA-F]{6}$/.test(hex)) return `#${hex.toUpperCase()}`;
  if (/^[0-9a-fA-F]{3}$/.test(hex)) {
    return `#${[...hex].map((c) => c + c).join("").toUpperCase()}`;
  }

  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(value);
  if (rgb) {
    return `#${rgb
      .slice(1, 4)
      .map((n) => Number(n).toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()}`;
  }
  return undefined;
}

/**
 * Yapılandırma alanları hem eylem kökünde hem de `config`/`data`/`settings`
 * alt nesnesinde bulunabiliyor. İkisi birleştirilip tek kaynak gibi okunur
 * (alt nesne önceliklidir — daha spesifiktir).
 */
function configSource(source: RawRecord): RawRecord {
  const nested =
    rec(source, "config", "data", "settings", "options", "params") ?? {};
  return { ...source, ...nested };
}

function buildConfig(source: RawRecord): ActionConfig {
  const c = configSource(source);

  const draft: ActionConfig = {
    text: str(c, "text", "message", "displayText", "caption"),
    textColor: normalizeHexColor(
      c.textColor ?? c.color ?? c.fontColor ?? c.textcolour,
    ),
    mediaUrl: str(c, "mediaUrl", "url", "fileUrl", "src", "file", "path"),
    mediaName: str(c, "mediaName", "fileName", "filename", "name"),
    animationId: str(c, "animationId", "animation", "effect", "effectId"),

    ttsText: str(c, "ttsText", "speakText", "ttsMessage", "voiceText"),
    ttsVoice: str(c, "ttsVoice", "voice", "voiceId", "voiceName"),
    ttsRate: num(c, "ttsRate", "rate", "speed"),
    ttsPitch: num(c, "ttsPitch", "pitch"),
    ttsRandomVoice: bool(c, "ttsRandomVoice", "randomVoice"),

    chatMessage: str(c, "chatMessage", "chatText", "botMessage", "reply"),

    obsScene: str(c, "obsScene", "scene", "sceneName"),
    obsSource: str(c, "obsSource", "source", "sourceName"),
    obsSceneBehavior: bool(c, "revertScene", "revertAfterDuration")
      ? "revertAfterDuration"
      : undefined,

    webhookUrl: str(c, "webhookUrl", "webhook", "requestUrl", "endpoint"),

    mcCommand: str(c, "mcCommand", "minecraftCommand", "command", "cmd"),
    mcTemplateId: str(c, "mcTemplateId", "minecraftTemplate", "templateId"),

    keystrokes: strList(c, "keystrokes", "keys", "keystroke", "hotkey"),

    thirdPartyCategoryId: str(c, "thirdPartyCategoryId", "categoryId"),
    thirdPartyActionId: str(c, "thirdPartyActionId", "externalActionId"),

    goalId: str(c, "goalId", "goal", "customGoalId"),
    goalValue: int(c, "goalValue", "goalAmount"),

    voicemodVoice: str(c, "voicemodVoice", "voicemod"),
    voicemodDuration: int(c, "voicemodDuration"),

    streamerbotActionId: str(c, "streamerbotActionId", "streamerbotAction"),

    timerSeconds: int(c, "timerSeconds", "timerDuration"),
    points: int(c, "points", "pointAmount", "pointsAmount"),
  };

  const goalOp = str(c, "goalOp", "goalOperation", "goalMode")?.toLowerCase();
  if (goalOp === "add" || goalOp === "set" || goalOp === "reset") {
    draft.goalOp = goalOp;
  }

  // `undefined` alanları at — Zod `.optional()` ile temiz kalsın.
  const cleaned = Object.fromEntries(
    Object.entries(draft).filter(([, v]) => {
      if (v === undefined) return false;
      if (Array.isArray(v) && v.length === 0) return false;
      return true;
    }),
  );

  // Şemayı geçmeyen tek tük alan (ör. geçersiz URL) tüm eylemi düşürmemeli.
  const parsed = actionConfigSchema.safeParse(cleaned);
  if (parsed.success) return parsed.data;

  for (const issue of parsed.error.issues) {
    delete (cleaned as RawRecord)[String(issue.path[0])];
  }
  return actionConfigSchema.parse(cleaned);
}

/* -------------------------------------------------------------------------- */
/* Eylem                                                                       */
/* -------------------------------------------------------------------------- */

export interface MappedActions {
  actions: Action[];
  /** TikFinity id → bizim yeni id. Etkinlik referanslarını çevirmek için. */
  idMap: Map<string, string>;
  /** Bizim id → TikFinity id (dışa aktarma ve denetim kaydı için). */
  externalIds: Map<string, string>;
}

export function mapActions(
  rawActions: unknown[],
  issues: IssueCollector,
  /** Kütüphanede zaten bulunan eylem adları — bunlara karşı da tekilleştirilir. */
  existingNames: readonly string[] = [],
): MappedActions {
  const actions: Action[] = [];
  const idMap = new Map<string, string>();
  const externalIds = new Map<string, string>();
  const usedNames = new Set(existingNames.map((n) => n.trim().toLowerCase()));

  for (const raw of rawActions) {
    if (typeof raw !== "object" || raw === null) continue;
    const source = raw as RawRecord;

    const externalId = str(source, "id", "actionId", "uuid", "key");
    const rawName = str(source, "name", "title", "label", "actionName")?.trim();
    const ref = rawName || externalId || "?";

    if (!rawName) {
      issues.skip({ code: "missingName", scope: "action", ref });
      continue;
    }

    const types = extractTypes(source, issues, ref);
    if (types.length === 0) {
      issues.skip({ code: "noActionTypes", scope: "action", ref });
      continue;
    }

    // Ad tekilliği: hem UI (`nameExists`) hem DB (unique index) bunu şart koşar.
    let name = rawName;
    if (usedNames.has(name.toLowerCase())) {
      let suffix = 2;
      while (usedNames.has(`${rawName} (${suffix})`.toLowerCase())) suffix += 1;
      name = `${rawName} (${suffix})`;
      issues.warn({ code: "duplicateName", scope: "action", ref, detail: name });
    }
    usedNames.add(name.toLowerCase());

    const clamped = () =>
      issues.warn({ code: "valueClamped", scope: "action", ref });

    const screenRaw = int(source, "screen", "overlayScreen", "screenId");
    let screen = screenRaw ?? 1;
    if (screenRaw !== undefined && (screenRaw < 1 || screenRaw > 8)) {
      issues.warn({
        code: "screenOutOfRange",
        scope: "action",
        ref,
        detail: String(screenRaw),
      });
      screen = 1;
    }

    const candidate = {
      id: newId("act"),
      name: name.slice(0, 120),
      enabled: bool(source, "enabled", "active", "isActive", "on") ?? true,
      types,
      config: buildConfig(source),
      durationSec: clamp(
        toSeconds(source, "durationSec", "duration", "displayDuration", "durationMs"),
        0,
        600,
        5,
        clamped,
      ),
      pointsDelta:
        int(source, "pointsDelta", "pointsReward", "pointCost", "points") ?? 0,
      screen,
      volume: clamp(int(source, "volume", "soundVolume"), 0, 100, 50, clamped),
      globalCooldownSec: Math.max(
        0,
        int(source, "globalCooldownSec", "cooldown", "globalCooldown") ?? 0,
      ),
      userCooldownSec: Math.max(
        0,
        int(source, "userCooldownSec", "userCooldown", "perUserCooldown") ?? 0,
      ),
      fadeInMs: Math.max(0, toMillis(source, "fadeInMs", "fadeIn") ?? 200),
      fadeOutMs: Math.max(0, toMillis(source, "fadeOutMs", "fadeOut") ?? 200),
      repeatWithCombos:
        bool(source, "repeatWithCombos", "repeatCombo", "repeatWithGiftCombos") ??
        false,
      skipOnNextAction:
        bool(source, "skipOnNextAction", "skipOnNext", "interruptible") ?? false,
      description: (str(source, "description", "note", "comment") ?? "").slice(0, 300),
    };

    const parsed = actionSchema.safeParse(candidate);
    if (!parsed.success) {
      issues.skip({
        code: "invalidRecord",
        scope: "action",
        ref,
        detail: parsed.error.issues[0]?.message,
      });
      continue;
    }

    actions.push(parsed.data);
    if (externalId) {
      idMap.set(externalId, parsed.data.id);
      externalIds.set(parsed.data.id, externalId);
    }
    // Ada göre de eşleştir: bazı sürümlerde etkinlikler eylemi ADIYLA işaret ediyor.
    idMap.set(`name:${rawName.toLowerCase()}`, parsed.data.id);
  }

  return { actions, idMap, externalIds };
}
