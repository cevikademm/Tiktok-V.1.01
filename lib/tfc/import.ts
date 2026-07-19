import { decodeTfc, type DecodedContainer } from "./container";
import { LIVEKIT_SCHEMA_VERSION } from "./export";
import { mapActions } from "./map-actions";
import { mapEvents, mapTimers } from "./map-events";
import { mapScreens, mapSettings, mapWidgetSettings } from "./map-settings";
import {
  asArray,
  indexOf,
  int,
  normalizeKey,
  pick,
  rec,
  str,
  type RawRecord,
} from "./read";
import { IssueCollector, type ImportPlan } from "./types";

/**
 * İÇE AKTARMA ORKESTRASYONU — ADR-0007.
 *
 * `buildImportPlan()` SAF bir fonksiyondur: ağ/DOM/depolama dokunuşu yok,
 * yalnız çözülmüş JSON alır ve `ImportPlan` üretir. Hem `dryRun` önizlemesi
 * hem de gerçek yazım aynı planı kullanır — kullanıcının onayladığı rapor ile
 * yazılan veri arasında fark oluşamaz.
 */

/** Üst düzey bölüm adı adayları — TikFinity sürümleri arasında değişiyor. */
const SECTION_ALIASES = {
  actions: ["actions", "actionList", "alerts", "commands"],
  events: ["events", "eventList", "triggers", "rules"],
  timers: ["timers", "timerList", "schedules", "intervals"],
  screens: ["screens", "overlayScreens", "screenList"],
  widgets: ["widgets", "widgetSettings", "overlays", "widgetConfig"],
  settings: ["settings", "config", "preferences", "general", "setup"],
  profileName: ["profileName", "profile", "name", "title"],
  version: ["version", "appVersion", "schemaVersion", "tikfinityVersion", "build"],
} as const;

/** Bilinen üst düzey anahtarlar — dışındakiler raporda "tanınmayan" olarak listelenir. */
const KNOWN_KEYS = new Set(
  [
    ...Object.values(SECTION_ALIASES).flat(),
    "exportDate",
    "exportedAt",
    "createdAt",
    "generator",
    "type",
    "id",
    "userId",
    "channelId",
    "username",
    "livekit", // kendi dışa aktarmamızın kanonik bloğu (lib/tfc/export.ts)
  ].map(normalizeKey),
);

function section(payload: RawRecord, key: keyof typeof SECTION_ALIASES): unknown {
  return pick(payload, ...SECTION_ALIASES[key]);
}

export interface BuildPlanOptions {
  /** Kullanıcının verdiği ad — yoksa dosyadan/dosya adından türetilir. */
  label?: string;
  /** Ad türetmede kullanılan dosya adı. */
  fileName?: string;
  /**
   * Kullanıcının kütüphanesinde ZATEN bulunan eylem adları.
   *
   * Verilirse içe aktarılan eylemler bunlara karşı da tekilleştirilir
   * ("Kalp Yağmuru" → "Kalp Yağmuru (2)"). Verilmezse yalnız dosya içi
   * tekrarlar ayıklanır ve mevcut kütüphaneyle ad çakışması oluşabilir.
   */
  existingActionNames?: readonly string[];
}

export function buildImportPlan(
  value: unknown,
  options: BuildPlanOptions = {},
): ImportPlan {
  const issues = new IssueCollector();

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    // Dosya bir nesne değilse haritalanacak bir şey yok; boş plan + hata.
    issues.skip({ code: "invalidRecord", scope: "file" });
    return emptyPlan(options, issues);
  }

  const payload = value as RawRecord;

  // Tanınmayan üst düzey bölümleri kullanıcıya bildir — sessizce yutma.
  for (const key of indexOf(payload).keys()) {
    if (!KNOWN_KEYS.has(key)) {
      issues.warn({ code: "unknownSection", scope: "file", ref: key });
    }
  }

  /**
   * Dosyayı BİZ ürettiysek (`livekit` bloğu) veriyi oradan okuruz: alanlar zaten
   * kanoniktir, hiçbir tahmin gerekmez → kayıpsız gidiş-dönüş. Aksi hâlde
   * TikFinity'nin kendi bölümleri toleranslı olarak okunur.
   */
  const source = pickCanonicalSource(payload);

  const { actions, idMap } = mapActions(
    asArray(section(source, "actions")),
    issues,
    options.existingActionNames,
  );
  const events = mapEvents(asArray(section(source, "events")), idMap, issues);
  const timers = mapTimers(asArray(section(source, "timers")), idMap, issues);
  const screens = mapScreens(asArray(section(source, "screens")), issues);
  const widgetSettings = mapWidgetSettings(section(source, "widgets"), issues);
  const settings = mapSettings(source, issues);

  return {
    label: resolveLabel(payload, options),
    sourceVersion: str(payload, ...SECTION_ALIASES.version) ?? "unknown",
    settings,
    actions,
    events,
    timers,
    screens,
    widgetSettings,
    warnings: issues.warnings,
    skipped: issues.skipped,
  };
}

/**
 * `livekit` bloğu varsa onu, yoksa yükün kendisini döner.
 *
 * Blok kısmi olabilir (ör. yalnız `actions`), bu yüzden ÜZERİNE bindirilir:
 * eksik bölümler TikFinity gösteriminden okunmaya devam eder.
 */
function pickCanonicalSource(payload: RawRecord): RawRecord {
  const block = rec(payload, "livekit");
  if (!block) return payload;

  const schema = int(block, "schema");
  // Gelecekten gelen (bilmediğimiz) bir şema sürümünü kanonik kabul etmeyiz.
  if (schema !== undefined && schema > LIVEKIT_SCHEMA_VERSION) return payload;

  return { ...payload, ...block };
}

function resolveLabel(payload: RawRecord, options: BuildPlanOptions): string {
  const explicit = options.label?.trim();
  if (explicit) return explicit.slice(0, 120);

  const fromFile = str(payload, ...SECTION_ALIASES.profileName)?.trim();
  if (fromFile) return fromFile.slice(0, 120);

  // Dosya adının uzantısız hâli — kullanıcı hangi dosyadan geldiğini görsün.
  const base = options.fileName?.replace(/\.(tfc|json)$/i, "").trim();
  return (base || "TikFinity").slice(0, 120);
}

function emptyPlan(options: BuildPlanOptions, issues: IssueCollector): ImportPlan {
  return {
    label: resolveLabel({}, options),
    sourceVersion: "unknown",
    settings: mapSettings({}, new IssueCollector()),
    actions: [],
    events: [],
    timers: [],
    screens: mapScreens([], new IssueCollector()),
    widgetSettings: {},
    warnings: issues.warnings,
    skipped: issues.skipped,
  };
}

/* -------------------------------------------------------------------------- */

export interface ReadTfcResult {
  container: DecodedContainer;
  plan: ImportPlan;
}

/**
 * Dosya baytlarından plana kadar tek adım — UI ve API route'u bunu çağırır.
 * Çözme hataları `TfcDecodeError` olarak yukarı fırlatılır (çağıran i18n'ler).
 */
export async function readTfc(
  bytes: ArrayBuffer | Uint8Array,
  options: BuildPlanOptions = {},
): Promise<ReadTfcResult> {
  const container = await decodeTfc(bytes);
  return { container, plan: buildImportPlan(container.value, options) };
}
