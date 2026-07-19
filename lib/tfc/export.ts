import type { Action } from "@/lib/schemas/action";
import type { StreamEvent, StreamTimer } from "@/lib/schemas/event";
import { THIRD_PARTY_TRIGGER_ID } from "@/lib/schemas/event";
import type { SetupSettings } from "@/lib/schemas/settings";
import type { OverlayScreen, WidgetId, WidgetSettings } from "@/lib/schemas/widget";
import { APP_NAME } from "@/lib/utils";
import { encodeTfc } from "./container";

/**
 * DIŞA AKTARMA — ADR-0007.
 *
 * İki hedefi aynı anda tutar:
 *   1) GERİ UYUMLULUK — alan adları TikFinity'nin kendi adlandırmasıyla yazılır
 *      (enum'larımız zaten birebir TikFinity adları; ayarlar düz sözlüğe açılır,
 *      etkinliklere sayısal `triggerTypeId` de eklenir). Böylece dosya gerçek
 *      TikFinity'ye geri yüklenebilir.
 *   2) KAYIPSIZLIK — kendi kanonik verimiz `livekit` bloğunda aynen taşınır;
 *      kendi içe aktarıcımız bu bloğu okuduğunda hiçbir alan kaybolmaz.
 *
 * Not: `.tfc` (gzip) ve `.json` (düz) aynı yükü taşır, yalnız kapsayıcı farklıdır.
 */

/** Beyan edilen uyumluluk sürümü — klonun hedef aldığı TikFinity sürümü. */
export const TFC_COMPAT_VERSION = "1.70.1";

/** Kendi bloğumuzun şema sürümü — gelecekte kırıcı değişiklik olursa artar. */
export const LIVEKIT_SCHEMA_VERSION = 1;

export interface ExportInput {
  /** Dosyaya `profileName` olarak yazılır (TikFinity alan adı) ve dosya adında kullanılır. */
  label: string;
  settings: SetupSettings;
  actions: Action[];
  events: StreamEvent[];
  timers: StreamTimer[];
  screens: OverlayScreen[];
  widgetSettings: Partial<Record<WidgetId, WidgetSettings>>;
  /**
   * Bizim id → kaynak TikFinity id. İçe aktarılmış profillerde doldurulur;
   * dosya orijinal id'leriyle geri yazılırsa TikFinity tarafında eşleşir.
   */
  externalIds?: ReadonlyMap<string, string>;
  /** ISO tarih — çağıran verir (saf fonksiyon kalsın, test edilebilir olsun). */
  exportedAt: string;
}

/* -------------------------------------------------------------------------- */

/** Bölümlü ayarlarımızı TikFinity'nin düz sözlüğüne açar. */
function flattenSettings(s: SetupSettings): Record<string, unknown> {
  return {
    username: s.tiktok.username ?? "",

    currencyName: s.points.currencyName,
    pointsPerCoin: s.points.pointsPerCoin,
    pointsPerShare: s.points.pointsPerShare,
    pointsPerChatMinute: s.points.pointsPerChatMinute,

    bonusRatePercent: s.subscriberBonus.bonusRatePercent,

    pointsPerLevel: s.levels.pointsPerLevel,
    levelMultiplier: s.levels.levelMultiplier,

    obsIp: s.obs.ip,
    obsPort: s.obs.port,
    obsPassword: s.obs.password,

    streamerbotAddress: s.streamerbot.address,
    streamerbotPort: s.streamerbot.port,
    streamerbotEndpoint: s.streamerbot.endpoint,

    minecraftMode: s.minecraft.mode,
    minecraftPlayer: s.minecraft.playerName,
    minecraftIp: s.minecraft.ip,
    minecraftPort: s.minecraft.port,
    minecraftPassword: s.minecraft.password,

    serverSideConnection: s.advanced.serverSideConnection,
    openInNewWindow: s.advanced.openInNewWindow,
    localizedGiftNames: s.advanced.localizedGiftNames,
    useDisplayNames: s.advanced.useDisplayNames,
    onlyFirstEmote: s.advanced.onlyFirstEmote,
    keystrokeQueue: s.advanced.keystrokeQueue,
    tiktokLanguage: s.advanced.tiktokLanguage,

    debugMode: s.debug.debugMode,
  };
}

function exportAction(
  action: Action,
  externalIds?: ReadonlyMap<string, string>,
): Record<string, unknown> {
  return {
    // Kaynak id varsa onu yaz — TikFinity tarafında kayıt eşleşsin.
    id: externalIds?.get(action.id) ?? action.id,
    name: action.name,
    enabled: action.enabled,
    types: action.types,
    // Tekil `type` de yazılır: eski TikFinity sürümleri diziyi okumuyor.
    type: action.types[0],
    config: action.config,
    durationSec: action.durationSec,
    duration: action.durationSec,
    pointsDelta: action.pointsDelta,
    screen: action.screen,
    volume: action.volume,
    globalCooldownSec: action.globalCooldownSec,
    userCooldownSec: action.userCooldownSec,
    fadeInMs: action.fadeInMs,
    fadeOutMs: action.fadeOutMs,
    repeatWithCombos: action.repeatWithCombos,
    skipOnNextAction: action.skipOnNextAction,
    description: action.description,
  };
}

