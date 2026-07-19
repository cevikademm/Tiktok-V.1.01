import {
  overlayScreenSchema,
  widgetIdSchema,
  widgetSettingsSchema,
  type OverlayScreen,
  type WidgetId,
  type WidgetSettings,
} from "@/lib/schemas/widget";
import { setupSettingsSchema, type SetupSettings } from "@/lib/schemas/settings";
import {
  bool,
  clamp,
  int,
  normalizeKey,
  num,
  rec,
  str,
  type RawRecord,
} from "./read";
import { IssueCollector } from "./types";

/**
 * KURULUM AYARLARI / EKRANLAR / WIDGET HARİTALAMA — ADR-0007.
 *
 * TikFinity ayarları düz bir sözlükte tutuyor (`pointsPerCoin`, `obsIp`…);
 * bizim şemamız bölümlere ayrılmış (`points`, `obs`…). Bu dosya düz → bölümlü
 * dönüşümü yapar. Ayarlar hem kökte hem `settings`/`config` altında olabilir.
 */

/**
 * Düz ayar alanlarının bulunabileceği kaynakları tek nesnede birleştirir.
 *
 * DİKKAT: Bölüm nesneleri (`obs`, `minecraft`…) BURAYA KATILMAZ. Üçünde de
 * `ip`/`port`/`password` alanları var; hepsini tek torbaya boşaltmak son
 * bölümün diğerlerini ezmesine yol açıyordu. Bölümler `sectionOf()` ile
 * kendi bağlamlarında okunur.
 */
function flattenSettings(payload: RawRecord): RawRecord {
  const nested = [
    rec(payload, "settings"),
    rec(payload, "config"),
    rec(payload, "preferences"),
    rec(payload, "general"),
  ].filter((r): r is RawRecord => r !== undefined);

  return Object.assign({}, payload, ...nested);
}

/**
 * Bir bölümün okuma kaynağı: düz alanların üstüne o bölüme ait iç içe nesne
 * bindirilir. Böylece hem `obsIp` (düz) hem `obs: { ip }` (iç içe) çalışır ve
 * bölümler birbirinin alanını ezmez.
 */
function sectionOf(flat: RawRecord, ...names: string[]): RawRecord {
  for (const name of names) {
    const nested = rec(flat, name);
    if (nested) return { ...flat, ...nested };
  }
  return flat;
}

