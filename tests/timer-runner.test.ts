// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTimerRunner } from "@/lib/overlay/timer-runner";
import type { StreamTimer } from "@/lib/schemas/event";

/* ------------------------------------------------------------------ fixtures */

function timer(overrides: Partial<StreamTimer> = {}): StreamTimer {
  return { id: "t1", active: true, intervalMinutes: 1, actionId: "a1", ...overrides };
}

const MIN = 60_000;

describe("createTimerRunner — aralıklı çalıştırma (ADR-0005)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("aralık dolunca fire çağrılır; stop tüm interval'leri temizler", () => {
    const fired: string[] = [];
    const runner = createTimerRunner({
      getTimers: () => [timer({ intervalMinutes: 1 })],
      fire: (t) => fired.push(t.id),
    });

    runner.start();
    vi.advanceTimersByTime(1 * MIN);
    expect(fired).toEqual(["t1"]);

    vi.advanceTimersByTime(2 * MIN); // 120s → 60s(1) + 120s(1) daha
    expect(fired).toEqual(["t1", "t1", "t1"]);

    runner.stop();
    vi.advanceTimersByTime(5 * MIN);
    expect(fired).toEqual(["t1", "t1", "t1"]); // durunca artmaz
  });

  it("start çağrılmadan hiç ateşlemez", () => {
    const fired: string[] = [];
    createTimerRunner({ getTimers: () => [timer()], fire: (t) => fired.push(t.id) });
    vi.advanceTimersByTime(10 * MIN);
    expect(fired).toEqual([]);
  });

  it("pasif timer ateşlenmez", () => {
    const fired: string[] = [];
    const runner = createTimerRunner({
      getTimers: () => [timer({ active: false })],
      fire: (t) => fired.push(t.id),
    });
    runner.start();
    vi.advanceTimersByTime(5 * MIN);
    expect(fired).toEqual([]);
  });

  it("sync: yeni timer eklenir, kaldırılan durur", () => {
    let list: StreamTimer[] = [];
    const fired: string[] = [];
    const runner = createTimerRunner({ getTimers: () => list, fire: (t) => fired.push(t.id) });

    runner.start();
    vi.advanceTimersByTime(2 * MIN);
    expect(fired).toEqual([]); // liste boş

    list = [timer({ id: "t1", intervalMinutes: 1 })];
    runner.sync();
    vi.advanceTimersByTime(1 * MIN);
    expect(fired).toEqual(["t1"]);

    list = []; // kaldırıldı
    runner.sync();
    vi.advanceTimersByTime(3 * MIN);
    expect(fired).toEqual(["t1"]); // artık ateşlemez
  });

  it("sync: aralık değişince yeni aralıkla çalışır", () => {
    let list: StreamTimer[] = [timer({ id: "t1", intervalMinutes: 5 })];
    const fired: string[] = [];
    const runner = createTimerRunner({ getTimers: () => list, fire: (t) => fired.push(t.id) });

    runner.start();
    vi.advanceTimersByTime(1 * MIN);
    expect(fired).toEqual([]); // 5 dk dolmadı

    list = [timer({ id: "t1", intervalMinutes: 1 })];
    runner.sync();
    vi.advanceTimersByTime(1 * MIN);
    expect(fired).toEqual(["t1"]); // yeni 1 dk aralık
  });

  it("fire anında GÜNCEL actionId okunur (aralık aynıysa bile)", () => {
    let list: StreamTimer[] = [timer({ id: "t1", intervalMinutes: 1, actionId: "a1" })];
    const firedActions: string[] = [];
    const runner = createTimerRunner({
      getTimers: () => list,
      fire: (t) => firedActions.push(t.actionId),
    });

    runner.start();
    // Aralık değişmez, yalnız actionId değişir → interval yeniden kurulmaz ama fire güncel okur.
    list = [timer({ id: "t1", intervalMinutes: 1, actionId: "a2" })];
    runner.sync();
    vi.advanceTimersByTime(1 * MIN);
    expect(firedActions).toEqual(["a2"]);
  });
});
