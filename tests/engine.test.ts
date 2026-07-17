import { describe, expect, it } from "vitest";
import { RuleEngine } from "@/lib/engine";
import { CooldownTracker, EventDeduplicator } from "@/lib/engine/cooldown";
import { matchEvents, matchesCommand, resolveActionIds } from "@/lib/engine/matcher";
import { renderPlaceholders } from "@/lib/engine/placeholders";
import { ScreenQueues } from "@/lib/engine/queue";
import { actionDraftSchema, type Action } from "@/lib/schemas/action";
import { eventSignature, type StreamEvent } from "@/lib/schemas/event";
import type { LiveEvent, LiveUser } from "@/lib/schemas/live";
import { levelForPoints, levelTable } from "@/lib/schemas/points";

/* ------------------------------------------------------------------ fixtures */

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

function liveEvent(overrides: Partial<LiveEvent> = {}): LiveEvent {
  return {
    id: `e${Math.random()}`,
    type: "gift",
    ts: 1000,
    user: user(),
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
    conditions: { minCoins: 5 },
    actionsAll: ["a1"],
    actionsRandom: [],
    ...overrides,
  } as StreamEvent;
}

/* ------------------------------------------------------------------- matcher */

describe("matcher — tetikleyici eşleştirme (PRD §6.2)", () => {
  it("gift_min: min coin eşiğinin altındaki hediye tetiklemez", () => {
    const ev = liveEvent({ coins: 4, repeatEnd: true });
    expect(matchEvents([rule()], ev)).toHaveLength(0);
  });

  it("gift_min: eşiğe eşit veya üstü tetikler", () => {
    expect(matchEvents([rule()], liveEvent({ coins: 5, repeatEnd: true }))).toHaveLength(1);
    expect(matchEvents([rule()], liveEvent({ coins: 500, repeatEnd: true }))).toHaveLength(1);
  });

  it("gift_min: combo sürerken (repeatEnd=false) tetiklemez", () => {
    expect(matchEvents([rule()], liveEvent({ coins: 100, repeatEnd: false }))).toHaveLength(0);
  });

  it("pasif kural hiç eşleşmez", () => {
    const ev = liveEvent({ coins: 100, repeatEnd: true });
    expect(matchEvents([rule({ active: false })], ev)).toHaveLength(0);
  });

  it("olay tipi tetikleyiciyle uyuşmazsa eşleşmez (follow olayı gift kuralını tetiklemez)", () => {
    expect(matchEvents([rule()], liveEvent({ type: "follow" }))).toHaveLength(0);
  });

  it("command: yalnız tam komut eşleşir", () => {
    expect(matchesCommand("!spin şansımı deneyeyim", "!spin")).toBe(true);
    expect(matchesCommand("!SPIN", "!spin")).toBe(true);
    expect(matchesCommand("!spinner", "!spin")).toBe(false);
    expect(matchesCommand("lütfen !spin", "!spin")).toBe(false);
    expect(matchesCommand(undefined, "!spin")).toBe(false);
  });

  it("command: takım seviyesi eşiği uygulanır", () => {
    const r = rule({ trigger: "command", conditions: { command: "!vip", minTeamLevel: 3 } });
    const low = liveEvent({ type: "chat", comment: "!vip", user: user({ teamMemberLevel: 2 }) });
    const high = liveEvent({ type: "chat", comment: "!vip", user: user({ teamMemberLevel: 3 }) });
    expect(matchEvents([r], low)).toHaveLength(0);
    expect(matchEvents([r], high)).toHaveLength(1);
  });

  it("rol filtresi: subscribers yalnız aboneleri geçirir", () => {
    const r = rule({ who: "subscribers" });
    const ev = (isSub: boolean) =>
      liveEvent({ coins: 10, repeatEnd: true, user: user({ isSubscriber: isSub }) });
    expect(matchEvents([r], ev(false))).toHaveLength(0);
    expect(matchEvents([r], ev(true))).toHaveLength(1);
  });

  it("rol filtresi: topgifter yalnız izin verilen sayıdaki top gifter'ı geçirir", () => {
    const r = rule({ who: "topgifter", conditions: { minCoins: 1, topGifterCount: 2 } });
    const ev = liveEvent({ coins: 10, repeatEnd: true, user: user({ userId: "u3" }) });
    expect(matchEvents([r], ev, { topGifterIds: ["u1", "u2", "u3"] })).toHaveLength(0);
    expect(matchEvents([r], ev, { topGifterIds: ["u3", "u1"] })).toHaveLength(1);
  });

  it("rol filtresi: specific_user @ önekinden bağımsız eşleşir", () => {
    const r = rule({ who: "specific_user", conditions: { minCoins: 1, specificUsername: "@ayse_kaya" } });
    expect(matchEvents([r], liveEvent({ coins: 5, repeatEnd: true }))).toHaveLength(1);
  });

  it("first_activity: yalnız ilk aktivitede tetiklenir", () => {
    const r = rule({ trigger: "first_activity", conditions: {} });
    expect(matchEvents([r], liveEvent({ type: "follow", isFirstActivity: true }))).toHaveLength(1);
    expect(matchEvents([r], liveEvent({ type: "follow", isFirstActivity: false }))).toHaveLength(0);
  });

  it("resolveActionIds: 'hepsi' + 'rastgele birini' birleşir", () => {
    const r = rule({ actionsAll: ["a1", "a2"], actionsRandom: ["r1", "r2", "r3"] });
    expect(resolveActionIds(r, () => 1)).toEqual(["a1", "a2", "r2"]);
  });
});

