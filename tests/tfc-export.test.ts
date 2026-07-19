import { describe, expect, it } from "vitest";
import { decodeTfc } from "@/lib/tfc/container";
import {
  buildExportPayload,
  exportTfcFile,
  TFC_COMPAT_VERSION,
  type ExportInput,
} from "@/lib/tfc/export";
import { buildImportPlan } from "@/lib/tfc/import";
import { setupSettingsSchema } from "@/lib/schemas/settings";

/**
 * Dışa aktarma testleri — ADR-0007.
 *
 * En kritik güvence GİDİŞ-DÖNÜŞ (round-trip): dışa aktardığımız dosyayı geri
 * içe aktardığımızda hiçbir ayar kaybolmamalı. Ayrıca dosya TikFinity'nin
 * kendi alan adlandırmasını da taşımalı (geri uyumluluk).
 */

const settings = setupSettingsSchema.parse({
  tiktok: { username: "yayinci" },
  points: { currencyName: "Elmas", pointsPerCoin: 3 },
  subscriberBonus: { bonusRatePercent: 250 },
  levels: { pointsPerLevel: 80, levelMultiplier: 1.5 },
  obs: { ip: "10.0.0.2", port: 4460, password: "gizli" },
  streamerbot: {},
  minecraft: { mode: "servertap", playerName: "Steve" },
  advanced: { useDisplayNames: true, tiktokLanguage: "tr-TR" },
  debug: { debugMode: true },
});

const INPUT: ExportInput = {
  label: "Yayın Profilim",
  exportedAt: "2026-07-19T12:00:00.000Z",
  settings,
  actions: [
    {
      id: "act_1",
      name: "Kalp Yağmuru",
      enabled: true,
      types: ["showAnimation", "playAudio"],
      config: { animationId: "hearts", mediaUrl: "https://cdn.example.com/a.mp3" },
      durationSec: 6,
      pointsDelta: 10,
      screen: 3,
      volume: 75,
      globalCooldownSec: 30,
      userCooldownSec: 5,
      fadeInMs: 300,
      fadeOutMs: 400,
      repeatWithCombos: true,
      skipOnNextAction: false,
      description: "Hediye alınca",
    },
    {
      id: "act_2",
      name: "Komut Yanıtı",
      enabled: false,
      types: ["sendText"],
      config: { chatMessage: "Merhaba {user}" },
      durationSec: 2,
      pointsDelta: -5,
      screen: 1,
      volume: 50,
      globalCooldownSec: 0,
      userCooldownSec: 0,
      fadeInMs: 200,
      fadeOutMs: 200,
      repeatWithCombos: false,
      skipOnNextAction: true,
      description: "",
    },
  ],
  events: [
    {
      id: "evt_1",
      active: true,
      trigger: "gift_min",
      who: "any",
      conditions: { minCoins: 50 },
      actionsAll: ["act_1"],
      actionsRandom: [],
    },
    {
      id: "evt_2",
      active: false,
      trigger: "command",
      who: "subscribers",
      conditions: { command: "!selam" },
      actionsAll: [],
      actionsRandom: ["act_1", "act_2"],
    },
  ],
  timers: [{ id: "tmr_1", active: true, intervalMinutes: 20, actionId: "act_2" }],
  screens: Array.from({ length: 8 }, (_, i) => ({
    screen: i + 1,
    name: i === 0 ? "Ana Ekran" : `Screen ${i + 1}`,
    maxQueueLength: i === 0 ? 30 : 10,
    online: i === 0, // dışa aktarılmamalı — anlık durum
  })),
  widgetSettings: {
    goal: {
      fontFamily: "Bangers",
      fontSize: 44,
      lineHeight: 1.4,
      letterSpacing: 2,
      rtl: false,
      textColor: "#FFCC00",
      backgroundColor: "transparent",
      hue: 0,
      saturation: 100,
      grayscale: 0,
      soundEnabled: true,
      volume: 60,
      displayDurationSec: 8,
    },
  },
};