export function mapSettings(
  payload: RawRecord,
  issues: IssueCollector,
): SetupSettings {
  const flat = flattenSettings(payload);
  const clamped = (field: string) => () =>
    issues.warn({ code: "valueClamped", scope: "settings", ref: field });

  const points = sectionOf(flat, "points", "pointsSystem");
  const levels = sectionOf(flat, "levels", "levelSettings");
  const bonus = sectionOf(flat, "subscriberBonus");
  const obs = sectionOf(flat, "obs", "obsConnection");
  const streamerbot = sectionOf(flat, "streamerbot", "streamerbotConnection");
  const minecraft = sectionOf(flat, "minecraft", "minecraftConnection");
  const advanced = sectionOf(flat, "advanced", "advancedSettings");
  const debug = sectionOf(flat, "debug", "debugSettings");
  const tiktok = sectionOf(flat, "tiktok", "tiktokAccount");

  const username = str(
    tiktok,
    "username",
    "tiktokUsername",
    "uniqueId",
    "channel",
  )
    ?.replace(/^@/, "")
    .trim();

  const candidate = {
    tiktok: username ? { username } : {},

    points: {
      currencyName:
        str(points, "currencyName", "pointsName", "currency", "pointName") ?? "Puan",
      pointsPerCoin: Math.max(
        0,
        int(points, "pointsPerCoin", "coinPoints", "pointsCoin") ?? 1,
      ),
      pointsPerShare: Math.max(0, int(points, "pointsPerShare", "sharePoints") ?? 5),
      pointsPerChatMinute: Math.max(
        0,
        int(points, "pointsPerChatMinute", "chatPoints", "pointsPerMinute") ?? 1,
      ),
    },

    subscriberBonus: {
      bonusRatePercent: clamp(
        int(bonus, "bonusRatePercent", "subscriberBonus", "subBonus", "bonusPercent"),
        0,
        1000,
        100,
        clamped("bonusRatePercent"),
      ),
    },

    levels: {
      pointsPerLevel: Math.max(1, int(levels, "pointsPerLevel", "levelPoints") ?? 50),
      levelMultiplier: clamp(
        num(levels, "levelMultiplier", "levelFactor", "multiplier"),
        1,
        5,
        1.2,
        clamped("levelMultiplier"),
      ),
    },

    obs: {
      ip: str(obs, "obsIp", "obsHost", "obsAddress", "ip") ?? "127.0.0.1",
      port: clamp(int(obs, "obsPort", "port"), 1, 65535, 4455, clamped("obsPort")),
      password: str(obs, "obsPassword", "obsPass", "password") ?? "",
    },

    streamerbot: {
      address:
        str(
          streamerbot,
          "streamerbotAddress",
          "streamerbotIp",
          "streamerbotHost",
          "address",
        ) ?? "127.0.0.1",
      port: clamp(
        int(streamerbot, "streamerbotPort", "port"),
        1,
        65535,
        8080,
        clamped("streamerbotPort"),
      ),
      endpoint:
        str(streamerbot, "streamerbotEndpoint", "streamerbotPath", "endpoint") ?? "/",
    },

    minecraft: {
      mode:
        normalizeKey(str(minecraft, "minecraftMode", "mcMode", "mode") ?? "") ===
        "servertap"
          ? ("servertap" as const)
          : ("fabric" as const),
      playerName:
        str(minecraft, "minecraftPlayer", "mcPlayerName", "playerName") ?? "",
      ip: str(minecraft, "minecraftIp", "mcIp", "mcHost", "ip") ?? "127.0.0.1",
      port: clamp(
        int(minecraft, "minecraftPort", "mcPort", "port"),
        1,
        65535,
        4567,
        clamped("minecraftPort"),
      ),
      password: str(minecraft, "minecraftPassword", "mcPassword", "password") ?? "",
    },

    advanced: {
      serverSideConnection:
        bool(advanced, "serverSideConnection", "serverSide") ?? false,
      openInNewWindow: bool(advanced, "openInNewWindow", "newWindow") ?? false,
      localizedGiftNames:
        bool(advanced, "localizedGiftNames", "localizeGifts") ?? false,
      useDisplayNames: bool(advanced, "useDisplayNames", "displayNames") ?? false,
      onlyFirstEmote: bool(advanced, "onlyFirstEmote", "firstEmoteOnly") ?? false,
      keystrokeQueue: bool(advanced, "keystrokeQueue", "queueKeystrokes") ?? false,
      tiktokLanguage: str(advanced, "tiktokLanguage", "language", "locale") ?? "en-US",
    },

    debug: {
      debugMode: bool(debug, "debugMode", "debug") ?? false,
    },
  };

  const parsed = setupSettingsSchema.safeParse(candidate);
  if (parsed.success) return parsed.data;

  // Ayarlar tamamen bozuksa varsayılana düş — dosyanın geri kalanı kurtarılır.
  issues.warn({
    code: "invalidRecord",
    scope: "settings",
    detail: parsed.error.issues[0]?.message,
  });
  return setupSettingsSchema.parse({
    tiktok: {},
    points: {},
    subscriberBonus: {},
    levels: {},
    obs: {},
    streamerbot: {},
    minecraft: {},
    advanced: {},
    debug: {},
  });
}

/* -------------------------------------------------------------------------- */
/* Overlay ekranları                                                           */
/* -------------------------------------------------------------------------- */

/**
 * 8 ekranın tamamı her zaman döner (PRD §5.3): dosyada tanımlı olanlar
 * doldurulur, eksikler varsayılanla tamamlanır. Böylece `screens` dizisi
 * kullanan mevcut kod (`defaultScreens()`) aynı şekli görür.
 */
export function mapScreens(
  rawScreens: unknown[],
  issues: IssueCollector,
): OverlayScreen[] {
  const byNumber = new Map<number, OverlayScreen>();

  for (const raw of rawScreens) {
    if (typeof raw !== "object" || raw === null) continue;
    const source = raw as RawRecord;

    const number = int(source, "screen", "id", "index", "screenId");
    const ref = str(source, "name", "title") ?? String(number ?? "?");

    if (number === undefined || number < 1 || number > 8) {
      issues.warn({
        code: "screenOutOfRange",
        scope: "screen",
        ref,
        detail: String(number ?? ""),
      });
      continue;
    }

    const parsed = overlayScreenSchema.safeParse({
      screen: number,
      name: str(source, "name", "title", "label") || `Screen ${number}`,
      maxQueueLength: clamp(
        int(source, "maxQueueLength", "queueLength", "maxQueue"),
        1,
        100,
        10,
        () => issues.warn({ code: "valueClamped", scope: "screen", ref }),
      ),
      online: false, // Heartbeat'ten türer, dosyadan alınmaz (PRD §6.2).
    });

    if (parsed.success) byNumber.set(number, parsed.data);
    else {
      issues.warn({
        code: "invalidRecord",
        scope: "screen",
        ref,
        detail: parsed.error.issues[0]?.message,
      });
    }
  }

  return Array.from({ length: 8 }, (_, i) => {
    const number = i + 1;
    return (
      byNumber.get(number) ?? {
        screen: number,
        name: `Screen ${number}`,
        maxQueueLength: 10,
        online: false,
      }
    );
  });
}