/* ------------------------------------------------------------------ signature */

describe("eventSignature — tekrar tespiti (PRD §5.3)", () => {
  it("koşul sırası imzayı değiştirmez", () => {
    const a = eventSignature({ trigger: "gift_min", who: "any", conditions: { minCoins: 5, giftId: "x" } });
    const b = eventSignature({ trigger: "gift_min", who: "any", conditions: { giftId: "x", minCoins: 5 } });
    expect(a).toBe(b);
  });

  it("farklı rol farklı imza üretir", () => {
    const a = eventSignature({ trigger: "follow", who: "any", conditions: {} });
    const b = eventSignature({ trigger: "follow", who: "subscribers", conditions: {} });
    expect(a).not.toBe(b);
  });
});

/* ------------------------------------------------------------------ cooldown */

describe("CooldownTracker (PRD §6.2)", () => {
  it("global cooldown süresi dolmadan aynı eylem çalışmaz", () => {
    const cd = new CooldownTracker();
    cd.mark("a1", "u1", 1000, { globalSec: 10, userSec: 0 });
    expect(cd.canRun("a1", "u2", 5000).ok).toBe(false);
    expect(cd.canRun("a1", "u2", 11_001).ok).toBe(true);
  });

  it("kullanıcı cooldown'ı yalnız o kullanıcıyı engeller", () => {
    const cd = new CooldownTracker();
    cd.mark("a1", "u1", 1000, { globalSec: 0, userSec: 30 });
    expect(cd.canRun("a1", "u1", 5000).ok).toBe(false);
    expect(cd.canRun("a1", "u2", 5000).ok).toBe(true);
  });

  it("cooldown 0 ise hiç engellemez", () => {
    const cd = new CooldownTracker();
    cd.mark("a1", "u1", 1000, { globalSec: 0, userSec: 0 });
    expect(cd.canRun("a1", "u1", 1001).ok).toBe(true);
  });
});

describe("EventDeduplicator — idempotency (PRD §6.2)", () => {
  it("aynı olay id'si ikinci kez kabul edilmez", () => {
    const dedup = new EventDeduplicator();
    expect(dedup.accept("e1")).toBe(true);
    expect(dedup.accept("e1")).toBe(false);
  });

  it("kapasite dolunca en eski kayıt düşer (bellek sızıntısı yok)", () => {
    const dedup = new EventDeduplicator(2);
    dedup.accept("e1");
    dedup.accept("e2");
    dedup.accept("e3"); // e1 tahliye edilir
    expect(dedup.accept("e1")).toBe(true);
    expect(dedup.accept("e3")).toBe(false);
  });
});

/* -------------------------------------------------------------------- queues */

