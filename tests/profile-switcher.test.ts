import { describe, expect, it } from "vitest";
import { matchProfile, resolveSwitch } from "@/lib/engine/profile-switcher";
import {
  autoSwitchStateSchema,
  defaultStreamProfiles,
  draftForGame,
  gameSignalSchema,
  streamProfileSchema,
  type AutoSwitchState,
  type GameId,
  type GameSignal,
  type StreamProfile,
} from "@/lib/schemas/stream-profile";

/* ------------------------------------------------------------------ fixtures */

const PROFILES = defaultStreamProfiles();

function profileFor(gameId: GameId): StreamProfile {
  const found = PROFILES.find((p) => p.autoSwitch.gameId === gameId);
  if (!found) throw new Error(`fixture eksik: ${gameId}`);
  return found;
}

function signal(overrides: Partial<GameSignal> = {}): GameSignal {
  return gameSignalSchema.parse({ ts: 1000, ...overrides });
}

function autoState(overrides: Partial<AutoSwitchState> = {}): AutoSwitchState {
  return autoSwitchStateSchema.parse(overrides);
}

/** Varsayılan bağlam: dwell dolmuş, askı yok, otomatik geçiş açık. */
function ctx(overrides: Partial<Parameters<typeof resolveSwitch>[0]> = {}) {
  return {
    profiles: PROFILES,
    activeProfileId: profileFor("just-chatting").id,
    signal: signal(),
    state: autoState(),
    lastSwitchAt: 0,
    now: 10_000_000,
    ...overrides,
  };
}

/* ------------------------------------------------------------------ katalog */

describe("varsayılan profiller", () => {
  it("10 profil üretir ve her biri ayrı oyuna bağlıdır", () => {
    expect(PROFILES).toHaveLength(10);
    const games = new Set(PROFILES.map((p) => p.autoSwitch.gameId));
    expect(games.size).toBe(10);
  });

  it("oyun başına ayar setleri gerçekten farklıdır", () => {
    // Rekabetçi FPS'te TTS kapalı, sohbet yayınında açık (PRD §5.2 mantığı).
    expect(profileFor("cs2").settings.ttsEnabled).toBe(false);
    expect(profileFor("just-chatting").settings.ttsEnabled).toBe(true);
    expect(profileFor("minecraft").settings.pointsMultiplierPercent).toBe(150);
    expect(profileFor("cs2").settings.cooldownSeconds).toBeGreaterThan(
      profileFor("minecraft").settings.cooldownSeconds,
    );
  });

  it("her profil ayrı bir overlay ekranı almaz zorunda değil ama şema sınırında kalır", () => {
    for (const p of PROFILES) {
      expect(p.settings.overlayScreen).toBeGreaterThanOrEqual(1);
      expect(p.settings.overlayScreen).toBeLessThanOrEqual(8);
    }
  });

  it("draftForGame bağlı oyunun varsayılanlarıyla taslak üretir", () => {
    const draft = draftForGame("valorant");
    expect(draft.autoSwitch.gameId).toBe("valorant");
    expect(draft.settings.ttsEnabled).toBe(false);

    const blank = draftForGame(null);
    expect(blank.autoSwitch.gameId).toBeNull();
    expect(blank.autoSwitch.enabled).toBe(false);
  });
});

/* ------------------------------------------------------------------ eşleşme */

