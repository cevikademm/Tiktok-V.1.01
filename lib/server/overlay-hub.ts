/**
 * Overlay hub — sunucu-otoriteli gerçek zamanlı köprü (ADR-0002).
 *
 * Bellek içi registry: her overlay (`overlayId`) için kullanıcının kuralları +
 * SUNUCUDA çalışan bir `RuleEngine` + SSE aboneleri. TikTok'tan gelen olay
 * (EulerStream) motordan geçer, eşleşen action `widgetInbound` "action" mesajı
 * olarak doğru `screen`'in abonelerine push edilir.
 *
 * `username` başına TEK upstream EulerStream WS (ref-count) — 25-WS limitini korur.
 * Kalıcılık: bellek + `.data/overlays.json` (tek uzun-ömürlü Node süreci varsayımı).
 *
 * YALNIZ Node runtime'da import edilir (node:fs, global WebSocket).
 */

import fs from "node:fs";
import path from "node:path";
import { RuleEngine, type DispatchResult } from "@/lib/engine";
import { buildActionMessage } from "@/lib/overlay/action-message";
import { createTimerRunner, type TimerRunner } from "@/lib/overlay/timer-runner";
import { connectEulerStream, type EulerHandle } from "@/lib/server/eulerstream";
import type { Action } from "@/lib/schemas/action";
import type { StreamEvent, StreamTimer } from "@/lib/schemas/event";
import { systemLiveEvent, type LiveEvent } from "@/lib/schemas/live";
import type { WidgetInbound } from "@/lib/schemas/widget";

/* -------------------------------------------------------------------------- */
/* Tipler                                                                      */
/* -------------------------------------------------------------------------- */

export interface OverlayScreenDef {
  screen: number;
  maxQueueLength: number;
}

export interface OverlayConfig {
  id: string;
  username: string;
  actions: Action[];
  events: StreamEvent[];
  timers: StreamTimer[];
  screens: OverlayScreenDef[];
}

interface Subscriber {
  subId: string;
  screen: number;
  send: (msg: WidgetInbound) => void;
}

interface OverlayEntry {
  id: string;
  username: string;
  actions: Action[];
  events: StreamEvent[];
  timers: StreamTimer[];
  screens: OverlayScreenDef[];
  engine: RuleEngine;
  /** Aralıklı eylem çalıştırıcısı — abone (canlılık) varken çalışır (ADR-0005). */
  timerRunner: TimerRunner;
  subscribers: Map<string, Subscriber>;
}

interface Upstream {
  username: string;
  handle: EulerHandle;
  refCount: number;
}

/** Test için upstream fabrikası enjekte edilebilir (gerçek WS açılmasın). */
type UpstreamFactory = (
  username: string,
  onEvent: (ev: LiveEvent) => void,
) => EulerHandle;

interface HubState {
  overlays: Map<string, OverlayEntry>;
  upstreams: Map<string, Upstream>;
  heartbeatTimer: ReturnType<typeof setInterval> | null;
  upstreamFactory: UpstreamFactory;
  loaded: boolean;
  subSeq: number;
}

/* -------------------------------------------------------------------------- */
/* Sabitler                                                                    */
/* -------------------------------------------------------------------------- */

const HEARTBEAT_MS = 5_000;
/** Action süresi bittikten sonra kuyruktan düşürme payı. */
const AUTO_DEQUEUE_GRACE_MS = 500;
/** Vitest'te diske yazma ve gerçek zamanlayıcıdan kaçın. */
const IS_TEST = Boolean(process.env.VITEST);
const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "overlays.json");

/* -------------------------------------------------------------------------- */
/* Singleton — globalThis (HMR/route modül grafiği çift-registry'yi önler)      */
/* -------------------------------------------------------------------------- */

function defaultFactory(
  username: string,
  onEvent: (ev: LiveEvent) => void,
): EulerHandle {
  return connectEulerStream(username, {
    onEvent: (_type, ev) => onEvent(ev),
  });
}

const g = globalThis as typeof globalThis & { __overlayHub?: HubState };
const state: HubState = (g.__overlayHub ??= {
  overlays: new Map(),
  upstreams: new Map(),
  heartbeatTimer: null,
  upstreamFactory: defaultFactory,
  loaded: false,
  subSeq: 0,
});

if (!state.loaded && !IS_TEST) {
  state.loaded = true;
  load();
}

/* -------------------------------------------------------------------------- */
/* Engine kurulumu                                                             */
/* -------------------------------------------------------------------------- */

function buildEngine(entry: OverlayEntry): RuleEngine {
  return new RuleEngine(
    {
      getActions: () => entry.actions,
      getEvents: () => entry.events,
      // Yalnız bağlı (online) ekrana kuyruk — kimse izlemiyorsa eşleştirme boşa gitmez.
      requireOnlineScreen: true,
    },
    entry.screens.map((s) => ({
      screen: s.screen,
      maxQueueLength: s.maxQueueLength,
    })),
  );
}