function exportEvent(
  event: StreamEvent,
  externalIds?: ReadonlyMap<string, string>,
): Record<string, unknown> {
  const mapRef = (id: string) => externalIds?.get(id) ?? id;

  return {
    id: event.id,
    active: event.active,
    trigger: event.trigger,
    // Sayısal karşılık — TikFinity'nin 3. taraf API kimliği (PRD §9).
    triggerTypeId: THIRD_PARTY_TRIGGER_ID[event.trigger],
    who: event.who,
    conditions: event.conditions,
    actionsAll: event.actionsAll.map(mapRef),
    actionsRandom: event.actionsRandom.map(mapRef),
  };
}

function exportTimer(
  timer: StreamTimer,
  externalIds?: ReadonlyMap<string, string>,
): Record<string, unknown> {
  return {
    id: timer.id,
    active: timer.active,
    intervalMinutes: timer.intervalMinutes,
    interval: timer.intervalMinutes,
    actionId: externalIds?.get(timer.actionId) ?? timer.actionId,
  };
}

function exportScreen(screen: OverlayScreen): Record<string, unknown> {
  // `online` dışa aktarılmaz: anlık durum, ayar değil (PRD §6.2).
  return {
    screen: screen.screen,
    name: screen.name,
    maxQueueLength: screen.maxQueueLength,
  };
}

/* -------------------------------------------------------------------------- */

export interface TfcExportPayload extends Record<string, unknown> {
  version: string;
  generator: string;
  exportedAt: string;
  profileName: string;
  settings: Record<string, unknown>;
  actions: Record<string, unknown>[];
  events: Record<string, unknown>[];
  timers: Record<string, unknown>[];
  screens: Record<string, unknown>[];
  widgets: Partial<Record<WidgetId, WidgetSettings>>;
  livekit: {
    schema: number;
    /** Kanonik veri — kendi içe aktarıcımız için kayıpsız kaynak. */
    settings: SetupSettings;
    actions: Action[];
    events: StreamEvent[];
    timers: StreamTimer[];
    screens: OverlayScreen[];
    widgetSettings: Partial<Record<WidgetId, WidgetSettings>>;
  };
}

/** Saf dönüşüm — yan etkisiz, testte doğrudan doğrulanır. */
export function buildExportPayload(input: ExportInput): TfcExportPayload {
  const ext = input.externalIds;

  return {
    version: TFC_COMPAT_VERSION,
    generator: `${APP_NAME} tfc-export`,
    exportedAt: input.exportedAt,
    profileName: input.label,

    settings: flattenSettings(input.settings),
    actions: input.actions.map((a) => exportAction(a, ext)),
    events: input.events.map((e) => exportEvent(e, ext)),
    timers: input.timers.map((t) => exportTimer(t, ext)),
    screens: input.screens.map(exportScreen),
    widgets: input.widgetSettings,

    livekit: {
      schema: LIVEKIT_SCHEMA_VERSION,
      settings: input.settings,
      actions: input.actions,
      events: input.events,
      timers: input.timers,
      screens: input.screens,
      widgetSettings: input.widgetSettings,
    },
  };
}

/* -------------------------------------------------------------------------- */

export interface ExportedFile {
  bytes: Uint8Array;
  filename: string;
  mimeType: string;
}

/** Dosya adında kullanılamayan karakterleri temizler. */
function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      // Türkçe harfler korunur (`ı` dâhil — `i` ile aynı sınıfta değildir).
      .replace(/[^a-z0-9ğüşıöç]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "profil"
  );
}

/**
 * `.tfc` (gzip) veya `.json` (düz) dosya üretir.
 *
 * `.tfc` gzip'lidir: gerçek TikFinity bundle'ında `pako` kullanıldığı tespit
 * edildi ve çözücümüz her iki biçimi de okuyabiliyor (bkz. `container.ts`).
 */
export async function exportTfcFile(
  input: ExportInput,
  kind: "tfc" | "json" = "tfc",
): Promise<ExportedFile> {
  const payload = buildExportPayload(input);
  const date = input.exportedAt.slice(0, 10);
  const base = `${APP_NAME.toLowerCase()}-${slugify(input.label)}-${date}`;

  if (kind === "json") {
    return {
      bytes: await encodeTfc(payload, "json"),
      filename: `${base}.json`,
      mimeType: "application/json",
    };
  }

  return {
    bytes: await encodeTfc(payload, "gzip"),
    filename: `${base}.tfc`,
    mimeType: "application/octet-stream",
  };
}