describe("matchProfile", () => {
  it("gameId birebir eşleşmesi en güçlü sinyaldir", () => {
    const match = matchProfile(PROFILES, signal({ gameId: "valorant", title: "minecraft" }));
    expect(match?.matchedBy).toBe("gameId");
    expect(match?.profile.id).toBe(profileFor("valorant").id);
  });

  it("gameId yoksa başlıktaki kelimeden bulur", () => {
    const match = matchProfile(PROFILES, signal({ title: "Bugün Minecraft oynuyoruz!" }));
    expect(match?.matchedBy).toBe("keyword");
    expect(match?.profile.id).toBe(profileFor("minecraft").id);
  });

  it("büyük harf, Türkçe ek ve aksan eşleşmeyi bozmaz", () => {
    expect(matchProfile(PROFILES, signal({ title: "FREE FIRE turnuva" }))?.profile.id).toBe(
      profileFor("free-fire").id,
    );
    expect(matchProfile(PROFILES, signal({ title: "PUBG'İ bırakmıyoruz" }))?.profile.id).toBe(
      profileFor("pubg-mobile").id,
    );
    expect(matchProfile(PROFILES, signal({ title: "Bol SOHBET akşamı" }))?.profile.id).toBe(
      profileFor("just-chatting").id,
    );
  });

  it("kısa kısaltmalar kelime sınırı olmadan eşleşmez", () => {
    // "ff" Free Fire kelimesidir ama "offline" içinde geçmemeli.
    expect(matchProfile(PROFILES, signal({ title: "offline moddayız" }))).toBeNull();
    // Tek başına yazıldığında eşleşir.
    expect(matchProfile(PROFILES, signal({ title: "ff oynuyoruz" }))?.profile.id).toBe(
      profileFor("free-fire").id,
    );
  });

  it("kullanıcının eklediği kelimeler de aranır", () => {
    const custom = streamProfileSchema.parse({
      ...draftForGame(null),
      id: "prf_custom",
      autoSwitch: { enabled: true, gameId: null, keywords: ["kutu açılımı"] },
    });
    const match = matchProfile([...PROFILES, custom], signal({ title: "Dev kutu açılımı" }));
    expect(match?.profile.id).toBe("prf_custom");
  });

  it("otomatik geçişe kapalı profil aday olmaz", () => {
    const closed = PROFILES.map((p) =>
      p.autoSwitch.gameId === "minecraft"
        ? { ...p, autoSwitch: { ...p.autoSwitch, enabled: false } }
        : p,
    );
    expect(matchProfile(closed, signal({ gameId: "minecraft" }))).toBeNull();
  });

  it("eşleşme yoksa null döner", () => {
    expect(matchProfile(PROFILES, signal({ title: "kahve içiyoruz" }))).toBeNull();
    expect(matchProfile(PROFILES, signal({ title: "" }))).toBeNull();
  });
});

/* ------------------------------------------------------------------ karar */

describe("resolveSwitch", () => {
  it("eşleşen profile geçer", () => {
    const decision = resolveSwitch(ctx({ signal: signal({ gameId: "cs2" }) }));
    expect(decision).toEqual({
      switched: true,
      profileId: profileFor("cs2").id,
      matchedBy: "gameId",
    });
  });

  it("ana anahtar kapalıysa geçmez", () => {
    const decision = resolveSwitch(
      ctx({ signal: signal({ gameId: "cs2" }), state: autoState({ enabled: false }) }),
    );
    expect(decision).toEqual({ switched: false, reason: "disabled" });
  });

  it("elle seçim askısı sürerken geçmez", () => {
    const decision = resolveSwitch(
      ctx({
        signal: signal({ gameId: "cs2" }),
        state: autoState({ manualHoldUntil: 10_000_001 }),
        now: 10_000_000,
      }),
    );
    expect(decision).toEqual({ switched: false, reason: "manualHold" });
  });

  it("askı dolduğunda yeniden geçer", () => {
    const decision = resolveSwitch(
      ctx({
        signal: signal({ gameId: "cs2" }),
        state: autoState({ manualHoldUntil: 9_999_999 }),
        now: 10_000_000,
      }),
    );
    expect(decision.switched).toBe(true);
  });

  it("hedef zaten aktifse geçmez", () => {
    const decision = resolveSwitch(
      ctx({
        signal: signal({ gameId: "just-chatting" }),
        activeProfileId: profileFor("just-chatting").id,
      }),
    );
    expect(decision).toEqual({ switched: false, reason: "alreadyActive" });
  });

  it("asgari kalma süresi dolmadan geçmez (flapping kalkanı)", () => {
    const now = 10_000_000;
    const decision = resolveSwitch(
      ctx({
        signal: signal({ gameId: "cs2" }),
        state: autoState({ minDwellSeconds: 60 }),
        lastSwitchAt: now - 30_000,
        now,
      }),
    );
    expect(decision).toEqual({ switched: false, reason: "dwell" });
  });

  it("kalma süresi dolduğunda geçer", () => {
    const now = 10_000_000;
    const decision = resolveSwitch(
      ctx({
        signal: signal({ gameId: "cs2" }),
        state: autoState({ minDwellSeconds: 60 }),
        lastSwitchAt: now - 61_000,
        now,
      }),
    );
    expect(decision.switched).toBe(true);
  });

  it("eşleşme yoksa aktif profil korunur", () => {
    const decision = resolveSwitch(ctx({ signal: signal({ title: "kahve molası" }) }));
    expect(decision).toEqual({ switched: false, reason: "noMatch" });
  });
});
