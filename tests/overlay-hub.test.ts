// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  __reset,
  __setUpstreamFactory,
  __upstreamRefCount,
  getOnlineScreens,
  injectSynthetic,
  subscribe,
  upsertOverlay,
  type OverlayConfig,
} from "@/lib/server/overlay-hub";
import { actionDraftSchema, type Action } from "@/lib/schemas/action";
import type { StreamEvent } from "@/lib/schemas/event";
import type { LiveEvent, LiveUser } from "@/lib/schemas/live";
import type { WidgetInbound } from "@/lib/schemas/widget";

/* ------------------------------------------------------------------ fixtures */

const OID_A = "11111111-1111-4111-8111-111111111111";
const OID_B = "22222222-2222-4222-8222-222222222222";

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

function config(overrides: Partial<OverlayConfig> = {}): OverlayConfig {
  return {
    id: OID_A,
    username: "",
    actions: [action()],
    events: [rule()],
    timers: [],
    screens: [{ screen: 1, maxQueueLength: 10 }],
    ...overrides,
  };
}

/** Yalnız "action" mesajlarını topla (heartbeat vb. hariç). */
function actionMsgs(fn: ReturnType<typeof vi.fn>): Array<WidgetInbound & { kind: "action" }> {
  return fn.mock.calls
    .map((c) => c[0] as WidgetInbound)
    .filter((m): m is WidgetInbound & { kind: "action" } => m.kind === "action");
}

beforeEach(() => {
  __reset();
});

/* --------------------------------------------------------------------- tests */

describe("overlay-hub — register → gift → push (ADR-0002)", () => {
  it("eşleşen action doğru ekranın abonesine 'action' olarak push edilir", () => {
    upsertOverlay(
      config({
        actions: [
          action({
            id: "a1",
            types: ["showText", "showAnimation"],
            config: { text: "Selam {username}", animationId: "confetti" },
            durationSec: 7,
            screen: 1,
          }),
        ],
      }),
    );

    const send = vi.fn();
    subscribe(OID_A, 1, send);

    const res = injectSynthetic(OID_A, gift({ coins: 5 }));

    expect(res?.matchedRules).toHaveLength(1);
    const msgs = actionMsgs(send);
    expect(msgs).toHaveLength(1);
    expect(msgs[0].payload.types).toContain("showText");
    // Placeholder sunucuda ikame edilir.
    expect(msgs[0].payload.text).toBe("Selam ayse_kaya");
    expect(msgs[0].payload.animationId).toBe("confetti");
    expect(msgs[0].payload.durationSec).toBe(7);
  });

  it("ekran yönlendirme: action.screen=1 iken screen=2 abonesi mesaj almaz", () => {
    upsertOverlay(
      config({
        actions: [action({ id: "a1", screen: 1 })],
        screens: [
          { screen: 1, maxQueueLength: 10 },
          { screen: 2, maxQueueLength: 10 },
        ],
      }),
    );

    const s1 = vi.fn();
    const s2 = vi.fn();
    subscribe(OID_A, 1, s1);
    subscribe(OID_A, 2, s2);

    injectSynthetic(OID_A, gift({ coins: 5 }));

    expect(actionMsgs(s1)).toHaveLength(1);
    expect(actionMsgs(s2)).toHaveLength(0);
  });

  it("cooldown: globalCooldownSec içindeki ikinci hediye push edilmez", () => {
    upsertOverlay(
      config({ actions: [action({ id: "a1", globalCooldownSec: 60, screen: 1 })] }),
    );

    const send = vi.fn();
    subscribe(OID_A, 1, send);

    injectSynthetic(OID_A, gift({ coins: 5 }));
    injectSynthetic(OID_A, gift({ coins: 5 })); // farklı id, cooldown içinde

    expect(actionMsgs(send)).toHaveLength(1);
  });

  it("gift streak: repeatEnd=false push etmez; repeatEnd=true + repeatWithCombos combo kadar push eder", () => {
    upsertOverlay(
      config({
        actions: [action({ id: "a1", repeatWithCombos: true, screen: 1 })],
        events: [rule({ conditions: { minCoins: 5 } })],
      }),
    );

    const send = vi.fn();
    subscribe(OID_A, 1, send);

    // Combo sürerken tetiklenmez.
    injectSynthetic(OID_A, gift({ coins: 5, repeatEnd: false }));
    expect(actionMsgs(send)).toHaveLength(0);

    // Combo bitince repeatCount kadar (5) push.
    injectSynthetic(OID_A, gift({ coins: 5, repeatEnd: true, repeatCount: 5 }));
    expect(actionMsgs(send)).toHaveLength(5);
  });

  it("kayıtlı olmayan id'ye enjeksiyon null döner", () => {
    expect(injectSynthetic("yok", gift())).toBeNull();
  });
});

