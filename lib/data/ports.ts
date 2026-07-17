import type { Action, ActionDraft } from "@/lib/schemas/action";
import type { StreamEvent, StreamTimer } from "@/lib/schemas/event";
import type { ConnectionState, LiveEvent } from "@/lib/schemas/live";
import type { Transaction, Viewer } from "@/lib/schemas/points";
import type { SetupSettings, TestResult } from "@/lib/schemas/settings";
import type {
  OverlayScreen,
  WidgetId,
  WidgetSettings,
} from "@/lib/schemas/widget";

/**
 * VERİ ERİŞİM PORTLARI — PRD §12.
 *
 * TEK erişim noktası. UI asla doğrudan mock/Supabase'e dokunmaz; hep bu interface'ler.
 * Faz 0-1: `lib/data/mock/` implementasyonu.
 * Faz 2:   `lib/data/supabase/` aynı imzalarla; `DATA_BACKEND=supabase` ile geçilir.
 *
 * DİKKAT: Bu imzalar değişecekse önce ADR yazılır (CLAUDE.md §7).
 */

export interface ActionsRepo {
  list(): Promise<Action[]>;
  get(id: string): Promise<Action | null>;
  create(draft: ActionDraft): Promise<Action>;
  update(id: string, draft: ActionDraft): Promise<Action>;
  remove(id: string): Promise<void>;
  /** Tekrar eden ad kontrolü — editörde "isim zaten var" hatası için. */
  nameExists(name: string, exceptId?: string): Promise<boolean>;
}

export interface EventsRepo {
  list(): Promise<StreamEvent[]>;
  create(draft: Omit<StreamEvent, "id">): Promise<StreamEvent>;
  update(id: string, draft: Omit<StreamEvent, "id">): Promise<StreamEvent>;
  remove(id: string): Promise<void>;
  /** Aynı tetikleyici ayarlarıyla etkinlik var mı (PRD §5.3 tekrar hatası). */
  signatureExists(signature: string, exceptId?: string): Promise<boolean>;
}

export interface TimersRepo {
  list(): Promise<StreamTimer[]>;
  create(draft: Omit<StreamTimer, "id">): Promise<StreamTimer>;
  update(id: string, draft: Omit<StreamTimer, "id">): Promise<StreamTimer>;
  remove(id: string): Promise<void>;
}

export interface ScreensRepo {
  list(): Promise<OverlayScreen[]>;
  update(screen: number, patch: Partial<OverlayScreen>): Promise<OverlayScreen>;
}

export interface SettingsRepo {
  get(): Promise<SetupSettings>;
  patch(patch: Partial<SetupSettings>): Promise<SetupSettings>;
  /** OBS / Streamer.bot / Minecraft "Test Bağlantısı" — Faz 1'de mock. */
  test(target: "obs" | "streamerbot" | "minecraft"): Promise<TestResult>;
  export(): Promise<string>;
  import(json: string): Promise<SetupSettings>;
  reset(): Promise<SetupSettings>;
}

export interface WidgetRepo {
  getSettings(widgetId: WidgetId): Promise<WidgetSettings>;
  saveSettings(
    widgetId: WidgetId,
    settings: WidgetSettings,
  ): Promise<WidgetSettings>;
  /** Widget URL'i üretir: `/widget/<id>?cid=<channelId>&...` */
  url(widgetId: WidgetId, params?: Record<string, string | number>): string;
}

export interface PointsRepo {
  listViewers(query?: {
    search?: string;
    limit?: number;
  }): Promise<{ rows: Viewer[]; total: number }>;
  listTransactions(query?: {
    limit?: number;
  }): Promise<{ rows: Transaction[]; total: number }>;
  /** Append-only ledger kaydı; `sourceEventId` ile idempotent. */
  addTransaction(tx: Omit<Transaction, "id" | "ts">): Promise<Transaction>;
  removeTransaction(id: string): Promise<void>;
}

/** TikTok bağlantısı — Faz 1'de durum makinesi simülasyonu (PRD §12.4). */
export interface ConnectionService {
  getState(): ConnectionState;
  connect(username: string): Promise<void>;
  disconnect(): Promise<void>;
  subscribe(listener: (state: ConnectionState) => void): () => void;
}

/** Olay veri yolu — connector/simülatör → kural motoru → widget'lar (PRD §6.1). */
export interface RealtimeBus {
  publish(event: LiveEvent): void;
  subscribe(listener: (event: LiveEvent) => void): () => void;
}

/** Event Simulator butonları (PRD §5.3) — mock olay üretir. */
export interface EventSimulator {
  simulate(
    kind:
      | "follow"
      | "share"
      | "subscribe"
      | "likes"
      | "gift"
      | "chat"
      | "join",
    options?: { coins?: number; likes?: number; comment?: string },
  ): LiveEvent;
}

/** Pro/limit durumu — gating UI'ı (PRD §10). */
export interface EntitlementsService {
  isPro(): boolean;
  limit(
    feature:
      | "actions"
      | "sounds"
      | "ttsDaily"
      | "giftCounter"
      | "streamProfiles"
      | "socialRotator"
      | "pointsUsers",
  ): number;
}

/** Tüm portların tek toplayıcısı — bileşenler bunu alır. */
export interface DataBackend {
  actions: ActionsRepo;
  events: EventsRepo;
  timers: TimersRepo;
  screens: ScreensRepo;
  settings: SettingsRepo;
  widgets: WidgetRepo;
  points: PointsRepo;
  connection: ConnectionService;
  bus: RealtimeBus;
  simulator: EventSimulator;
  entitlements: EntitlementsService;
}
