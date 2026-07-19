/**
 * `.tfc` KAPSAYICI (container) KATMANI — ADR-0007.
 *
 * TikFinity'nin dışa aktardığı `.tfc` dosyasının sarmalayıcı biçimi belgelenmemiş
 * ve sürümler arasında değişebilir (gerçek bundle'da `pako`/zlib kullanıldığı
 * tespit edildi). Bu yüzden formatı ŞART koşmak yerine SNIFF ederiz: baytlara
 * bakıp düz JSON / gzip / zlib / ZIP / base64 sarmalayıcılarını sırayla dener,
 * ilk başarılı çözümü döneriz. Böylece TikFinity biçimi değiştirdiğinde
 * içe aktarma kırılmaz.
 *
 * Bağımlılık YOK: hem tarayıcıda hem Node 18+'da bulunan Web Streams
 * `DecompressionStream`/`CompressionStream` kullanılır. ZIP okuyucu elle
 * yazılmıştır (yalnız okuma; `deflate-raw` ile açar).
 */

export type TfcContainerFormat =
  | "json"
  | "gzip"
  | "deflate"
  | "deflate-raw"
  | "zip"
  | "base64";

/** Sıkıştırma kullanan biçimler — base64 sarmalayıcısının içinde de olabilirler. */
type BinaryFormat = Exclude<TfcContainerFormat, "base64">;

export interface DecodedContainer {
  /** En dıştaki sarmalayıcı. */
  format: TfcContainerFormat;
  /** `format === "base64"` ise base64 çözüldükten sonra bulunan gerçek biçim. */
  innerFormat?: BinaryFormat;
  /** ZIP ise içeriğin okunduğu girdi adı. */
  entryName?: string;
  /** Çözülmüş ham JSON metni. */
  text: string;
  /** `JSON.parse(text)` çıktısı — doğrulanmamış. */
  value: unknown;
}

/** İçe aktarma hataları — `code` i18n anahtarı olarak kullanılır. */
export class TfcDecodeError extends Error {
  constructor(
    readonly code:
      | "empty"
      | "unknownContainer"
      | "corruptArchive"
      | "invalidJson"
      | "tooLarge",
    message: string,
  ) {
    super(message);
    this.name = "TfcDecodeError";
  }
}

/** Güvenlik tavanı: sıkıştırma bombasına karşı açılmış boyut sınırı (64 MB). */
const MAX_INFLATED_BYTES = 64 * 1024 * 1024;

/* -------------------------------------------------------------------------- */
/* Yardımcılar                                                                 */
/* -------------------------------------------------------------------------- */

function toBytes(input: ArrayBuffer | Uint8Array): Uint8Array {
  return input instanceof Uint8Array ? input : new Uint8Array(input);
}

/** UTF-8 BOM'u (EF BB BF) atar — Windows'ta üretilen dosyalarda sık görülür. */
function stripBom(bytes: Uint8Array): Uint8Array {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return bytes.subarray(3);
  }
  return bytes;
}

const decoder = new TextDecoder("utf-8", { fatal: false });
const encoder = new TextEncoder();

/**
 * Baytları tek parçalık okunabilir akışa sarar.
 *
 * `new Blob([...]).stream()` KULLANILMAZ: jsdom'un Blob'unda `stream()` yok ve
 * birim testleri jsdom ortamında koşuyor. ReadableStream hem tarayıcıda hem
 * Node'da global.
 */
function streamOf(bytes: Uint8Array): ReadableStream<BufferSource> {
  // Öğe tipi `BufferSource`: (De)CompressionStream'in `writable` tarafı bunu
  // bekliyor; `Uint8Array` ile daraltmak pipeThrough'u tip hatasına düşürür.
  return new ReadableStream<BufferSource>({
    start(controller) {
      // Kopya: `subarray()` ile gelen görünümlerin arka tamponu `ArrayBufferLike`
      // olabiliyor; `BufferSource` sabit `ArrayBuffer` bekler.
      controller.enqueue(new Uint8Array(bytes));
      controller.close();
    },
  });
}

async function inflate(
  bytes: Uint8Array,
  format: "gzip" | "deflate" | "deflate-raw",
): Promise<Uint8Array> {
  const stream = streamOf(bytes).pipeThrough(new DecompressionStream(format));

  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = stream.getReader();

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > MAX_INFLATED_BYTES) {
      await reader.cancel();
      throw new TfcDecodeError("tooLarge", "inflated payload exceeds 64 MB");
    }
    chunks.push(value);
  }

  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