describe("buildExportPayload — TikFinity uyumluluğu", () => {
  const payload = buildExportPayload(INPUT);

  it("uyumluluk sürümünü ve üreteci beyan eder", () => {
    expect(payload.version).toBe(TFC_COMPAT_VERSION);
    expect(payload.generator).toContain("tfc-export");
    expect(payload.exportedAt).toBe("2026-07-19T12:00:00.000Z");
  });

  it("ayarları TikFinity'nin düz sözlüğüne açar", () => {
    expect(payload.settings).toMatchObject({
      username: "yayinci",
      currencyName: "Elmas",
      pointsPerCoin: 3,
      obsIp: "10.0.0.2",
      obsPort: 4460,
      minecraftMode: "servertap",
      tiktokLanguage: "tr-TR",
      debugMode: true,
    });
  });

  it("etkinliklere sayısal triggerTypeId ekler (3. taraf API kimliği)", () => {
    expect(payload.events[0]).toMatchObject({ trigger: "gift_min", triggerTypeId: 3 });
    expect(payload.events[1]).toMatchObject({ trigger: "command", triggerTypeId: 2 });
  });

  it("eski sürümler için tekil `type` alanını da yazar", () => {
    expect(payload.actions[0]).toMatchObject({
      type: "showAnimation",
      types: ["showAnimation", "playAudio"],
    });
  });

  it("ekranların anlık `online` durumunu dışa aktarmaz", () => {
    expect(payload.screens[0]).toEqual({
      screen: 1,
      name: "Ana Ekran",
      maxQueueLength: 30,
    });
  });

  it("kanonik veriyi `livekit` bloğunda saklar", () => {
    expect(payload.livekit.schema).toBe(1);
    expect(payload.livekit.actions).toHaveLength(2);
    expect(payload.livekit.settings).toEqual(settings);
  });

  it("içe aktarılmış profilde kaynak id'leri geri yazar", () => {
    const withExternal = buildExportPayload({
      ...INPUT,
      externalIds: new Map([["act_1", "tf-orijinal-1"]]),
    });
    expect(withExternal.actions[0].id).toBe("tf-orijinal-1");
    expect(withExternal.events[0].actionsAll).toEqual(["tf-orijinal-1"]);
    expect(withExternal.timers[0].actionId).toBe("act_2"); // haritada yok → korunur
  });
});

describe("gidiş-dönüş (round-trip)", () => {
  const plan = buildImportPlan(buildExportPayload(INPUT));

  it("ayarların tamamı korunur", () => {
    expect(plan.settings).toEqual(settings);
  });

  it("eylemler alan alan korunur (id'ler yeniden üretilir)", () => {
    expect(plan.actions).toHaveLength(2);
    const [first] = plan.actions;
    expect(first).toMatchObject({
      name: "Kalp Yağmuru",
      enabled: true,
      types: ["showAnimation", "playAudio"],
      durationSec: 6,
      pointsDelta: 10,
      screen: 3,
      volume: 75,
      globalCooldownSec: 30,
      userCooldownSec: 5,
      fadeInMs: 300,
      fadeOutMs: 400,
      repeatWithCombos: true,
      description: "Hediye alınca",
    });
    expect(first.config.animationId).toBe("hearts");
  });

  it("etkinlikler ve eylem bağları korunur", () => {
    expect(plan.events).toHaveLength(2);
    const gift = plan.events.find((e) => e.trigger === "gift_min")!;
    const kalp = plan.actions.find((a) => a.name === "Kalp Yağmuru")!;
    expect(gift.conditions.minCoins).toBe(50);
    expect(gift.actionsAll).toEqual([kalp.id]);

    const command = plan.events.find((e) => e.trigger === "command")!;
    expect(command.who).toBe("subscribers");
    expect(command.conditions.command).toBe("!selam");
    expect(command.actionsRandom).toHaveLength(2);
  });

  it("zamanlayıcı, ekran ve widget ayarları korunur", () => {
    expect(plan.timers[0]).toMatchObject({ intervalMinutes: 20, active: true });
    expect(plan.screens[0]).toMatchObject({ name: "Ana Ekran", maxQueueLength: 30 });
    expect(plan.widgetSettings.goal).toEqual(INPUT.widgetSettings.goal);
  });

  it("hiçbir şey atlanmaz ve tanınmayan bölüm uyarısı çıkmaz", () => {
    expect(plan.skipped).toEqual([]);
    expect(plan.warnings.filter((w) => w.code === "unknownSection")).toEqual([]);
  });
});

describe("exportTfcFile", () => {
  it(".tfc dosyası gzip'lidir ve geri çözülebilir", async () => {
    const file = await exportTfcFile(INPUT, "tfc");
    expect(file.filename).toMatch(/\.tfc$/);
    expect(file.mimeType).toBe("application/octet-stream");

    const decoded = await decodeTfc(file.bytes);
    expect(decoded.format).toBe("gzip");
    expect((decoded.value as { profileName: string }).profileName).toBe("Yayın Profilim");
  });

  it(".json dosyası okunabilir düz metindir", async () => {
    const file = await exportTfcFile(INPUT, "json");
    expect(file.filename).toMatch(/\.json$/);
    const decoded = await decodeTfc(file.bytes);
    expect(decoded.format).toBe("json");
  });

  it("dosya adı profil adı ve tarihten türetilir", async () => {
    const file = await exportTfcFile(INPUT, "tfc");
    expect(file.filename).toContain("2026-07-19");
    expect(file.filename).toContain("yayın-profilim");
  });
});
