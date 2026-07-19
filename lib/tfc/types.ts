import type { Action } from "@/lib/schemas/action";
import type { StreamEvent, StreamTimer } from "@/lib/schemas/event";
import type { SetupSettings } from "@/lib/schemas/settings";
import type { OverlayScreen, WidgetId, WidgetSettings } from "@/lib/schemas/widget";

/**
 * İçe aktarma raporu tipleri — ADR-0007.
 *
 * İçe aktarma "ya hep ya hiç" DEĞİLDİR: TikFinity'de bizde karşılığı olmayan
 * bir eylem tipi veya bozuk bir referans, dosyanın tamamını çöpe atmamalı.
 * Bu yüzden her sapma `warnings` (düzeltilerek alındı) veya `skipped`
 * (alınamadı) listesine kaydedilir ve kullanıcıya önizlemede gösterilir.
 */

/** Raporun hangi bölüme ait olduğu — UI'da gruplama için. */
export type ImportScope =
  | "file"
  | "settings"
  | "action"
  | "event"
  | "timer"
  | "screen"
  | "widget";

export interface ImportIssue {
  /**
   * i18n anahtar EKİ: `setup.importExport.issue.<code>`.
   * Ham metin taşınmaz (CLAUDE.md §5.2 — hardcoded string yasak).
   */
  code:
    | "unknownActionType"        // eylem tipi bizde yok → o tip düşürüldü
    | "noActionTypes"            // hiçbir tip tanınmadı → eylem atlandı
    | "missingName"              // adsız kayıt → atlandı
    | "duplicateName"            // aynı ad ikinci kez → yeniden adlandırıldı
    | "unknownTrigger"           // tetikleyici eşleşmedi → etkinlik atlandı
    | "missingCondition"         // tetikleyicinin zorunlu koşulu yok → atlandı
    | "unresolvedActionRef"      // etkinliğin işaret ettiği eylem yok
    | "noLinkedActions"          // etkinliğe bağlı eylem kalmadı → atlandı
    | "duplicateEvent"           // aynı tetikleyici imzası → atlandı
    | "screenOutOfRange"         // ekran 1-8 dışı → 1'e çekildi
    | "valueClamped"             // sayı şema aralığına kırpıldı
    | "unknownWidget"            // widget id'si bizde yok → atlandı
    | "unknownSection"           // dosyada tanınmayan üst düzey bölüm
    | "invalidRecord";           // şema doğrulaması geçmedi → atlandı

  scope: ImportScope;
  /** Kullanıcıya gösterilecek kaynak öğe adı (eylem adı, komut, widget id…). */
  ref?: string;
  /** i18n değişkeni olarak geçen ek bağlam (ör. tanınmayan tip adı). */
  detail?: string;
}

/**
 * İçe aktarma planı — `dryRun` önizlemesinde de, gerçek yazımda da aynı nesne.
 * Saf veri: hiçbir yan etki taşımaz, Vitest'te doğrudan doğrulanır.
 */
export interface ImportPlan {
  /**
   * İçe aktarmanın adı — geçmiş listesinde ve "geri al" düğmesinde görünür.
   * (Ayrı bir "profil" kavramı DEĞİL: `stream_profiles` bu projede oyun
   * profilidir; içe aktarılan veri kullanıcının tek kütüphanesine `import_id`
   * etiketiyle eklenir — bkz. ADR-0007.)
   */
  label: string;
  /** Dosyadan okunabildiyse TikFinity sürümü, yoksa "unknown". */
  sourceVersion: string;
  settings: SetupSettings;
  actions: Action[];
  events: StreamEvent[];
  timers: StreamTimer[];
  screens: OverlayScreen[];
  widgetSettings: Partial<Record<WidgetId, WidgetSettings>>;
  /** Alındı ama bir değer düzeltildi. */
  warnings: ImportIssue[];
  /** Alınamadı — gerekçesiyle. */
  skipped: ImportIssue[];
}

/** Önizleme tablosunun satırları — UI bunu doğrudan render eder. */
export interface ImportCounts {
  actions: number;
  events: number;
  timers: number;
  screens: number;
  widgets: number;
  warnings: number;
  skipped: number;
}

export function countPlan(plan: ImportPlan): ImportCounts {
  return {
    actions: plan.actions.length,
    events: plan.events.length,
    timers: plan.timers.length,
    screens: plan.screens.length,
    widgets: Object.keys(plan.widgetSettings).length,
    warnings: plan.warnings.length,
    skipped: plan.skipped.length,
  };
}

/** Sorunları toplayan basit biriktirici — mapper'lar arasında paylaşılır. */
export class IssueCollector {
  readonly warnings: ImportIssue[] = [];
  readonly skipped: ImportIssue[] = [];

  warn(issue: ImportIssue): void {
    this.warnings.push(issue);
  }

  skip(issue: ImportIssue): void {
    this.skipped.push(issue);
  }
}
