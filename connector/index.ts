/**
 * ─── Overlay Connector Worker ────────────────────────────────────────────────
 * Hibrit mimarinin KALICI parçası (ADR-0003). Vercel'in tutamadığı tek şeyi yapar:
 * TikTok canlı bağlantısını (Euler Cloud WebSocket) sürekli açık tutmak.
 *
 * Akış:
 *   1) Supabase `overlay_configs` tablosunu periyodik okur (hangi username +
 *      hangi kurallar). Panel bu tabloyu /api/overlay/register ile yazar.
 *   2) Her username için TEK Euler Cloud WS (ref-count → 25-WS limitini korur).
 *   3) Gelen olay sunucu-taraflı RuleEngine'den geçer (lib/engine, saf TS).
 *   4) Eşleşen action, Supabase Realtime Broadcast ile `overlay-<id>-<screen>`
 *      kanalına yayınlanır → tarayıcıdaki widget (OBS/TikTok LIVE Studio) oynatır.
 *
 * Deploy: Railway / Render / Fly (ücretsiz katman). Node ≥ 22 (global WebSocket).
 *   Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, EULER_STREAM_API_KEY
 *   Çalıştır: pnpm connector   (kökte tsx ile)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { RuleEngine, type DispatchResult } from "@/lib/engine";
import { buildActionMessage } from "@/lib/overlay/action-message";
import { broadcastToChannel } from "@/lib/overlay/broadcast";
import { overlayChannel } from "@/lib/overlay/realtime";
import { createTimerRunner, type TimerRunner } from "@/lib/overlay/timer-runner";
import { connectEulerStream, type EulerHandle } from "@/lib/server/eulerstream";
import {
  OVERLAY_CONFIG_TABLE,
  getAdminSupabase,
  type OverlayConfigRow,
} from "@/lib/supabase/admin";
import type { Action } from "@/lib/schemas/action";
import type { StreamEvent, StreamTimer } from "@/lib/schemas/event";
import { systemLiveEvent, type LiveEvent } from "@/lib/schemas/live";

/* -------------------------------------------------------------------------- */
/* Konfig                                                                      */
/* -------------------------------------------------------------------------- */

const POLL_MS = Number(process.env.CONNECTOR_POLL_MS ?? 3000);
const AUTO_DEQUEUE_GRACE_MS = 500;
const SUPABASE_URL =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

/* -------------------------------------------------------------------------- */
/* Durum                                                                       */
/* -------------------------------------------------------------------------- */

interface OverlayState {
  id: string;
  username: string;
  actions: Action[];
  events: StreamEvent[];
  timers: StreamTimer[];
  screens: { screen: number; maxQueueLength: number }[];
  engine: RuleEngine;
  /** Aralıklı eylem çalıştırıcısı — upstream (canlılık) açıkken çalışır (ADR-0005). */
  timerRunner: TimerRunner;
  /** Şu an upstream ref tuttuğumuz username ("" = yok) — geçişleri idempotent yapar. */
  upstreamUsername: string;
}

/**
 * Bir TikTok kullanıcısına açık (ya da açılmayı bekleyen) tek upstream.
 *
 * Yayıncı 7/24 yayında değil: connector çoğu zaman "henüz yayında değil"
 * cevabı alır. Bu bir HATA değil, NORMAL durumdur — bağlantı yayın açılana
 * kadar yeniden denenmelidir. (Eskiden tek deneme yapılıyordu; başarısız
 * olunca upstream ölü kalıyor, yayıncı yayını açsa bile connector bunu asla
 * fark etmiyordu.)
 */
interface Upstream {
  /** Açık bağlantı; kapalıyken veya yeniden deneme beklerken null. */
  handle: EulerHandle | null;
  /** Kaç overlay bu kullanıcıyı istiyor (0 → bırakılır). */
  refCount: number;
  /** Planlanmış yeniden deneme (yoksa null). */
  retryTimer: ReturnType<typeof setTimeout> | null;
  /** Sıradaki denemeye kalan süre — üstel artar, başarılı bağlantıda sıfırlanır. */
  retryDelayMs: number;
  /** releaseUpstream çağrıldı → artık yeniden deneme yapma. */
  released: boolean;
}

/**
 * Yeniden deneme aralığı. Euler ücretsiz katman sınırı 2500 istek/gün; tek
 * kullanıcı için 60 sn'lik sabit aralık günde ~1440 denemedir (sınırın altında).
 * İlk denemeler daha sık: yayın yeni açıldıysa hızlı yakalansın.
 */
const RETRY_BASE_MS = 15_000;
const RETRY_MAX_MS = 60_000;

const overlays = new Map<string, OverlayState>();
const upstreams = new Map<string, Upstream>();

/* -------------------------------------------------------------------------- */
/* Engine                                                                      */
/* -------------------------------------------------------------------------- */