async function deflateBytes(
  bytes: Uint8Array,
  format: "gzip" | "deflate",
): Promise<Uint8Array> {
  const stream = streamOf(bytes).pipeThrough(new CompressionStream(format));

  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    chunks.push(value);
  }

  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

/**
 * Metin JSON'a çevrilir. TikFinity bazı sürümlerde sondaki NUL baytlarını
 * bırakabildiği için kırpma yapılır.
 */
function parseJsonText(text: string): unknown {
  const trimmed = text.replace(/\0+$/, "").trim();
  try {
    return JSON.parse(trimmed);
  } catch (cause) {
    throw new TfcDecodeError("invalidJson", `JSON parse failed: ${String(cause)}`);
  }
}

function looksLikeJsonText(text: string): boolean {
  const head = text.replace(/^﻿/, "").trimStart();
  return head.startsWith("{") || head.startsWith("[");
}

/** Yalnız base64 alfabesi + boşluk içeriyorsa base64 sarmalayıcısı olabilir. */
function looksLikeBase64(text: string): boolean {
  const compact = text.replace(/\s+/g, "");
  if (compact.length < 16 || compact.length % 4 !== 0) return false;
  return /^[A-Za-z0-9+/]+={0,2}$/.test(compact);
}

function decodeBase64(text: string): Uint8Array {
  const compact = text.replace(/\s+/g, "");
  // atob her iki ortamda da var (Node 16+ global).
  const binary = atob(compact);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  // Yığın taşmasını önlemek için parçalı (String.fromCharCode argüman limiti).
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/* -------------------------------------------------------------------------- */
/* Bayt imzası tespiti                                                         */
/* -------------------------------------------------------------------------- */

function isGzip(b: Uint8Array): boolean {
  return b[0] === 0x1f && b[1] === 0x8b;
}

function isZip(b: Uint8Array): boolean {
  return b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04;
}

/**
 * zlib başlığı: ilk bayt 0x78 (CM=8, CINFO=7) ve iki baytlık başlık 31'e tam
 * bölünüyorsa. RFC 1950.
 */
function isZlib(b: Uint8Array): boolean {
  if (b.length < 2) return false;
  return (b[0] & 0x0f) === 0x08 && ((b[0] << 8) | b[1]) % 31 === 0;
}

/* -------------------------------------------------------------------------- */
/* Minimal ZIP okuyucu                                                         */
/* -------------------------------------------------------------------------- */

interface ZipEntry {
  name: string;
  method: number;
  compressedSize: number;
  localHeaderOffset: number;
}

/**
 * ZIP merkezi dizinini okur. Yalnız gerekli alanlar; şifreleme/çoklu disk
 * desteklenmez (TikFinity export'unda beklenmez, karşılaşılırsa hata verilir).
 */
function readZipEntries(bytes: Uint8Array): ZipEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  // EOCD imzası (0x06054b50) sondan geriye taranır — yorum alanı en fazla 64 KB.
  const maxScan = Math.min(bytes.length, 0xffff + 22);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= bytes.length - maxScan && i >= 0; i -= 1) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new TfcDecodeError("corruptArchive", "ZIP EOCD not found");

  const entryCount = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);

  const entries: ZipEntry[] = [];
  for (let i = 0; i < entryCount; i += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) {
      throw new TfcDecodeError("corruptArchive", "ZIP central directory corrupt");
    }
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const nameLen = view.getUint16(offset + 28, true);
    const extraLen = view.getUint16(offset + 30, true);
    const commentLen = view.getUint16(offset + 32, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLen));

    entries.push({ name, method, compressedSize, localHeaderOffset });
    offset += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

async function readZipEntry(bytes: Uint8Array, entry: ZipEntry): Promise<Uint8Array> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const lho = entry.localHeaderOffset;
  if (view.getUint32(lho, true) !== 0x04034b50) {
    throw new TfcDecodeError("corruptArchive", "ZIP local header corrupt");
  }
  const nameLen = view.getUint16(lho + 26, true);
  const extraLen = view.getUint16(lho + 28, true);
  const dataStart = lho + 30 + nameLen + extraLen;

  // Merkezi dizindeki boyut 0 ise (streaming yazım) sona kadar oku.
  const size = entry.compressedSize || bytes.length - dataStart;
  const data = bytes.subarray(dataStart, dataStart + size);

  if (entry.method === 0) return data; // stored
  if (entry.method === 8) return inflate(data, "deflate-raw");
  throw new TfcDecodeError(
    "corruptArchive",
    `unsupported ZIP compression method ${entry.method}`,
  );
}

