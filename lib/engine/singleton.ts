import type { Action } from "@/lib/schemas/action";
import type { StreamEvent } from "@/lib/schemas/event";
import { RuleEngine } from "./index";

/**
 * Uygulama düzeyinde TEK kural motoru örneği.
 *
 * Neden modül seviyesinde: motorun kuyruk/cooldown/dedup durumu oturum boyunca
 * yaşamalı; React ağacına bağlarsak remount'ta sıfırlanır. Mock backend de
 * (`lib/data/mock`) aynı desende tekil.
 *
 * Motor güncel eylem/etkinlik listesini buradan okur; UI değişiklikleri
 * `setEngineData` ile bildirir (render dışı, effect'ten çağrılır).
 */

const data: { actions: Action[]; events: StreamEvent[] } = {
  actions: [],
  events: [],
};

let engine: RuleEngine | null = null;

export function getEngine(): RuleEngine {
  engine ??= new RuleEngine({
    getActions: () => data.actions,
    getEvents: () => data.events,
  });
  return engine;
}

export function setEngineData(next: {
  actions?: Action[];
  events?: StreamEvent[];
}): void {
  if (next.actions) data.actions = next.actions;
  if (next.events) data.events = next.events;
}

/** Testler ve tam sıfırlama için — motor durumu ve verisi temizlenir. */
export function resetEngine(): void {
  engine?.reset();
  engine = null;
  data.actions = [];
  data.events = [];
}