describe("ScreenQueues — ekran kuyrukları (PRD §6.2)", () => {
  const item = { actionId: "a1", userId: "u1", durationSec: 5, skipOnNextAction: false };

  it("maks uzunluk aşılınca reddeder", () => {
    const q = new ScreenQueues([{ screen: 1, maxQueueLength: 2 }]);
    expect(q.enqueue(item, 1, 0).ok).toBe(true);
    expect(q.enqueue(item, 1, 0).ok).toBe(true);
    const third = q.enqueue(item, 1, 0);
    expect(third.ok).toBe(false);
    expect(third.ok === false && third.reason).toBe("queueFull");
  });

  it("geçersiz ekran numarası reddedilir (1-8)", () => {
    const q = new ScreenQueues();
    expect(q.enqueue(item, 0, 0).ok).toBe(false);
    expect(q.enqueue(item, 9, 0).ok).toBe(false);
  });

  it("ekranlar bağımsız kuyruk tutar", () => {
    const q = new ScreenQueues();
    q.enqueue(item, 1, 0);
    expect(q.length(1)).toBe(1);
    expect(q.length(2)).toBe(0);
  });

  it("offline ekran requireOnline ile reddedilir, heartbeat sonrası kabul edilir", () => {
    const q = new ScreenQueues();
    const res = q.enqueue(item, 1, 0, { requireOnline: true });
    expect(res.ok === false && res.reason).toBe("screenOffline");

    q.heartbeat(1, 1000);
    expect(q.enqueue(item, 1, 1000, { requireOnline: true }).ok).toBe(true);
  });

  it("heartbeat zaman aşımından sonra ekran offline sayılır", () => {
    const q = new ScreenQueues();
    q.heartbeat(1, 0);
    expect(q.isOnline(1, 5000)).toBe(true);
    expect(q.isOnline(1, 20_000)).toBe(false);
  });

  it("FIFO sırası korunur", () => {
    const q = new ScreenQueues();
    q.enqueue({ ...item, actionId: "first" }, 1, 0);
    q.enqueue({ ...item, actionId: "second" }, 1, 0);
    expect(q.dequeue(1)?.actionId).toBe("first");
    expect(q.dequeue(1)?.actionId).toBe("second");
  });

  it("skipOnNextAction: bekleyen atlanabilir öğe yeni öğe gelince düşer", () => {
    const q = new ScreenQueues();
    q.enqueue({ ...item, actionId: "playing" }, 1, 0);
    q.enqueue({ ...item, actionId: "skippable", skipOnNextAction: true }, 1, 0);
    q.enqueue({ ...item, actionId: "newest" }, 1, 0);

    // İlk öğe (oynayan) kalır, atlanabilir bekleyen düşer.
    expect(q.list(1).map((i) => i.actionId)).toEqual(["playing", "newest"]);
  });
});

/* ------------------------------------------------------------- placeholders */

describe("renderPlaceholders (PRD §5.3)", () => {
  it("olay alanlarını yerleştirir", () => {
    const ev = liveEvent({ giftName: "Rose", coins: 1, repeatCount: 3 });
    expect(renderPlaceholders("{username} {giftname} x{repeatcount} = {coins}", { event: ev })).toBe(
      "ayse_kaya Rose x3 = 1",
    );
  });

  it("bilinmeyen placeholder olduğu gibi kalır", () => {
    expect(renderPlaceholders("{username} {bilinmeyen}", { event: liveEvent() })).toBe(
      "ayse_kaya {bilinmeyen}",
    );
  });

  it("büyük/küçük harf duyarsızdır", () => {
    expect(renderPlaceholders("{USERNAME}", { event: liveEvent() })).toBe("ayse_kaya");
  });

  it("puan/seviye bağlamı yerleşir", () => {
    expect(renderPlaceholders("{points} {currencyname} · Lv{level}", { points: 120, currencyName: "Puan", level: 3 })).toBe(
      "120 Puan · Lv3",
    );
  });
});

/* -------------------------------------------------------------- RuleEngine */