/* -------------------------------------------------------------------------- */
/* Çözme                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * `.tfc` (veya `.json`) dosya içeriğini çözer.
 *
 * Deneme sırası: düz JSON → gzip → zlib → ZIP → base64(içindekini tekrar dene).
 * Base64 özyinelemesi TEK seviyedir; iç içe base64 kabul edilmez.
 */
export async function decodeTfc(
  input: ArrayBuffer | Uint8Array,
): Promise<DecodedContainer> {
  const bytes = stripBom(toBytes(input));
  if (bytes.length === 0) {
    throw new TfcDecodeError("empty", "file is empty");
  }
  return decodeInner(bytes, true);
}

async function decodeInner(
  bytes: Uint8Array,
  allowBase64: boolean,
): Promise<DecodedContainer> {
  if (isGzip(bytes)) {
    const text = decoder.decode(await inflate(bytes, "gzip"));
    return { format: "gzip", text, value: parseJsonText(text) };
  }

  if (isZip(bytes)) {
    const entries = readZipEntries(bytes);
    // Öncelik: .json uzantılı ilk girdi; yoksa dizindeki ilk girdi.
    const entry =
      entries.find((e) => e.name.toLowerCase().endsWith(".json")) ?? entries[0];
    if (!entry) throw new TfcDecodeError("corruptArchive", "ZIP has no entries");
    const text = decoder.decode(await readZipEntry(bytes, entry));
    return {
      format: "zip",
      entryName: entry.name,
      text,
      value: parseJsonText(text),
    };
  }

  if (isZlib(bytes)) {
    const text = decoder.decode(await inflate(bytes, "deflate"));
    return { format: "deflate", text, value: parseJsonText(text) };
  }

  const asText = decoder.decode(bytes);

  if (looksLikeJsonText(asText)) {
    return { format: "json", text: asText, value: parseJsonText(asText) };
  }

  if (allowBase64 && looksLikeBase64(asText)) {
    let inner: Uint8Array;
    try {
      inner = decodeBase64(asText);
    } catch {
      throw new TfcDecodeError("unknownContainer", "base64 decode failed");
    }
    const decoded = await decodeInner(inner, false);
    return {
      format: "base64",
      innerFormat: decoded.format as BinaryFormat,
      entryName: decoded.entryName,
      text: decoded.text,
      value: decoded.value,
    };
  }

  // Başlıksız ham deflate (bazı pako çağrıları başlık yazmaz) — son çare.
  try {
    const text = decoder.decode(await inflate(bytes, "deflate-raw"));
    if (looksLikeJsonText(text)) {
      return { format: "deflate-raw", text, value: parseJsonText(text) };
    }
  } catch {
    // Yut — aşağıdaki "bilinmeyen kapsayıcı" hatası daha açıklayıcı.
  }

  throw new TfcDecodeError(
    "unknownContainer",
    "file is neither JSON, gzip, zlib, ZIP nor base64",
  );
}

/* -------------------------------------------------------------------------- */
/* Kodlama (dışa aktarma)                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Dışa aktarma için kapsayıcı üretir.
 *
 * Varsayılan `gzip`: gerçek TikFinity'nin `pako` kullandığı tespitine en yakın
 * biçim ve dosya boyutunu ~10 kat küçültür. `json` biçimi okunabilir yedek için.
 */
export async function encodeTfc(
  value: unknown,
  format: "json" | "gzip" | "deflate" | "base64" = "gzip",
): Promise<Uint8Array> {
  const text = JSON.stringify(value, null, format === "json" ? 2 : 0);
  const raw = encoder.encode(text);

  switch (format) {
    case "json":
      return raw;
    case "gzip":
      return deflateBytes(raw, "gzip");
    case "deflate":
      return deflateBytes(raw, "deflate");
    case "base64":
      return encoder.encode(encodeBase64(await deflateBytes(raw, "gzip")));
  }
}

/* -------------------------------------------------------------------------- */

/** Dosya bütünlüğü / "aynı dosyayı iki kez mi aktardım" kontrolü için sha256. */
export async function sha256Hex(input: ArrayBuffer | Uint8Array): Promise<string> {
  const bytes = toBytes(input);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    bytes.slice().buffer as ArrayBuffer,
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
