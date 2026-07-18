/**
 * Zamanlayıcı çalıştırıcısı — Timer (aralıklı otomatik eylem) yürütücüsü.
 *
 * Overlay runtime'ında (hem SSE hub'ı hem connector worker) kullanılır: bir
 * overlay'in `StreamTimer` listesini alır, her AKTİF timer için `intervalMinutes`
 * aralığında `fire(timer)` çağırır. Tetikleyici/olay YOK — timer eylemi doğrudan
 * `RuleEngine.fireAction` ile çalıştırılır (PRD §6.2 "Timer olayları").
 *
 * "Yayına girdiğinizde başlar": `start()` yalnız overlay canlıyken (hub'da abone,
 * connector'da upstream) çağrılır; `stop()` canlılık bitince tüm interval'leri temizler.
 *
 * Saf TS: DOM/Node bağımlılığı yok. `setInterval`/`clearInterval` enjekte edilebilir
 * (Vitest fake timers ile test için).
 */

import type { StreamTimer } from "@/lib/schemas/event";

/** Enjekte edilebilir zamanlayıcı tanıtıcısı (Node.Timeout | number). */
type IntervalHandle = ReturnType<typeof setInterval>;

export interface TimerRunnerOptions {
  /** Güncel timer listesi (her uzlaşımda taze okunur → CRUD değişimlerini yansıtır). */
  getTimers: () => StreamTimer[];
  /** Bir timer ateşlendiğinde çağrılır (eylemi çalıştıran runtime'a özel). */
  fire: (timer: StreamTimer) => void;
  /** Test enjeksiyonu — verilmezse global setInterval. */
  setIntervalFn?: (cb: () => void, ms: number) => IntervalHandle;
  /** Test enjeksiyonu — verilmezse global clearInterval. */
  clearIntervalFn?: (handle: IntervalHandle) => void;
}

export interface TimerRunner {
  /** Çalışıyorsa güncel listeye göre interval'leri ekle/çıkar/güncelle. */
  sync(): void;
  /** Canlılık başladı — interval'leri kur. */
  start(): void;
  /** Canlılık bitti — tüm interval'leri temizle. */
  stop(): void;
  readonly running: boolean;
}

const MS_PER_MINUTE = 60_000;

export function createTimerRunner(opts: TimerRunnerOptions): TimerRunner {
  const setIv =
    opts.setIntervalFn ?? ((cb, ms) => setInterval(cb, ms));
  const clearIv =
    opts.clearIntervalFn ?? ((handle) => clearInterval(handle));

  /** Aktif interval'ler: timerId → {aralık(ms), handle}. */
  const active = new Map<string, { intervalMs: number; handle: IntervalHandle }>();
  let running = false;

  function clearAll(): void {
    for (const { handle } of active.values()) clearIv(handle);
    active.clear();
  }

  /** Yalnız çalıştırılabilir timer'lar: aktif + geçerli aralık + bağlı eylem. */
  function eligible(): StreamTimer[] {
    return opts
      .getTimers()
      .filter((t) => t.active && t.intervalMinutes > 0 && !!t.actionId);
  }

  function reconcile(): void {
    if (!running) return;
    const timers = eligible();
    const wantedMs = new Map(timers.map((t) => [t.id, t.intervalMinutes * MS_PER_MINUTE]));

    // Kaldırılan / pasifleşen / aralığı değişen → interval'i temizle.
    for (const [id, entry] of [...active.entries()]) {
      const wanted = wantedMs.get(id);
      if (wanted === undefined || wanted !== entry.intervalMs) {
        clearIv(entry.handle);
        active.delete(id);
      }
    }

    // Yeni / aralığı değişmiş → interval kur.
    for (const t of timers) {
      if (active.has(t.id)) continue;
      const intervalMs = t.intervalMinutes * MS_PER_MINUTE;
      const handle = setIv(() => {
        // Fire anında GÜNCEL timer'ı oku — actionId aralık değişmeden değişmiş olabilir.
        const current = eligible().find((x) => x.id === t.id);
        if (current) opts.fire(current);
      }, intervalMs);
      // Node'da süreç kapanışını engelleme (varsa); tarayıcıda handle number → no-op.
      const maybeUnref = handle as unknown as { unref?: () => void };
      if (typeof maybeUnref.unref === "function") maybeUnref.unref();
      active.set(t.id, { intervalMs, handle });
    }
  }

  return {
    get running() {
      return running;
    },
    start() {
      if (running) return;
      running = true;
      reconcile();
    },
    stop() {
      running = false;
      clearAll();
    },
    sync() {
      reconcile();
    },
  };
}
