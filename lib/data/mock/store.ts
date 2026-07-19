import type { ErrorReport } from "@/lib/error-report/types";
import type { Action } from "@/lib/schemas/action";
import type { StreamEvent, StreamTimer } from "@/lib/schemas/event";
import type { Transaction, Viewer } from "@/lib/schemas/points";
import { setupSettingsSchema, type SetupSettings } from "@/lib/schemas/settings";
import {
  autoSwitchStateSchema,
  defaultStreamProfiles,
  gameSignalSchema,
  type AutoSwitchState,
  type GameSignal,
  type StreamProfile,
} from "@/lib/schemas/stream-profile";
import type { OverlayScreen, WidgetId, WidgetSettings } from "@/lib/schemas/widget";
import { widgetSettingsSchema } from "@/lib/schemas/widget";

/**
 * Mock kalıcı depo — Faz 0-1 (PRD §12.2).
 * Tarayıcıda localStorage, sunucuda salt-bellek (SSR sırasında boş başlangıç).
 */

const STORAGE_KEY = "livekit.mock.v1";

export interface MockState {
  actions: Action[];
  events: StreamEvent[];
  timers: StreamTimer[];
  screens: OverlayScreen[];
  settings: SetupSettings;
  widgetSettings: Partial<Record<WidgetId, WidgetSettings>>;
  viewers: Viewer[];
  transactions: Transaction[];
  /** Hızlı Erişim toggle'ları — PRD §5.1/§15.3 (localStorage'da kalıcı). */
  quickAccess: { tts: boolean; sounds: boolean; actions: boolean };
  /** Akış profilleri — dinamik liste, ADR-0006. */
  streamProfiles: StreamProfile[];
  activeProfileId: string;
  autoSwitch: AutoSwitchState;
  /** Son bildirilen oyun sinyali (elle seçim / başlık / connector). */
  gameSignal: GameSignal;
  /** Aktif profile geçiş anı (ms epoch) — dwell hesabı için. */
  lastProfileSwitchAt: number;
  channelId: string;
  isPro: boolean;
  /** Admin hata bildirimleri (Hata Bildir modülü — Supabase'siz, localStorage). */
  errorReports: ErrorReport[];
}

function defaultScreens(): OverlayScreen[] {
  return Array.from({ length: 8 }, (_, i) => ({
    screen: i + 1,
    name: `Screen ${i + 1}`,
    maxQueueLength: 10,
    online: false,
  }));
}

export function defaultState(): MockState {
  const profiles = defaultStreamProfiles();
  return {
    actions: [],
    events: [],
    timers: [],
    screens: defaultScreens(),
    settings: setupSettingsSchema.parse({
      tiktok: {},
      points: {},
      subscriberBonus: {},
      levels: {},
      obs: {},
      streamerbot: {},
      minecraft: {},
      advanced: {},
      debug: {},
    }),
    widgetSettings: {},
    viewers: [],
    transactions: [],
    quickAccess: { tts: true, sounds: true, actions: true },
    streamProfiles: profiles,
    activeProfileId: profiles[0].id,
    autoSwitch: autoSwitchStateSchema.parse({}),
    gameSignal: gameSignalSchema.parse({}),
    lastProfileSwitchAt: 0,
    channelId: "demo-channel",
    isPro: false,
    errorReports: [],
  };
}

let memory: MockState | null = null;

/**
 * Sunucu snapshot'ı — SABİT referans olmalı.
 * useSyncExternalStore her render'da yeni nesne görürse sonsuz döngüye girer.
 */
const SERVER_SNAPSHOT: MockState = defaultState();

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function loadState(): MockState {
  if (memory) return memory;

  if (isBrowser()) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<MockState>;
        memory = { ...defaultState(), ...parsed };
        return memory;
      }
    } catch {
      // Bozuk/eski kayıt — varsayılana düş (kullanıcı verisi kaybı yerine sıfırlama).
    }
  }

  memory = defaultState();
  return memory;
}

/** useSyncExternalStore için istemci snapshot'ı. */
export function getSnapshot(): MockState {
  return loadState();
}

/** useSyncExternalStore için sunucu/hidrasyon snapshot'ı (localStorage yok). */
export function getServerSnapshot(): MockState {
  return SERVER_SNAPSHOT;
}

export function saveState(next: MockState): void {
  memory = next;
  if (!isBrowser()) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Kota dolu / gizli mod — bellekte devam et.
  }
  notify();
}

/**
 * Durumu değiştirir. Snapshot KİMLİĞİ değişmeli — aksi halde useSyncExternalStore
 * değişikliği görmez ve UI güncellenmez. Bu yüzden her mutate yeni bir kök nesne üretir.
 */
export function mutate(fn: (state: MockState) => void): MockState {
  const next = { ...loadState() };
  fn(next);
  saveState(next);
  return next;
}

export function resetState(): MockState {
  memory = defaultState();
  if (isBrowser()) localStorage.removeItem(STORAGE_KEY);
  notify();
  return memory;
}

/* -------------------------------------------------------------------------- */
/* Abonelik — UI'ın store değişimini dinlemesi için                            */
/* -------------------------------------------------------------------------- */

const listeners = new Set<() => void>();

export function subscribeStore(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(): void {
  for (const l of listeners) l();
}

/* -------------------------------------------------------------------------- */

export function widgetSettingsFor(id: WidgetId): WidgetSettings {
  const state = loadState();
  return state.widgetSettings[id] ?? widgetSettingsSchema.parse({});
}

/** Mock id üretici — crypto.randomUUID yoksa sayaç. */
let idSeq = 0;
export function newId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
  }
  idSeq += 1;
  return `${prefix}_${idSeq.toString(36)}`;
}
