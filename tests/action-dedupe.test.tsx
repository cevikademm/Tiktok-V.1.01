import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useActionPlayer, type ResolvedAction } from "@/components/widgets/action-player";
import { buildActionMessage } from "@/lib/overlay/action-message";
import type { Action } from "@/lib/schemas/action";
import { systemLiveEvent } from "@/lib/schemas/live";

/**
 * Aynı olayın iki kez oynatılmaması — ses "iki kere çalıyor" şikâyetinin kaynağı.
 *
 * Yayıncı (connector) tarafında `queueId` örneğe özeldir: iki connector örneği
 * aynı yorumu işlerse iki FARKLI queueId üretir ve widget aynı sesi iki kez
 * çalar. Ortak olan tek şey kaynaktaki olay kimliğidir; tekilleştirme ona dayanır.
 */

function action(): Action {
  return {
    id: "act_1",
    name: "Ses",
    enabled: true,
    types: ["playAudio"],
    config: { mediaUrl: "https://example.test/a.mp3" },
    durationSec: 5,
    pointsDelta: 0,
    screen: 1,
    volume: 50,
    globalCooldownSec: 0,
    userCooldownSec: 0,
    fadeInMs: 200,
    fadeOutMs: 200,
    repeatWithCombos: false,
    skipOnNextAction: false,
    description: "",
  };
}

function resolved(overrides: Partial<ResolvedAction> = {}): ResolvedAction {
  return {
    actionId: "act_1",
    queueId: "q1",
    durationSec: 5,
    types: ["playAudio"],
    ...overrides,
  } as ResolvedAction;
}

describe("buildActionMessage", () => {
  it("tekilleştirme için kaynak olay kimliğini taşır", () => {
    const ev = systemLiveEvent({ id: "evt-42" });
    const msg = buildActionMessage(action(), "q1", ev);
    expect(msg.kind).toBe("action");
    if (msg.kind !== "action") return;
    expect(msg.payload.sourceEventId).toBe(ev.id);
  });
});

describe("useActionPlayer tekilleştirme", () => {
  it("aynı olay farklı queueId ile ikinci kez gelirse yutar", () => {
    const { result } = renderHook(() => useActionPlayer());

    // İki ayrı connector örneği → aynı olay, FARKLI queueId.
    act(() => result.current.push(resolved({ queueId: "q1", sourceEventId: "evt-1" })));
    act(() => result.current.push(resolved({ queueId: "q2", sourceEventId: "evt-1" })));

    // İlki oynatılıyor, ikincisi kuyruğa hiç girmemeli.
    expect(result.current.current?.queueId).toBe("q1");
    expect(result.current.queueLength).toBe(0);
  });

  it("farklı olaylar bastırılmaz (meşru tekrar hediyeler)", () => {
    const { result } = renderHook(() => useActionPlayer());

    act(() => result.current.push(resolved({ queueId: "q1", sourceEventId: "evt-1" })));
    act(() => result.current.push(resolved({ queueId: "q2", sourceEventId: "evt-2" })));

    expect(result.current.current?.queueId).toBe("q1");
    expect(result.current.queueLength).toBe(1); // ikincisi kuyrukta bekliyor
  });

  it("kaynak olay kimliği yoksa hiçbir şey bastırılmaz (eski yayıncılar)", () => {
    const { result } = renderHook(() => useActionPlayer());

    act(() => result.current.push(resolved({ queueId: "q1" })));
    act(() => result.current.push(resolved({ queueId: "q2" })));

    expect(result.current.current?.queueId).toBe("q1");
    expect(result.current.queueLength).toBe(1);
  });
});
