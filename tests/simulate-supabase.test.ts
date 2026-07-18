// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { simulateOverSupabase } from "@/lib/overlay/simulate-supabase";
import { overlayChannel } from "@/lib/overlay/realtime";
import { actionDraftSchema, type Action } from "@/lib/schemas/action";
import type { StreamEvent } from "@/lib/schemas/event";
import type { LiveEvent, LiveUser } from "@/lib/schemas/live";
import type { OverlayConfigRow } from "@/lib/supabase/admin";

/**
 * Sim­üle olayının Supabase/hibrit yolunda (connector eşdeğeri) doğru kanala
 * BİREBİR `action` mesajı yayınlandığını doğrular (ADR-0003).
 */

const OID = "33333333-3333-4333-8333-333333333333";
const SUPABASE_URL = "https://proj.supabase.co";
const SERVICE_KEY = "svc-key";

function user(overrides: Partial<LiveUser> = {}): LiveUser {
  return {
    uniqueId: "ayse_kaya",
    nickname: "Ayşe",
    userId: "u1",
    isFollower: false,
    isSubscriber: false,
    isModerator: false,
    teamMemberLevel: 0,
    ...overrides,
  };
}

let evSeq = 0;
function gift(overrides: Partial<LiveEvent> = {}): LiveEvent {
  evSeq += 1;
  return {
    id: `ev_${evSeq}`,
    type: "gift",
    ts: 1000,
    user: user(),
    giftId: "5655",
    giftName: "Rose",
    coins: 5,
    repeatCount: 1,
    repeatEnd: true,
    ...overrides,
  };
}

function action(overrides: Partial<Action> = {}): Action {
  return {
    ...actionDraftSchema.parse({ name: "Test", types: ["showText"] }),
    id: "a1",
    ...overrides,
  };
}

function rule(overrides: Partial<StreamEvent> = {}): StreamEvent {
  return {
    id: "r1",
    active: true,
    trigger: "gift_min",
    who: "any",
    conditions: { minCoins: 1 },
    actionsAll: ["a1"],
    actionsRandom: [],
    ...overrides,
  } as StreamEvent;
}

function row(overrides: Partial<OverlayConfigRow> = {}): OverlayConfigRow {
  return {
    id: OID,
    username: "streamer",
    actions: [action({ id: "a1", screen: 2 })],
    events: [rule()],
    screens: [{ screen: 2, maxQueueLength: 10 }],
    timers: [],
    ...overrides,
  };
}

const fetchMock = vi.fn(
  (_url: string, _init?: RequestInit): Promise<Response> =>
    Promise.resolve({ ok: true, status: 200 } as Response),
);

beforeEach(() => {
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("simulateOverSupabase — motor + broadcast (ADR-0003)", () => {
  it("eşleşen action, doğru ekran kanalına 'action' mesajı olarak yayınlanır", async () => {
    const result = await simulateOverSupabase(SUPABASE_URL, SERVICE_KEY, row(), gift({ coins: 5 }));

    expect(result.matched).toBe(1);
    expect(result.broadcast).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${SUPABASE_URL}/realtime/v1/api/broadcast`);

    const body = JSON.parse(init?.body as string) as {
      messages: Array<{ topic: string; event: string; payload: { kind: string } }>;
    };
    expect(body.messages[0].topic).toBe(overlayChannel(OID, 2));
    expect(body.messages[0].event).toBe("action");
    expect(body.messages[0].payload.kind).toBe("action");
  });

  it("kural eşleşmezse hiç yayın yapılmaz", async () => {
    const result = await simulateOverSupabase(
      SUPABASE_URL,
      SERVICE_KEY,
      row({ events: [] }),
      gift({ coins: 5 }),
    );

    expect(result.matched).toBe(0);
    expect(result.broadcast).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("HTTP hatası broadcast sayısını artırmaz (best-effort)", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 } as Response);

    const result = await simulateOverSupabase(SUPABASE_URL, SERVICE_KEY, row(), gift({ coins: 5 }));

    expect(result.matched).toBe(1);
    expect(result.broadcast).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