/** Bir overlay entry'si kurar — engine + timerRunner bağlar (henüz başlatmaz). */
function createEntry(base: Omit<OverlayEntry, "engine" | "timerRunner" | "subscribers">): OverlayEntry {
  const entry: OverlayEntry = {
    ...base,
    engine: null as unknown as RuleEngine,
    timerRunner: null as unknown as TimerRunner,
    subscribers: new Map(),
  };
  entry.engine = buildEngine(entry);
  entry.timerRunner = createTimerRunner({
    getTimers: () => entry.timers,
    fire: (timer) => fireTimer(entry, timer),
  });
  return entry;
}

function getOrCreateEntry(id: string): OverlayEntry {
  let entry = state.overlays.get(id);
  if (!entry) {
    entry = createEntry({
      id,
      username: "",
      actions: [],
      events: [],
      timers: [],
      screens: [],
    });
    state.overlays.set(id, entry);
  }
  return entry;
}

/* -------------------------------------------------------------------------- */
/* Upstream (EulerStream) — username başına ref-count'lu tek WS                 */
/* -------------------------------------------------------------------------- */

function routeEventToOverlays(username: string, ev: LiveEvent): void {
  for (const entry of state.overlays.values()) {
    if (entry.username === username) handleLiveEvent(entry, ev);
  }
}

function ensureUpstream(username: string): void {
  if (!username) return;
  const existing = state.upstreams.get(username);
  if (existing) {
    existing.refCount += 1;
    return;
  }
  const handle = state.upstreamFactory(username, (ev) =>
    routeEventToOverlays(username, ev),
  );
  state.upstreams.set(username, { username, handle, refCount: 1 });
}

function releaseUpstream(username: string): void {
  if (!username) return;
  const up = state.upstreams.get(username);
  if (!up) return;
  up.refCount -= 1;
  if (up.refCount <= 0) {
    try {
      up.handle.close();
    } catch {
      // Zaten kapalı.
    }
    state.upstreams.delete(username);
  }
}

/** Bir entry'nin en az bir aktif abonesi var mı. */
function hasSubscribers(entry: OverlayEntry): boolean {
  return entry.subscribers.size > 0;
}

/* -------------------------------------------------------------------------- */
/* Olay işleme — eşleştir → ilgili ekran abonelerine push et                    */
/* -------------------------------------------------------------------------- */

/** Kuyruğa giren (queued) sonuçları ilgili ekran abonelerine gönderir + auto-dequeue. */
function deliver(entry: OverlayEntry, result: DispatchResult, ev: LiveEvent): void {
  for (const outcome of result.outcomes) {
    if (outcome.status !== "queued") continue;
    const { action, item } = outcome;

    const msg: WidgetInbound = buildActionMessage(action, item.queueId, ev);

    for (const sub of entry.subscribers.values()) {
      if (sub.screen === action.screen) safeSend(sub, msg);
    }

    // Çift-yönlü ACK kanalı olmadan backpressure: süre dolunca sunucu kuyruğundan düş.
    const ttl = action.durationSec * 1000 + AUTO_DEQUEUE_GRACE_MS;
    const timer = setTimeout(() => {
      entry.engine.queues.dequeue(action.screen, item.queueId);
    }, ttl);
    if (typeof timer.unref === "function") timer.unref();
  }
}

function handleLiveEvent(entry: OverlayEntry, ev: LiveEvent): DispatchResult {
  const result = entry.engine.dispatch(ev);
  deliver(entry, result, ev);
  return result;
}

/**
 * Zamanlayıcı atışı — eylemi tetikleyici eşleştirmesi OLMADAN çalıştırır
 * (RuleEngine.fireAction) ve mevcut teslimat döngüsünü kullanır (ADR-0005).
 */
function fireTimer(entry: OverlayEntry, timer: StreamTimer): void {
  const ev = systemLiveEvent();
  const result = entry.engine.fireAction(timer.actionId, ev);
  deliver(entry, result, ev);
}

function safeSend(sub: Subscriber, msg: WidgetInbound): void {
  try {
    sub.send(msg);
  } catch {
    // Abone kopmuş olabilir; abort handler temizler.
  }
}

/* -------------------------------------------------------------------------- */
/* Heartbeat — SSE/proxy keep-alive + ekran online yenileme                     */
/* -------------------------------------------------------------------------- */

function ensureHeartbeat(): void {
  if (state.heartbeatTimer || IS_TEST) return;
  const timer = setInterval(() => {
    const now = Date.now();
    for (const entry of state.overlays.values()) {
      for (const sub of entry.subscribers.values()) {
        entry.engine.queues.heartbeat(sub.screen, now);
        safeSend(sub, { kind: "heartbeat", ts: now });
      }
    }
  }, HEARTBEAT_MS);
  if (typeof timer.unref === "function") timer.unref();
  state.heartbeatTimer = timer;
}

/* -------------------------------------------------------------------------- */
/* Kalıcılık — .data/overlays.json                                             */
/* -------------------------------------------------------------------------- */

function persist(): void {
  if (IS_TEST) return;
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const data = {
      overlays: [...state.overlays.values()].map((e) => ({
        id: e.id,
        username: e.username,
        actions: e.actions,
        events: e.events,
        timers: e.timers,
        screens: e.screens,
      })),
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(data), "utf8");
  } catch {
    // Kalıcılık best-effort; hata köprüyü durdurmaz.
  }
}

