import { describe, expect, it } from "vitest";
import { buildImportPlan } from "@/lib/tfc/import";
import { resolveActionType } from "@/lib/tfc/map-actions";
import { resolveTrigger, resolveWho, TRIGGER_BY_THIRD_PARTY_ID } from "@/lib/tfc/map-events";
import { countPlan } from "@/lib/tfc/types";

/**
 * Haritalama testleri — ADR-0007.
 *
 * `.tfc` şeması belgelenmemiş; bu testler haritalamanın SÜRÜM VARYANTLARINA
 * dayanıklı olduğunu doğrular (aynı bilgi farklı alan adı/tip ile yazılabilir)
 * ve bozuk kayıtların dosyanın tamamını düşürmediğini garanti eder.
 */

/** Gerçekçi bir TikFinity export'u — alanlar kasıtlı olarak karışık biçimde. */
const SAMPLE = {
  version: "1.70.1",
  profileName: "Yayın Profilim",
  actions: [
    {
      // Kanonik biçim
      id: "act-1",
      name: "Kalp Yağmuru",
      type: "showAnimation",
      duration: 6,
      volume: 80,
      screen: 2,
      cooldown: 30,
      animationId: "hearts",
      description: "Hediye gelince kalpler",
    },
    {
      // Eş anlamlı tip + string sayı + ms süre + iç içe config
      id: "act-2",
      name: "Teşekkür TTS",
      type: "tts",
      config: { ttsText: "Teşekkürler {user}", voice: "tr-TR-Standard-A", rate: "1.2" },
      durationMs: 4000,
      fadeIn: 0.5,
      enabled: "false",
    },
    {
      // Boolean bayrak gösterimi + çoklu tip
      id: "act-3",
      name: "Ses + Yazı",
      playAudio: true,
      showText: true,
      text: "Hoş geldin!",
      color: "#f0a",
      mediaUrl: "https://cdn.example.com/ses.mp3",
      points: 25,
    },
    {
      // Tanınmayan tip → uyarı, eylem yine de alınır (tip düşürülür)
      id: "act-4",
      name: "Karışık",
      types: ["showText", "quantumTeleport"],
      text: "Selam",
    },
    // Bozuk kayıtlar
    { id: "act-5", type: "showText" }, // adsız → atlanır
    { id: "act-6", name: "Tipsiz" }, // tanınan tip yok → atlanır
    { id: "act-7", name: "Kalp Yağmuru", type: "showText" }, // ad tekrarı → yeniden adlandırılır
  ],
  events: [
    // Sayısal triggerTypeId (3 = gift_min)
    { id: "ev-1", triggerTypeId: 3, minCoins: 10, actions: ["act-1"], who: 0 },
    // String tetikleyici + komut ön eki eksik → "!" eklenir
    { id: "ev-2", trigger: "command", command: "merhaba", actions: ["act-2"], who: "subscribers" },
    // Eylemi ADIYLA işaret ediyor
    { id: "ev-3", triggerTypeId: 9, actionsAll: [{ name: "Ses + Yazı" }] },
    // Random havuz + "share" eş anlamlısı (→ invite)
    { id: "ev-4", trigger: "share", actionsRandom: ["act-1", "act-3"] },
    // Bozuklar
    { id: "ev-5", triggerTypeId: 999, actions: ["act-1"] }, // tanınmayan tetikleyici
    { id: "ev-6", trigger: "gift_min", actions: ["act-1"] }, // zorunlu koşul (minCoins) yok
    { id: "ev-7", trigger: "chat", actions: ["yok-boyle-bir-id"] }, // referans çözülemez
    { id: "ev-8", triggerTypeId: 3, minCoins: 10, actions: ["act-2"], who: 0 }, // ev-1 ile aynı imza
  ],
  timers: [
    { id: "tm-1", interval: 15, actionId: "act-1" },
    { id: "tm-2", intervalSeconds: 300, actionId: "Teşekkür TTS" },
    { id: "tm-3", interval: 5, actionId: "olmayan" }, // atlanır
  ],
  screens: [
    { screen: 1, name: "Ana Ekran", maxQueueLength: 25 },
    { screen: 99, name: "Hatalı" }, // aralık dışı → uyarı
  ],
  widgets: {
    goal: { fontFamily: "Bangers", fontSize: 48, textColor: "#FFCC00" },
    activityFeed: { fontSize: 9999 }, // kırpılır
    kayipWidget: { fontSize: 20 }, // tanınmaz
  },
  settings: {
    currencyName: "Elmas",
    pointsPerCoin: 2,
    obsIp: "192.168.1.50",
    obsPort: "4455",
    subscriberBonus: 150,
    minecraftMode: "ServerTap",
    debugMode: 1,
    username: "@yayinci",
  },
  bilinmeyenBolum: { a: 1 },
};

