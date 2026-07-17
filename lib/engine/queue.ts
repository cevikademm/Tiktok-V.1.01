import { SCREEN_MAX, SCREEN_MIN } from "@/lib/schemas/action";

/**
 * Ekran kuyrukları — PRD §6.2:
 * 8 ekran, her biri bağımsız FIFO + maks uzunluk + offline algılama (heartbeat).
 */

export interface QueueItem {
  queueId: string;
  actionId: string;
  userId: string;
  durationSec: number;
  skipOnNextAction: boolean;
  enqueuedAt: number;
}

export type EnqueueResult =
  | { ok: true; item: QueueItem }
  | { ok: false; reason: "queueFull" | "screenOffline" | "invalidScreen" };

/** Widget heartbeat'i bu süre içinde gelmezse ekran offline sayılır. */
export const HEARTBEAT_TIMEOUT_MS = 10_000;

export class ScreenQueues {
  private queues = new Map<number, QueueItem[]>();
  private maxLength = new Map<number, number>();
  private lastHeartbeat = new Map<number, number>();
  private seq = 0;

  constructor(defaults?: Array<{ screen: number; maxQueueLength: number }>) {
    for (let s = SCREEN_MIN; s <= SCREEN_MAX; s++) {
      this.queues.set(s, []);
      this.maxLength.set(s, 10);
    }
    for (const d of defaults ?? []) {
      this.maxLength.set(d.screen, d.maxQueueLength);
    }
  }

  setMaxLength(screen: number, max: number): void {
    this.maxLength.set(screen, max);
  }

  /** Widget bağlıyken periyodik çağrılır (PRD §6.3 heartbeat). */
  heartbeat(screen: number, now: number): void {
    this.lastHeartbeat.set(screen, now);
  }

  isOnline(screen: number, now: number): boolean {
    const last = this.lastHeartbeat.get(screen);
    return last !== undefined && now - last < HEARTBEAT_TIMEOUT_MS;
  }

  markOffline(screen: number): void {
    this.lastHeartbeat.delete(screen);
  }

  length(screen: number): number {
    return this.queues.get(screen)?.length ?? 0;
  }

  peek(screen: number): QueueItem | undefined {
    return this.queues.get(screen)?.[0];
  }

  list(screen: number): readonly QueueItem[] {
    return this.queues.get(screen) ?? [];
  }

  /**
   * Kuyruğa ekler. Offline ekran ve dolu kuyruk reddedilir —
   * çağıran taraf "Screen is offline!" / "Screen queue is full!" toast'ını gösterir.
   */
  enqueue(
    input: Omit<QueueItem, "queueId" | "enqueuedAt">,
    screen: number,
    now: number,
    opts: { requireOnline?: boolean } = {},
  ): EnqueueResult {
    if (screen < SCREEN_MIN || screen > SCREEN_MAX) {
      return { ok: false, reason: "invalidScreen" };
    }
    if (opts.requireOnline && !this.isOnline(screen, now)) {
      return { ok: false, reason: "screenOffline" };
    }

    const q = this.queues.get(screen);
    if (!q) return { ok: false, reason: "invalidScreen" };

    const max = this.maxLength.get(screen) ?? 10;
    if (q.length >= max) return { ok: false, reason: "queueFull" };

    // "Skip on next action": yeni öğe gelince, bekleyen skip'li öğeler düşer.
    const pending = q.filter((i) => !i.skipOnNextAction || i === q[0]);
    q.length = 0;
    q.push(...pending);

    this.seq += 1;
    const item: QueueItem = {
      ...input,
      queueId: `q${this.seq}`,
      enqueuedAt: now,
    };
    q.push(item);
    return { ok: true, item };
  }

  /** Oynatılan öğeyi kuyruktan düşürür. */
  dequeue(screen: number, queueId?: string): QueueItem | undefined {
    const q = this.queues.get(screen);
    if (!q || q.length === 0) return undefined;
    if (queueId === undefined) return q.shift();

    const idx = q.findIndex((i) => i.queueId === queueId);
    if (idx === -1) return undefined;
    return q.splice(idx, 1)[0];
  }

  clear(screen?: number): void {
    if (screen === undefined) {
      for (const q of this.queues.values()) q.length = 0;
      return;
    }
    const q = this.queues.get(screen);
    if (q) q.length = 0;
  }
}