describe("overlay-hub — getOnlineScreens (canlı ekran durumu)", () => {
  it("abone olan ekranları sıralı döner; unsubscribe sonrası düşer", () => {
    upsertOverlay(
      config({
        screens: [
          { screen: 1, maxQueueLength: 10 },
          { screen: 2, maxQueueLength: 10 },
        ],
      }),
    );
    expect(getOnlineScreens(OID_A)).toEqual([]);

    const unsub1 = subscribe(OID_A, 1, vi.fn());
    subscribe(OID_A, 2, vi.fn());
    expect(getOnlineScreens(OID_A)).toEqual([1, 2]);

    unsub1();
    expect(getOnlineScreens(OID_A)).toEqual([2]);
  });

  it("aynı ekrana iki abone tekilleştirilir; ikisi de kopunca ekran düşer", () => {
    upsertOverlay(config());
    const u1 = subscribe(OID_A, 1, vi.fn());
    const u2 = subscribe(OID_A, 1, vi.fn());
    expect(getOnlineScreens(OID_A)).toEqual([1]);

    u1();
    expect(getOnlineScreens(OID_A)).toEqual([1]); // hâlâ bir abone var
    u2();
    expect(getOnlineScreens(OID_A)).toEqual([]);
  });

  it("kayıtlı olmayan id boş dizi döner", () => {
    expect(getOnlineScreens("yok")).toEqual([]);
  });
});

describe("overlay-hub — upstream ref-count (25-WS limiti koruması)", () => {
  it("aynı username için tek upstream açılır, ikisi de kapanınca close çağrılır", () => {
    let connects = 0;
    const closed: string[] = [];
    __setUpstreamFactory((username) => {
      connects += 1;
      return { close: () => closed.push(username) };
    });

    upsertOverlay(config({ id: OID_A, username: "streamer" }));
    upsertOverlay(config({ id: OID_B, username: "streamer" }));

    const unsubA = subscribe(OID_A, 1, vi.fn());
    const unsubB = subscribe(OID_B, 1, vi.fn());

    expect(connects).toBe(1); // paylaşılan username → tek WS
    expect(__upstreamRefCount("streamer")).toBe(2);

    unsubA();
    expect(__upstreamRefCount("streamer")).toBe(1);
    expect(closed).toHaveLength(0);

    unsubB();
    expect(__upstreamRefCount("streamer")).toBe(0);
    expect(closed).toEqual(["streamer"]);
  });

  it("bağlı upstream'e gelen olay tüm ilgili overlay'lere yönlenir", () => {
    let emit: ((ev: LiveEvent) => void) | null = null;
    __setUpstreamFactory((_username, onEvent) => {
      emit = onEvent;
      return { close: () => {} };
    });

    upsertOverlay(config({ id: OID_A, username: "streamer" }));
    const send = vi.fn();
    subscribe(OID_A, 1, send);

    expect(emit).not.toBeNull();
    emit!(gift({ coins: 5 }));

    expect(actionMsgs(send)).toHaveLength(1);
  });
});

describe("overlay-hub — timer (ADR-0005)", () => {
  it("abone bağlıyken zamanlayıcı eylemi ilgili ekrana push eder", () => {
    vi.useFakeTimers();
    try {
      const send = vi.fn();
      // action a1 → screen 1; timer ~6 sn (test: ekran heartbeat penceresi içinde).
      // Gerçek şemada aralık dakika (min 1) ama runner int'e bakmaz; burada hızlı test.
      upsertOverlay(
        config({
          actions: [
            action({
              id: "a1",
              types: ["showText"],
              config: { text: "Instagram'ı takip et!" },
              screen: 1,
            }),
          ],
          events: [],
          timers: [{ id: "tm1", active: true, intervalMinutes: 0.1, actionId: "a1" }],
        }),
      );

      // Abone yokken timer çalışmaz (canlılık = abone).
      vi.advanceTimersByTime(7_000);
      expect(actionMsgs(send)).toHaveLength(0);

      const unsub = subscribe(OID_A, 1, send); // ekran online + runner start
      vi.advanceTimersByTime(7_000); // ~1 aralık, heartbeat penceresi (10 sn) içinde

      const msgs = actionMsgs(send);
      expect(msgs).toHaveLength(1);
      expect(msgs[0].payload.text).toBe("Instagram'ı takip et!");

      unsub(); // son abone gitti → canlılık bitti → runner stop
      vi.advanceTimersByTime(60_000);
      expect(actionMsgs(send)).toHaveLength(1); // durunca yeni push yok
    } finally {
      vi.useRealTimers();
    }
  });
});