describe("buildImportPlan — temel akış", () => {
  const plan = buildImportPlan(SAMPLE, { fileName: "yedek.tfc" });

  it("içe aktarma adını ve sürümü dosyadan alır", () => {
    expect(plan.label).toBe("Yayın Profilim");
    expect(plan.sourceVersion).toBe("1.70.1");
  });

  it("kütüphanede var olan adlara karşı da tekilleştirir", () => {
    const withExisting = buildImportPlan(SAMPLE, {
      existingActionNames: ["Teşekkür TTS"],
    });
    const names = withExisting.actions.map((a) => a.name);
    expect(names).toContain("Teşekkür TTS (2)");
    expect(names).not.toContain("Teşekkür TTS");
  });

  it("geçerli eylemleri alır, bozukları atlar", () => {
    // act-1..4 + act-7 (yeniden adlandırılmış) = 5; act-5 ve act-6 atlanır.
    expect(plan.actions).toHaveLength(5);
    expect(plan.skipped.filter((i) => i.scope === "action")).toHaveLength(2);
  });

  it("tekrar eden eylem adını yeniden adlandırır", () => {
    const names = plan.actions.map((a) => a.name);
    expect(names).toContain("Kalp Yağmuru");
    expect(names).toContain("Kalp Yağmuru (2)");
    expect(plan.warnings.some((i) => i.code === "duplicateName")).toBe(true);
  });

  it("tanınmayan eylem tipini düşürür ama eylemi korur", () => {
    const mixed = plan.actions.find((a) => a.name === "Karışık");
    expect(mixed?.types).toEqual(["showText"]);
    expect(
      plan.warnings.some(
        (i) => i.code === "unknownActionType" && i.detail === "quantumTeleport",
      ),
    ).toBe(true);
  });

  it("dosyada tanınmayan üst düzey bölümü raporlar", () => {
    expect(
      plan.warnings.some(
        (i) => i.code === "unknownSection" && i.ref === "bilinmeyenbolum",
      ),
    ).toBe(true);
  });
});

describe("eylem alan varyantları", () => {
  const plan = buildImportPlan(SAMPLE);
  const byName = (name: string) => plan.actions.find((a) => a.name === name)!;

  it("milisaniye süreyi saniyeye çevirir", () => {
    expect(byName("Teşekkür TTS").durationSec).toBe(4);
  });

  it("saniye cinsinden fade değerini milisaniyeye çevirir", () => {
    expect(byName("Teşekkür TTS").fadeInMs).toBe(500);
  });

  it("string boolean'ı çözer", () => {
    expect(byName("Teşekkür TTS").enabled).toBe(false);
  });

  it("iç içe config'ten TTS alanlarını okur", () => {
    const config = byName("Teşekkür TTS").config;
    expect(config.ttsText).toBe("Teşekkürler {user}");
    expect(config.ttsVoice).toBe("tr-TR-Standard-A");
    expect(config.ttsRate).toBe(1.2);
  });

  it("boolean bayraklardan çoklu tip çıkarır", () => {
    expect(byName("Ses + Yazı").types.sort()).toEqual(["playAudio", "showText"]);
  });

  it("3 haneli hex rengi 6 haneye genişletir", () => {
    expect(byName("Ses + Yazı").config.textColor).toBe("#FF00AA");
  });

  it("cooldown ve ekran alanlarını taşır", () => {
    const action = byName("Kalp Yağmuru");
    expect(action.globalCooldownSec).toBe(30);
    expect(action.screen).toBe(2);
    expect(action.config.animationId).toBe("hearts");
  });
});

describe("etkinlik haritalama", () => {
  const plan = buildImportPlan(SAMPLE);

  it("geçerli etkinlikleri alır, bozukları atlar", () => {
    // ev-1..4 geçerli; ev-5..8 atlanır.
    expect(plan.events).toHaveLength(4);
  });

  it("sayısal triggerTypeId'yi enum'a çevirir", () => {
    const gift = plan.events.find((e) => e.trigger === "gift_min");
    expect(gift?.conditions.minCoins).toBe(10);
    expect(gift?.who).toBe("any");
  });

  it("komuta eksik '!' ön ekini ekler", () => {
    const command = plan.events.find((e) => e.trigger === "command");
    expect(command?.conditions.command).toBe("!merhaba");
    expect(command?.who).toBe("subscribers");
  });

  it("eylem referansını ADA göre çözebilir", () => {
    const follow = plan.events.find((e) => e.trigger === "follow");
    const target = plan.actions.find((a) => a.name === "Ses + Yazı");
    expect(follow?.actionsAll).toEqual([target?.id]);
  });

  it("rastgele eylem havuzunu ayrı alanda tutar", () => {
    const share = plan.events.find((e) => e.trigger === "invite");
    expect(share?.actionsRandom).toHaveLength(2);
    expect(share?.actionsAll).toHaveLength(0);
  });

  it("eylem id'lerini YENİDEN YAZAR — kaynak id'ler sızmaz", () => {
    const allRefs = plan.events.flatMap((e) => [...e.actionsAll, ...e.actionsRandom]);
    const ourIds = new Set(plan.actions.map((a) => a.id));
    expect(allRefs.every((ref) => ourIds.has(ref))).toBe(true);
    expect(allRefs.some((ref) => ref.startsWith("act-"))).toBe(false);
  });

  it("her atlanan etkinlik için gerekçe kaydeder", () => {
    const codes = plan.skipped.filter((i) => i.scope === "event").map((i) => i.code);
    expect(codes).toContain("unknownTrigger");
    expect(codes).toContain("missingCondition");
    expect(codes).toContain("noLinkedActions");
    expect(codes).toContain("duplicateEvent");
  });
});