/* -------------------------------------------------------------------------- */
/* Widget ayarları                                                             */
/* -------------------------------------------------------------------------- */

const CANONICAL_WIDGETS = new Map<string, WidgetId>(
  widgetIdSchema.options.map((w) => [normalizeKey(w), w]),
);

/** TikFinity widget adlarının bizdeki karşılıkları (sapma olanlar). */
const WIDGET_SYNONYMS: Record<string, WidgetId> = {
  actions: "myactions",
  alerts: "myactions",
  overlay: "myactions",
  activityfeed: "activity-feed",
  feed: "activity-feed",
  viewers: "viewercount",
  followers: "followercounter",
  followercount: "followercounter",
  giftcounter: "gcounter",
  top: "topgifter",
  leaderboard: "ranking",
  wheeloffortune: "wheel",
  goals: "goal",
  customgoal: "goal",
  countdown: "countdowngoals",
  songrequest: "songrequests",
  music: "songrequests",
};

export function resolveWidgetId(raw: string): WidgetId | undefined {
  const key = normalizeKey(raw);
  return CANONICAL_WIDGETS.get(key) ?? WIDGET_SYNONYMS[key];
}

export function mapWidgetSettings(
  rawWidgets: unknown,
  issues: IssueCollector,
): Partial<Record<WidgetId, WidgetSettings>> {
  const result: Partial<Record<WidgetId, WidgetSettings>> = {};
  if (typeof rawWidgets !== "object" || rawWidgets === null) return result;

  // İki gösterim: `{ goal: {...} }` sözlüğü veya `[{ id: "goal", ... }]` dizisi.
  const entries: Array<[string, unknown]> = Array.isArray(rawWidgets)
    ? rawWidgets
        .filter((w): w is RawRecord => typeof w === "object" && w !== null)
        .map((w) => [str(w, "id", "widgetId", "type", "name") ?? "", w])
    : Object.entries(rawWidgets as RawRecord);

  for (const [rawId, rawValue] of entries) {
    if (!rawId) continue;
    const widgetId = resolveWidgetId(rawId);
    if (!widgetId) {
      issues.warn({ code: "unknownWidget", scope: "widget", ref: rawId });
      continue;
    }

    const w = { ...(rec(rawValue, "settings", "config", "style") ?? {}), ...(typeof rawValue === "object" && rawValue !== null ? (rawValue as RawRecord) : {}) };
    const clamped = () =>
      issues.warn({ code: "valueClamped", scope: "widget", ref: widgetId });

    const parsed = widgetSettingsSchema.safeParse({
      fontFamily: str(w, "fontFamily", "font", "fontName") ?? "Inter",
      fontSize: clamp(int(w, "fontSize", "size"), 8, 200, 28, clamped),
      lineHeight: clamp(num(w, "lineHeight"), 0.5, 3, 1.2, clamped),
      letterSpacing: clamp(num(w, "letterSpacing"), -5, 20, 0, clamped),
      rtl: bool(w, "rtl", "rightToLeft") ?? false,
      textColor: str(w, "textColor", "color", "fontColor") ?? "#FFFFFF",
      backgroundColor: str(w, "backgroundColor", "bgColor", "background") ?? "transparent",
      hue: clamp(int(w, "hue"), 0, 360, 0, clamped),
      saturation: clamp(int(w, "saturation"), 0, 200, 100, clamped),
      grayscale: clamp(int(w, "grayscale"), 0, 100, 0, clamped),
      soundEnabled: bool(w, "soundEnabled", "sound", "muted") ?? true,
      volume: clamp(int(w, "volume"), 0, 100, 50, clamped),
      displayDurationSec: clamp(
        num(w, "displayDurationSec", "displayDuration", "duration"),
        0,
        600,
        5,
        clamped,
      ),
    });

    if (parsed.success) result[widgetId] = parsed.data;
    else {
      issues.warn({
        code: "invalidRecord",
        scope: "widget",
        ref: widgetId,
        detail: parsed.error.issues[0]?.message,
      });
    }
  }

  return result;
}
