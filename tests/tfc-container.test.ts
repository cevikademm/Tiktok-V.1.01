import { describe, expect, it } from "vitest";
import {
  decodeTfc,
  encodeTfc,
  sha256Hex,
  TfcDecodeError,
} from "@/lib/tfc/container";

/**
 * Kapsayıcı katmanı testleri — ADR-0007.
 *
 * `.tfc` biçimi belgelenmemiş olduğu için çözücü SNIFF eder. Bu testler her
 * olası sarmalayıcının doğru tespit edildiğini ve round-trip'in kayıpsız
 * olduğunu doğrular; TikFinity biçim değiştirse bile içe aktarma çalışmalı.
 */

const SAMPLE = {
  version: "1.70.1",
  actions: [{ id: "a1", name: "Kalp Yağmuru" }],
  events: [{ id: "e1", triggerTypeId: 3 }],
};

const encoder = new TextEncoder();

/**
 * Fixture üreticileri kasıtlı olarak `encodeTfc`'den BAĞIMSIZ: çözücü, kendi
 * kodlayıcımızın çıktısını değil, dışarıdan gelen sıkıştırmayı çözebilmeli.
 * (jsdom'da Blob.stream() yok — ReadableStream doğrudan kurulur.)
 */
async function compressOf(
  text: string,
  format: "gzip" | "deflate",
): Promise<Uint8Array> {
  const source = new ReadableStream<BufferSource>({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });

  const reader = source.pipeThrough(new CompressionStream(format)).getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }

  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

const gzipOf = (text: string) => compressOf(text, "gzip");
const deflateOf = (text: string) => compressOf(text, "deflate");

describe("decodeTfc — kapsayıcı tespiti", () => {
  it("düz JSON dosyasını okur", async () => {
    const result = await decodeTfc(encoder.encode(JSON.stringify(SAMPLE)));
    expect(result.format).toBe("json");
    expect(result.value).toEqual(SAMPLE);
  });

  it("UTF-8 BOM'lu JSON'u okur (Windows export'ları)", async () => {
    const withBom = new Uint8Array([
      0xef,
      0xbb,
      0xbf,
      ...encoder.encode(JSON.stringify(SAMPLE)),
    ]);
    const result = await decodeTfc(withBom);
    expect(result.format).toBe("json");
    expect(result.value).toEqual(SAMPLE);
  });

  it("gzip sarmalayıcısını açar", async () => {
    const result = await decodeTfc(await gzipOf(JSON.stringify(SAMPLE)));
    expect(result.format).toBe("gzip");
    expect(result.value).toEqual(SAMPLE);
  });

  it("zlib/deflate sarmalayıcısını açar (pako varsayılanı)", async () => {
    const result = await decodeTfc(await deflateOf(JSON.stringify(SAMPLE)));
    expect(result.format).toBe("deflate");
    expect(result.value).toEqual(SAMPLE);
  });

  it("base64(gzip(json)) sarmalayıcısını açar", async () => {
    const gz = await gzipOf(JSON.stringify(SAMPLE));
    const b64 = btoa(String.fromCharCode(...gz));
    const result = await decodeTfc(encoder.encode(b64));
    expect(result.format).toBe("base64");
    expect(result.innerFormat).toBe("gzip");
    expect(result.value).toEqual(SAMPLE);
  });

  it("sondaki NUL baytlarını kırpar", async () => {
    const padded = new Uint8Array([
      ...encoder.encode(JSON.stringify(SAMPLE)),
      0,
      0,
      0,
    ]);
    const result = await decodeTfc(padded);
    expect(result.value).toEqual(SAMPLE);
  });
});

describe("decodeTfc — hata durumları", () => {
  it("boş dosyada 'empty' kodu döner", async () => {
    await expect(decodeTfc(new Uint8Array(0))).rejects.toMatchObject({
      code: "empty",
    });
  });

  it("tanınmayan ikili içerikte 'unknownContainer' kodu döner", async () => {
    const noise = new Uint8Array([0x00, 0x13, 0x37, 0xff, 0xab, 0xcd, 0xef]);
    await expect(decodeTfc(noise)).rejects.toBeInstanceOf(TfcDecodeError);
  });

  it("bozuk JSON'da 'invalidJson' kodu döner", async () => {
    await expect(
      decodeTfc(encoder.encode('{"actions": [')),
    ).rejects.toMatchObject({ code: "invalidJson" });
  });
});

describe("encodeTfc — round-trip", () => {
  it.each(["json", "gzip", "deflate", "base64"] as const)(
    "%s biçiminde kayıpsız gider-gelir",
    async (format) => {
      const encoded = await encodeTfc(SAMPLE, format);
      const decoded = await decodeTfc(encoded);
      expect(decoded.value).toEqual(SAMPLE);
    },
  );

  it("gzip çıktısı düz JSON'dan küçüktür", async () => {
    const big = { actions: Array.from({ length: 200 }, (_, i) => ({ id: i, name: "eylem" })) };
    const json = await encodeTfc(big, "json");
    const gz = await encodeTfc(big, "gzip");
    expect(gz.length).toBeLessThan(json.length);
  });
});

describe("sha256Hex", () => {
  it("bilinen girdi için sabit özet üretir", async () => {
    // echo -n "abc" | sha256sum
    const hex = await sha256Hex(encoder.encode("abc"));
    expect(hex).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});