describe("RuleEngine — uçtan uca sevk (PRD §6.1)", () => {
  function engine(actions: Action[], rules: StreamEvent[], opts = {}) {
    return new RuleEngine({
      getActions: () => actions,
      getEvents: () => rules,
      now: () => 1000,
      pickRandom: () => 0,
      ...opts,
    });
  }

  it("eşleşen olay eylemi kuyruğa alır", () => {
    const e = engine([action()], [rule()]);
    const res = e.dispatch(liveEvent({ coins: 10, repeatEnd: true }));

    expect(res.duplicate).toBe(false);
    expect(res.matchedRules).toHaveLength(1);
    expect(res.outcomes[0].status).toBe("queued");
    expect(e.queues.length(1)).toBe(1);
  });

  it("tekrar eden olay yutulur ve kuyruğa iki kez düşmez", () => {
    const e = engine([action()], [rule()]);
    const ev = liveEvent({ id: "same", coins: 10, repeatEnd: true });

    e.dispatch(ev);
    const second = e.dispatch(ev);

    expect(second.duplicate).toBe(true);
    expect(e.queues.length(1)).toBe(1);
  });

  it("devre dışı eylem kuyruğa girmez", () => {
    const e = engine([action({ enabled: false })], [rule()]);
    const res = e.dispatch(liveEvent({ coins: 10, repeatEnd: true }));

    expect(res.outcomes[0].status).toBe("disabled");
    expect(e.queues.length(1)).toBe(0);
  });

  it("cooldown içindeki eylem tekrar kuyruğa girmez", () => {
    const e = engine([action({ globalCooldownSec: 60 })], [rule()]);
    e.dispatch(liveEvent({ coins: 10, repeatEnd: true }));
    const second = e.dispatch(liveEvent({ coins: 10, repeatEnd: true }));

    expect(second.outcomes[0].status).toBe("cooldown");
    expect(e.queues.length(1)).toBe(1);
  });

  it("repeatWithCombos: combo sayısı kadar kuyruğa eklenir", () => {
    const e = engine([action({ repeatWithCombos: true })], [rule()]);
    e.dispatch(liveEvent({ coins: 10, repeatCount: 3, repeatEnd: true }));
    expect(e.queues.length(1)).toBe(3);
  });

  it("repeatWithCombos kapalıyken combo tek kez işlenir", () => {
    const e = engine([action({ repeatWithCombos: false })], [rule()]);
    e.dispatch(liveEvent({ coins: 10, repeatCount: 5, repeatEnd: true }));
    expect(e.queues.length(1)).toBe(1);
  });

  it("kuyruk dolduğunda 'rejected' döner (Screen queue is full!)", () => {
    const e = new RuleEngine(
      { getActions: () => [action()], getEvents: () => [rule()], now: () => 1000 },
      [{ screen: 1, maxQueueLength: 1 }],
    );

    e.dispatch(liveEvent({ id: "e1", coins: 10, repeatEnd: true }));
    const second = e.dispatch(liveEvent({ id: "e2", coins: 10, repeatEnd: true }));

    expect(second.outcomes[0].status).toBe("rejected");
    expect(second.outcomes[0].status === "rejected" && second.outcomes[0].reason).toBe("queueFull");
  });

  it("eylem kendi ekranının kuyruğuna gider", () => {
    const e = engine([action({ screen: 5 })], [rule()]);
    e.dispatch(liveEvent({ coins: 10, repeatEnd: true }));

    expect(e.queues.length(5)).toBe(1);
    expect(e.queues.length(1)).toBe(0);
  });
});

/* ------------------------------------------------------------------- points */

describe("Seviye hesabı (PRD §5.2)", () => {
  it("0 puan = seviye 0", () => {
    expect(levelForPoints(0, 50, 1.2)).toBe(0);
  });

  it("üstel eğri: çarpan arttıkça seviye zorlaşır", () => {
    expect(levelForPoints(50, 50, 1.2)).toBe(1);
    expect(levelForPoints(49, 50, 1.2)).toBe(0);
    expect(levelForPoints(1000, 50, 1.2)).toBeLessThan(levelForPoints(1000, 50, 1.0));
  });

  it("seviye tablosu kümülatif toplamı doğru üretir", () => {
    const rows = levelTable(50, 1.0, 3);
    expect(rows.map((r) => r.cumulative)).toEqual([50, 100, 150]);
  });

  it("puanlar tamsayıdır (float yasak — PRD §7)", () => {
    for (const row of levelTable(50, 1.2, 10)) {
      expect(Number.isInteger(row.required)).toBe(true);
      expect(Number.isInteger(row.cumulative)).toBe(true);
    }
  });
});