describe("zamanlayıcı haritalama", () => {
  const plan = buildImportPlan(SAMPLE);

  it("dakika ve saniye cinsinden aralıkları normalize eder", () => {
    expect(plan.timers).toHaveLength(2);
    expect(plan.timers.map((t) => t.intervalMinutes).sort((a, b) => a - b)).toEqual([5, 15]);
  });

  it("çözülemeyen eylem referanslı zamanlayıcıyı atlar", () => {
    expect(
      plan.skipped.some((i) => i.scope === "timer" && i.code === "unresolvedActionRef"),
    ).toBe(true);
  });
});

describe("ekran ve widget haritalama", () => {
  const plan = buildImportPlan(SAMPLE);

  it("her zaman 8 ekran döner, eksikleri varsayılanla tamamlar", () => {
    expect(plan.screens).toHaveLength(8);
    expect(plan.screens[0]).toMatchObject({ screen: 1, name: "Ana Ekran", maxQueueLength: 25 });
    expect(plan.screens[7]).toMatchObject({ screen: 8, maxQueueLength: 10 });
  });

  it("aralık dışı ekranı raporlar", () => {
    expect(plan.warnings.some((i) => i.code === "screenOutOfRange")).toBe(true);
  });

  it("widget adlarını çözer ve değerleri kırpar", () => {
    expect(plan.widgetSettings.goal?.fontFamily).toBe("Bangers");
    expect(plan.widgetSettings["activity-feed"]?.fontSize).toBe(200);
    expect(plan.warnings.some((i) => i.code === "unknownWidget" && i.ref === "kayipWidget")).toBe(true);
  });
});

describe("kurulum ayarları haritalama", () => {
  const plan = buildImportPlan(SAMPLE);

  it("düz sözlüğü bölümlere dağıtır", () => {
    expect(plan.settings.points.currencyName).toBe("Elmas");
    expect(plan.settings.points.pointsPerCoin).toBe(2);
    expect(plan.settings.obs.ip).toBe("192.168.1.50");
    expect(plan.settings.obs.port).toBe(4455); // string "4455" → sayı
    expect(plan.settings.subscriberBonus.bonusRatePercent).toBe(150);
    expect(plan.settings.minecraft.mode).toBe("servertap");
    expect(plan.settings.debug.debugMode).toBe(true); // 1 → true
  });

  it("kullanıcı adından '@' işaretini atar", () => {
    expect(plan.settings.tiktok.username).toBe("yayinci");
  });

  it("eksik alanlarda şema varsayılanlarına düşer", () => {
    const bare = buildImportPlan({ actions: [] });
    expect(bare.settings.points.pointsPerCoin).toBe(1);
    expect(bare.settings.obs.port).toBe(4455);
  });
});

describe("dayanıklılık", () => {
  it("boş nesnede çökmez", () => {
    const plan = buildImportPlan({});
    expect(countPlan(plan)).toMatchObject({ actions: 0, events: 0, screens: 8 });
  });

  it("dizi verilirse hata raporlar, plan yine de döner", () => {
    const plan = buildImportPlan([1, 2, 3]);
    expect(plan.skipped.some((i) => i.scope === "file")).toBe(true);
    expect(plan.actions).toHaveLength(0);
  });

  it("null verilirse çökmez", () => {
    expect(() => buildImportPlan(null)).not.toThrow();
  });
});

describe("çözümleyici sözlükler", () => {
  it("3. taraf trigger id haritası ters çevrilmiş", () => {
    expect(TRIGGER_BY_THIRD_PARTY_ID.get(3)).toBe("gift_min");
    expect(TRIGGER_BY_THIRD_PARTY_ID.get(11)).toBe("chat");
    expect(TRIGGER_BY_THIRD_PARTY_ID.get(1)).toBe("invite");
  });

  it("eylem tipi eş anlamlıları çözülür", () => {
    expect(resolveActionType("TTS")).toBe("speakText");
    expect(resolveActionType("play_audio")).toBe("playAudio");
    expect(resolveActionType("showText")).toBe("showText");
    expect(resolveActionType("bilinmeyen")).toBeUndefined();
  });

  it("tetikleyici ve rol eş anlamlıları çözülür", () => {
    expect(resolveTrigger("share")).toBe("invite");
    expect(resolveTrigger("Gift_Specific")).toBe("gift_specific");
    expect(resolveTrigger(10)).toBe("subscribe");
    expect(resolveWho("mods")).toBe("moderators");
    expect(resolveWho(4)).toBe("topgifter");
  });
});
