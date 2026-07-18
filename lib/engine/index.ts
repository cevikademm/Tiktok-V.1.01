import type { Action } from "@/lib/schemas/action";
import type { StreamEvent } from "@/lib/schemas/event";
import type { LiveEvent } from "@/lib/schemas/live";
import { CooldownTracker, EventDeduplicator } from "./cooldown";
import { matchEvents, resolveActionIds } from "./matcher";
import { ScreenQueues, type QueueItem } from "./queue";

export * from "./cooldown";
export * from "./matcher";
export * from "./placeholders";
export * from "./queue";

/**
 * Kural motoru — PRD §6.1 akışının saf TS çekirdeği:
 *   olay → dedup → kural eşleştirme → cooldown → ekran kuyruğu
 * UI ve taşıma katmanı (WS) bunun DIŞINDA.
 */

export interface EngineDeps {
  getActions: () => Action[];
  getEvents: () => StreamEvent[];
  /** Top gifter sıralaması — rol filtresi için. */
  getTopGifterIds?: () => string[];
  /** Test edilebilirlik: zaman ve rastgelelik enjekte edilir. */
  now?: () => number;
  pickRandom?: (n: number) => number;
  /** Offline ekrana kuyruk reddedilsin mi (PRD §5.3 "Screen is offline!"). */
  requireOnlineScreen?: boolean;
}

export type DispatchOutcome =
  | { status: "queued"; action: Action; item: QueueItem }
  | { status: "cooldown"; action: Action; reason: "global" | "user" }
  | { status: "rejected"; action: Action; reason: "queueFull" | "screenOffline" | "invalidScreen" }
  | { status: "disabled"; action: Action };

export interface DispatchResult {
  /** Tekrar eden olay yutuldu mu (idempotency). */
  duplicate: boolean;
  matchedRules: StreamEvent[];
  outcomes: DispatchOutcome[];
}

export class RuleEngine {
  readonly queues: ScreenQueues;
  readonly cooldowns = new CooldownTracker();
  readonly dedup = new EventDeduplicator();

  private readonly now: () => number;
  private readonly pickRandom: (n: number) => number;

  constructor(
    private readonly deps: EngineDeps,
    screenDefaults?: Array<{ screen: number; maxQueueLength: number }>,
  ) {
    this.queues = new ScreenQueues(screenDefaults);
    this.now = deps.now ?? (() => Date.now());
    this.pickRandom = deps.pickRandom ?? ((n) => Math.floor(Math.random() * n));
  }

  /** Bir canlı olayı işler ve sonuçları döndürür. */
  dispatch(ev: LiveEvent): DispatchResult {
    if (!this.dedup.accept(ev.id)) {
      return { duplicate: true, matchedRules: [], outcomes: [] };
    }

    const now = this.now();
    const rules = matchEvents(this.deps.getEvents(), ev, {
      topGifterIds: this.deps.getTopGifterIds?.(),
    });

    const actions = this.deps.getActions();
    const byId = new Map(actions.map((a) => [a.id, a]));
    const outcomes: DispatchOutcome[] = [];

    for (const rule of rules) {
      for (const actionId of resolveActionIds(rule, this.pickRandom)) {
        const action = byId.get(actionId);
        if (!action) continue;

        if (!action.enabled) {
          outcomes.push({ status: "disabled", action });
          continue;
        }

        const cd = this.cooldowns.canRun(action.id, ev.user.userId, now);
        if (!cd.ok) {
          outcomes.push({ status: "cooldown", action, reason: cd.reason });
          continue;
        }

        // Gift combo tekrarı — PRD §6.2 streak/combo.
        const repeats =
          action.repeatWithCombos && ev.repeatCount && ev.repeatCount > 1
            ? ev.repeatCount
            : 1;

        for (let i = 0; i < repeats; i++) {
          const res = this.queues.enqueue(
            {
              actionId: action.id,
              userId: ev.user.userId,
              durationSec: action.durationSec,
              skipOnNextAction: action.skipOnNextAction,
            },
            action.screen,
            now,
            { requireOnline: this.deps.requireOnlineScreen },
          );

          if (res.ok) {
            outcomes.push({ status: "queued", action, item: res.item });
          } else {
            outcomes.push({ status: "rejected", action, reason: res.reason });
            break;
          }
        }

        this.cooldowns.mark(action.id, ev.user.userId, now, {
          globalSec: action.globalCooldownSec,
          userSec: action.userCooldownSec,
        });
      }
    }

    return { duplicate: false, matchedRules: rules, outcomes };
  }

  /**
   * Bir eylemi etkinlik/tetikleyici eşleştirmesi OLMADAN doğrudan çalıştırır —
   * Zamanlayıcı (Timer) kaynaklı çalıştırma (PRD §6.2 "Timer olayları"). Timer,
   * eylemi doğrudan `actionId` ile adlar; kullanıcı bağlamı yoktur:
   *   - kullanıcı/genel cooldown UYGULANMAZ (aralığın kendisi hız sınırıdır),
   *   - dedup UYGULANMAZ (her atış kasıtlıdır).
   * Kuyruk kapasitesi / offline ekran / geçersiz ekran reddi korunur — böylece
   * çağıran taraf mevcut "queued → teslim et → auto-dequeue" döngüsünü yeniden kullanır.
   */
  fireAction(actionId: string, ev: LiveEvent): DispatchResult {
    const action = this.deps.getActions().find((a) => a.id === actionId);
    if (!action) return { duplicate: false, matchedRules: [], outcomes: [] };

    if (!action.enabled) {
      return { duplicate: false, matchedRules: [], outcomes: [{ status: "disabled", action }] };
    }

    const res = this.queues.enqueue(
      {
        actionId: action.id,
        userId: ev.user.userId,
        durationSec: action.durationSec,
        skipOnNextAction: action.skipOnNextAction,
      },
      action.screen,
      this.now(),
      { requireOnline: this.deps.requireOnlineScreen },
    );

    const outcome: DispatchOutcome = res.ok
      ? { status: "queued", action, item: res.item }
      : { status: "rejected", action, reason: res.reason };

    return { duplicate: false, matchedRules: [], outcomes: [outcome] };
  }

  reset(): void {
    this.queues.clear();
    this.cooldowns.reset();
    this.dedup.reset();
  }
}