function load(): void {
  try {
    if (!fs.existsSync(DATA_FILE)) return;
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const data = JSON.parse(raw) as { overlays?: OverlayConfig[] };
    for (const cfg of data.overlays ?? []) {
      const entry = createEntry({
        id: cfg.id,
        username: cfg.username ?? "",
        actions: cfg.actions ?? [],
        events: cfg.events ?? [],
        timers: cfg.timers ?? [],
        screens: cfg.screens ?? [],
      });
      state.overlays.set(entry.id, entry);
    }
  } catch {
    // Bozuk dosya köprüyü durdurmaz.
  }
}

/* -------------------------------------------------------------------------- */
/* Genel API                                                                   */
/* -------------------------------------------------------------------------- */

/** Dashboard config sync'i — entry oluşturur/günceller. */
export function upsertOverlay(cfg: OverlayConfig): void {
  const entry = getOrCreateEntry(cfg.id);
  const usernameChanged = entry.username !== cfg.username;
  const active = hasSubscribers(entry);

  // Kural verisi engine tarafından closure'dan okunuyor — referansları güncelle.
  entry.actions = cfg.actions;
  entry.events = cfg.events;
  entry.timers = cfg.timers;
  entry.screens = cfg.screens;
  for (const s of cfg.screens) {
    entry.engine.queues.setMaxLength(s.screen, s.maxQueueLength);
  }

  if (usernameChanged) {
    if (active && entry.username) releaseUpstream(entry.username);
    entry.username = cfg.username;
    if (active && entry.username) ensureUpstream(entry.username);
  }

  // Zamanlayıcı listesi değişmiş olabilir — çalışıyorsa interval'leri uzlaştır.
  entry.timerRunner.sync();

  persist();
}

/** SSE aboneliği — overlay bağlandığında. Unsubscribe fonksiyonu döner. */
export function subscribe(
  id: string,
  screen: number,
  send: (msg: WidgetInbound) => void,
): () => void {
  const entry = getOrCreateEntry(id);
  const wasEmpty = !hasSubscribers(entry);

  state.subSeq += 1;
  const subId = `s${state.subSeq}`;
  entry.subscribers.set(subId, { subId, screen, send });

  // Ekranı online işaretle (PRD §6.3 heartbeat) ve heartbeat döngüsünü başlat.
  entry.engine.queues.heartbeat(screen, Date.now());
  ensureHeartbeat();

  // İlk abone: upstream'i aç (username tanımlıysa) ve zamanlayıcıları başlat.
  // "Yayına girdiğinizde başlar" — overlay canlı (widget açık) olunca timer'lar döner;
  // TikTok bağlantısı gerektirmez (aralıklı eylem kullanıcısızdır).
  if (wasEmpty) {
    if (entry.username) ensureUpstream(entry.username);
    entry.timerRunner.start();
  }

  let released = false;
  return () => {
    if (released) return;
    released = true;
    entry.subscribers.delete(subId);
    if (!hasSubscribers(entry)) {
      if (entry.username) releaseUpstream(entry.username);
      // Son abone gitti → canlılık bitti, zamanlayıcıları durdur.
      entry.timerRunner.stop();
    }
  };
}

/** Gerçek WS olmadan sentetik olay enjeksiyonu (simulate route + testler). */
export function injectSynthetic(id: string, ev: LiveEvent) {
  const entry = state.overlays.get(id);
  if (!entry) return null;
  return handleLiveEvent(entry, ev);
}

/**
 * Bir overlay için ŞU AN bağlı (SSE abonesi olan) ekranların listesi.
 * Yerel/tek-süreç modunda panelin "Çevrimiçi/Çevrimdışı" durumunu bu belirler
 * (Supabase modunda yerine Presence kullanılır). Kayıtlı olmayan id → boş dizi.
 */
export function getOnlineScreens(id: string): number[] {
  const entry = state.overlays.get(id);
  if (!entry) return [];
  const screens = new Set<number>();
  for (const sub of entry.subscribers.values()) screens.add(sub.screen);
  return [...screens].sort((a, b) => a - b);
}

/* -------------------------------------------------------------------------- */
/* Test yardımcıları (yalnız Vitest)                                           */
/* -------------------------------------------------------------------------- */

/** Test: gerçek EulerStream yerine sahte upstream fabrikası enjekte et. */
export function __setUpstreamFactory(factory: UpstreamFactory): void {
  state.upstreamFactory = factory;
}

/** Test: registry'yi temizle. */
export function __reset(): void {
  for (const entry of state.overlays.values()) {
    // Sızan interval'leri temizle — testler arası atış olmasın.
    entry.timerRunner.stop();
  }
  for (const up of state.upstreams.values()) {
    try {
      up.handle.close();
    } catch {
      /* yut */
    }
  }
  state.overlays.clear();
  state.upstreams.clear();
  state.upstreamFactory = defaultFactory;
}

/** Test: bir username için upstream ref sayısı (0 = kapalı). */
export function __upstreamRefCount(username: string): number {
  return state.upstreams.get(username)?.refCount ?? 0;
}