function buildEngine(state: OverlayState): RuleEngine {
  return new RuleEngine(
    {
      getActions: () => state.actions,
      getEvents: () => state.events,
      // Connector aboneyi bilmez (widget'lar Supabase'e doğrudan bağlanır) →
      // her zaman eşleştir ve yayınla; kimse dinlemiyorsa broadcast no-op'tur.
      requireOnlineScreen: false,
    },
    state.screens.map((s) => ({ screen: s.screen, maxQueueLength: s.maxQueueLength })),
  );
}

/* -------------------------------------------------------------------------- */
/* Olay işleme                                                                 */
/* -------------------------------------------------------------------------- */

/** Kuyruğa giren (queued) sonuçları Realtime kanalına yayınlar + auto-dequeue. */
function deliver(state: OverlayState, result: DispatchResult, ev: LiveEvent): void {
  for (const outcome of result.outcomes) {
    if (outcome.status !== "queued") continue;
    const { action, item } = outcome;

    // Supabase Realtime Broadcast (HTTP — durumsuz, ölçeklenir; ortak yardımcı).
    void broadcastToChannel(
      SUPABASE_URL,
      SERVICE_KEY,
      overlayChannel(state.id, action.screen),
      buildActionMessage(action, item.queueId, ev),
    );

    // Süre dolunca sunucu kuyruğundan düş (ACK kanalı yok — hub ile aynı desen).
    const ttl = action.durationSec * 1000 + AUTO_DEQUEUE_GRACE_MS;
    const timer = setTimeout(() => {
      state.engine.queues.dequeue(action.screen, item.queueId);
    }, ttl);
    if (typeof timer.unref === "function") timer.unref();
  }
}

function handleLiveEvent(state: OverlayState, ev: LiveEvent): void {
  deliver(state, state.engine.dispatch(ev), ev);
}

/**
 * Zamanlayıcı atışı — eylemi tetikleyici eşleştirmesi OLMADAN çalıştırır
 * (RuleEngine.fireAction) ve mevcut yayın döngüsünü kullanır (ADR-0005).
 */
function fireTimer(state: OverlayState, timer: StreamTimer): void {
  const ev = systemLiveEvent();
  console.log(`[connector] timer atışı → @${state.username} · ${timer.actionId}`);
  deliver(state, state.engine.fireAction(timer.actionId, ev), ev);
}

function routeEventToOverlays(username: string, ev: LiveEvent): void {
  for (const state of overlays.values()) {
    if (state.username === username) handleLiveEvent(state, ev);
  }
}

/* -------------------------------------------------------------------------- */
/* Upstream (Euler Cloud WS) — username başına ref-count'lu tek bağlantı         */
/* -------------------------------------------------------------------------- */

function ensureUpstream(username: string): void {
  if (!username) return;
  const existing = upstreams.get(username);
  if (existing) {
    existing.refCount += 1;
    return;
  }
  const up: Upstream = {
    handle: null,
    refCount: 1,
    retryTimer: null,
    retryDelayMs: RETRY_BASE_MS,
    released: false,
  };
  upstreams.set(username, up);
  openUpstream(username, up);
}

function openUpstream(username: string, up: Upstream): void {
  console.log(`[connector] upstream AÇ → @${username}`);
  up.handle = connectEulerStream(username, {
    onEvent: (_type, ev) => routeEventToOverlays(username, ev),
    onStatus: (status) => {
      console.log(`[connector] @${username}: ${status}`);
      if (status === "connected") {
        // Bağlantı kuruldu — sonraki kopmada baştan (kısa aralıkla) dene.
        up.retryDelayMs = RETRY_BASE_MS;
      } else {
        // Yayın bitti / bağlantı düştü → yeniden bağlanmayı planla.
        scheduleReconnect(username, up, "bağlantı düştü");
      }
    },
    onError: (message) => scheduleReconnect(username, up, message),
  });
}

/**
 * Upstream'i kapatıp yeniden denemeyi planlar (üstel geri çekilme).
 * Aynı anda birden çok tetikleyici gelebilir (önce onError, sonra onclose) —
 * `retryTimer` kontrolü sayesinde yalnız bir deneme planlanır.
 */
function scheduleReconnect(username: string, up: Upstream, reason: string): void {
  if (up.released || up.retryTimer) return;

  try {
    up.handle?.close();
  } catch {
    // Zaten kapalı.
  }
  up.handle = null;

  const delay = up.retryDelayMs;
  console.warn(
    `[connector] @${username}: ${reason} — ${Math.round(delay / 1000)} sn sonra yeniden denenecek`,
  );

  up.retryTimer = setTimeout(() => {
    up.retryTimer = null;
    if (up.released || up.refCount <= 0) return;
    up.retryDelayMs = Math.min(up.retryDelayMs * 2, RETRY_MAX_MS);
    openUpstream(username, up);
  }, delay);
  // Bekleyen deneme süreci canlı tutmasın (process.exit engellenmesin).
  up.retryTimer.unref?.();
}

