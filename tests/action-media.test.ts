import { beforeEach, describe, expect, it } from "vitest";
import { createMockBackend } from "@/lib/data/mock";
import { resetState } from "@/lib/data/mock/store";
import { actionDraftSchema, type ActionDraft } from "@/lib/schemas/action";

/**
 * "Ses yüklendiğinde kaydedilmiyor" regresyonu.
 *
 * Editör medyayı `config.mediaUrl` / `config.mediaName` alanlarına yazar; bu alanlar
 * şemadan veya depodan düşerse kullanıcı sesi kaydedilmemiş görür. Testler medyanın
 * create → list ve update → get yolculuğunda hayatta kaldığını doğrular.
 */

function audioDraft(overrides: Partial<ActionDraft> = {}): ActionDraft {
  return actionDraftSchema.parse({
    name: "Alkış",
    types: ["playAudio"],
    config: {
      mediaName: "alkis.mp3",
      mediaUrl: "https://pv.supabase.co/storage/v1/object/public/media/uid/abc.mp3",
    },
    ...overrides,
  });
}

describe("eylem medyası kalıcılığı", () => {
  beforeEach(() => {
    resetState();
  });

  it("create sonrası mediaUrl/mediaName listede korunur", async () => {
    const backend = createMockBackend();
    const created = await backend.actions.create(audioDraft());

    expect(created.config.mediaUrl).toBe(audioDraft().config.mediaUrl);

    const [stored] = await backend.actions.list();
    expect(stored.config.mediaName).toBe("alkis.mp3");
    expect(stored.config.mediaUrl).toBe(audioDraft().config.mediaUrl);
  });

  it("update medyayı ezmeden diğer alanları değiştirir", async () => {
    const backend = createMockBackend();
    const created = await backend.actions.create(audioDraft());

    await backend.actions.update(created.id, {
      ...audioDraft(),
      name: "Alkış v2",
      durationSec: 12,
    });

    const stored = await backend.actions.get(created.id);
    expect(stored?.name).toBe("Alkış v2");
    expect(stored?.durationSec).toBe(12);
    expect(stored?.config.mediaUrl).toBe(audioDraft().config.mediaUrl);
  });

  it("medya kaldırıldığında alanlar temizlenir", async () => {
    const backend = createMockBackend();
    const created = await backend.actions.create(audioDraft());

    await backend.actions.update(created.id, {
      ...audioDraft(),
      config: { mediaUrl: undefined, mediaName: undefined },
    });

    const stored = await backend.actions.get(created.id);
    expect(stored?.config.mediaUrl).toBeUndefined();
    expect(stored?.config.mediaName).toBeUndefined();
  });

  it("şema uzun/imzalı Storage URL'sini kırpmaz", () => {
    const long =
      "https://pvaudeisyqaghwlxcwml.supabase.co/storage/v1/object/public/media/" +
      "76dcedec-45be-451f-824b-accbb3df3be2/m9x1q2-a1b2c3.mp3";
    const parsed = actionDraftSchema.parse({
      name: "Uzun URL",
      types: ["playAudio"],
      config: { mediaUrl: long, mediaName: "çok uzun ad — boşluklu.mp3" },
    });
    expect(parsed.config.mediaUrl).toBe(long);
    expect(parsed.config.mediaName).toBe("çok uzun ad — boşluklu.mp3");
  });
});