function releaseUpstream(username: string): void {
  if (!username) return;
  const up = upstreams.get(username);
  if (!up) return;
  up.refCount -= 1;
  if (up.refCount <= 0) {
    console.log(`[connector] upstream KAPAT → @${username}`);
    up.released = true;
    if (up.retryTimer) {
      clearTimeout(up.retryTimer);
      up.retryTimer = null;
    }
    try {
      up.handle?.close();
    } catch {
      // Zaten kapalı.
    }
    upstreams.delete(username);
  }
}

/* -------------------------------------------------------------------------- */
/* Config senkronu — overlay_configs polling                                    */
/* -------------------------------------------------------------------------- */

function upsertOverlay(row: OverlayConfigRow): void {
  let state = overlays.get(row.id);
  if (!state) {
    const created: OverlayState = {
      id: row.id,
      username: "",
      actions: [],
      events: [],
      timers: [],
      screens: [],
      engine: null as unknown as RuleEngine,
      timerRunner: null as unknown as TimerRunner,
      upstreamUsername: "",
    };
    created.engine = buildEngine(created);
    created.timerRunner = createTimerRunner({
      getTimers: () => created.timers,
      fire: (timer) => fireTimer(created, timer),
    });
    state = created;
    overlays.set(row.id, state);
  }

  const username = (row.username ?? "").replace(/^@/, "").trim();
  state.actions = (row.actions ?? []) as Action[];
  state.events = (row.events ?? []) as StreamEvent[];
  state.timers = (row.timers ?? []) as StreamTimer[];
  state.screens = row.screens ?? [];
  state.username = username;
  for (const s of state.screens) {
    state.engine.queues.setMaxLength(s.screen, s.maxQueueLength);
  }

  // İstenen upstream = (ekran var && username var) ? username : yok.
  // Upstream (canlılık) açıldığında zamanlayıcılar da başlar, kapandığında durur.
  const desired = state.screens.length > 0 && username ? username : "";
  if (desired !== state.upstreamUsername) {
    if (state.upstreamUsername) {
      releaseUpstream(state.upstreamUsername);
      state.timerRunner.stop();
    }
    state.upstreamUsername = desired;
    if (desired) {
      ensureUpstream(desired);
      state.timerRunner.start();
    }
  }

  // Timer listesi değişmiş olabilir — çalışıyorsa interval'leri uzlaştır.
  state.timerRunner.sync();
}

function removeOverlay(id: string): void {
  const state = overlays.get(id);
  if (!state) return;
  if (state.upstreamUsername) releaseUpstream(state.upstreamUsername);
  state.timerRunner.stop();
  overlays.delete(id);
}

async function poll(): Promise<void> {
  const sb = getAdminSupabase();
  if (!sb) return;
  const { data, error } = await sb
    .from(OVERLAY_CONFIG_TABLE)
    .select("id, username, actions, events, timers, screens");
  if (error) {
    console.warn("[connector] poll hatası:", error.message);
    return;
  }

  const seen = new Set<string>();
  for (const row of (data ?? []) as OverlayConfigRow[]) {
    seen.add(row.id);
    upsertOverlay(row);
  }
  for (const id of [...overlays.keys()]) {
    if (!seen.has(id)) removeOverlay(id);
  }
}

/* -------------------------------------------------------------------------- */
/* Giriş noktası                                                               */
/* -------------------------------------------------------------------------- */

async function main(): Promise<void> {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error(
      "[connector] SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli. Çıkılıyor.",
    );
    process.exit(1);
  }
  if (!process.env.EULER_STREAM_API_KEY) {
    console.warn(
      "[connector] EULER_STREAM_API_KEY tanımsız — upstream bağlantılar başarısız olur.",
    );
  }
  if (typeof (globalThis as { WebSocket?: unknown }).WebSocket !== "function") {
    console.error("[connector] Global WebSocket yok (Node ≥ 22 gerekir). Çıkılıyor.");
    process.exit(1);
  }

  console.log(
    `[connector] başladı · poll ${POLL_MS}ms · Supabase ${SUPABASE_URL.replace(/^https?:\/\//, "")}`,
  );

  // İlk poll hata verse bile süreç ölmesin — sonraki döngüde tekrar dener.
  await poll().catch((e) => console.error("[connector] ilk poll hatası:", e));
  setInterval(() => {
    poll().catch((e) => console.error("[connector] poll hatası:", e));
  }, POLL_MS);
}

// 24/7 worker dayanıklılığı: geçici hatalar (ağ, Euler WS, Supabase) süreci
// ÖLDÜRMESİN. Logla ve devam et — Railway crash/restart-loop'unu önler.
process.on("unhandledRejection", (reason) => {
  console.error("[connector] unhandledRejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[connector] uncaughtException:", err);
});

main().catch((err) => {
  console.error("[connector] main başlatma hatası:", err);
  process.exit(1);
});
