/**
 * `.tfc` İNCELEME ARACI — ADR-0007.
 *
 * TikFinity'nin dışa aktardığı dosyanın yapısı belgelenmemiş. Bu araç dosyayı
 * çözüp iskeletini (anahtarlar, dizi uzunlukları, alan tipleri, örnek değerler)
 * döker; `lib/tfc/map-*.ts` haritaları bu çıktıya bakılarak yazılır/doğrulanır.
 *
 * Kullanım:
 *   pnpm tfc:inspect tests/fixtures/tikfinity-sample.tfc
 *   pnpm tfc:inspect dosya.tfc --depth 4          # daha derin iskelet
 *   pnpm tfc:inspect dosya.tfc --dump cikti.json  # çözülmüş JSON'u yaz
 *   pnpm tfc:inspect dosya.tfc --path actions.0   # yalnız o düğümü göster
 */

import { readFile, writeFile } from "node:fs/promises";
import { decodeTfc, sha256Hex, TfcDecodeError } from "../lib/tfc/container";

interface Options {
  file: string;
  depth: number;
  dump?: string;
  path?: string;
}

function parseArgs(argv: string[]): Options {
  const positional: string[] = [];
  const opts: Partial<Options> = { depth: 3 };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--depth") opts.depth = Number(argv[++i]);
    else if (arg === "--dump") opts.dump = argv[++i];
    else if (arg === "--path") opts.path = argv[++i];
    else positional.push(arg);
  }

  if (!positional[0]) {
    throw new Error("Kullanım: pnpm tfc:inspect <dosya.tfc> [--depth N] [--dump out.json] [--path a.b.0]");
  }
  return { file: positional[0], depth: opts.depth ?? 3, dump: opts.dump, path: opts.path };
}

/* -------------------------------------------------------------------------- */
/* İskelet çıkarımı                                                            */
/* -------------------------------------------------------------------------- */

const MAX_SAMPLE_LEN = 60;

function preview(value: unknown): string {
  if (typeof value === "string") {
    const clean = value.replace(/\s+/g, " ");
    return clean.length > MAX_SAMPLE_LEN
      ? `"${clean.slice(0, MAX_SAMPLE_LEN)}…"`
      : `"${clean}"`;
  }
  return String(value);
}

function typeName(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

/**
 * Dizilerde HER elemanın anahtar kümesi birleştirilir — TikFinity'de eylem
 * tipine göre farklı alanlar dolduğu için tek elemana bakmak yanıltıcıdır.
 * Anahtarın kaç elemanda dolu olduğu da yazılır (`42/57`), böylece opsiyonel
 * alanlar hemen görünür.
 */
function describeArray(items: unknown[], indent: string, depth: number): string[] {
  const lines: string[] = [];
  const objectItems = items.filter(
    (i): i is Record<string, unknown> =>
      typeof i === "object" && i !== null && !Array.isArray(i),
  );

  if (objectItems.length === 0) {
    const types = [...new Set(items.map(typeName))].join(" | ");
    lines.push(`${indent}└─ eleman tipi: ${types || "yok"}`);
    if (items.length > 0) lines.push(`${indent}   örnek: ${preview(items[0])}`);
    return lines;
  }

  const keyCount = new Map<string, number>();
  const keyTypes = new Map<string, Set<string>>();
  const keySample = new Map<string, unknown>();

  for (const item of objectItems) {
    for (const [key, value] of Object.entries(item)) {
      if (value === undefined || value === null) continue;
      keyCount.set(key, (keyCount.get(key) ?? 0) + 1);
      if (!keyTypes.has(key)) keyTypes.set(key, new Set());
      keyTypes.get(key)!.add(typeName(value));
      if (!keySample.has(key)) keySample.set(key, value);
    }
  }

  const sorted = [...keyCount.entries()].sort((a, b) => b[1] - a[1]);
  for (const [key, count] of sorted) {
    const types = [...(keyTypes.get(key) ?? [])].join(" | ");
    const sample = keySample.get(key);
    const isNested = types === "object" || types === "array";
    const tail = isNested ? "" : `  ör: ${preview(sample)}`;
    lines.push(
      `${indent}├─ ${key}: ${types}  [${count}/${objectItems.length}]${tail}`,
    );
    if (isNested && depth > 0) {
      lines.push(...describe(sample, `${indent}│  `, depth - 1));
    }
  }
  return lines;
}

function describe(value: unknown, indent: string, depth: number): string[] {
  if (depth <= 0) return [`${indent}…`];

  if (Array.isArray(value)) {
    return [`${indent}(dizi, ${value.length} eleman)`, ...describeArray(value, indent, depth - 1)];
  }

  if (typeof value === "object" && value !== null) {
    const lines: string[] = [];
    for (const [key, child] of Object.entries(value)) {
      const t = typeName(child);
      if (Array.isArray(child)) {
        lines.push(`${indent}├─ ${key}: array (${child.length})`);
        lines.push(...describeArray(child, `${indent}│  `, depth - 1));
      } else if (t === "object") {
        lines.push(`${indent}├─ ${key}: object`);
        lines.push(...describe(child, `${indent}│  `, depth - 1));
      } else {
        lines.push(`${indent}├─ ${key}: ${t}  ör: ${preview(child)}`);
      }
    }
    return lines;
  }

  return [`${indent}${typeName(value)}: ${preview(value)}`];
}

/** `actions.0.config` gibi bir yolu izler. */
function resolvePath(root: unknown, path: string): unknown {
  let node = root;
  for (const segment of path.split(".")) {
    if (node === null || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[segment];
  }
  return node;
}

/** Sürüm olabilecek alanları arar — mapper'ın sürüm dallanması için ipucu. */
function findVersionHints(root: unknown): string[] {
  if (typeof root !== "object" || root === null) return [];
  return Object.entries(root as Record<string, unknown>)
    .filter(
      ([key, value]) =>
        /version|schema|app|build|export|created|generator/i.test(key) &&
        (typeof value === "string" || typeof value === "number"),
    )
    .map(([key, value]) => `${key} = ${preview(value)}`);
}

/* -------------------------------------------------------------------------- */

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const raw = await readFile(opts.file);
  const bytes = new Uint8Array(raw);

  let decoded;
  try {
    decoded = await decodeTfc(bytes);
  } catch (error) {
    if (error instanceof TfcDecodeError) {
      console.error(`\n✗ Çözülemedi (${error.code}): ${error.message}`);
      console.error(`  İlk 32 bayt: ${[...bytes.subarray(0, 32)].map((b) => b.toString(16).padStart(2, "0")).join(" ")}`);
      process.exitCode = 1;
      return;
    }
    throw error;
  }

  const checksum = await sha256Hex(bytes);

  console.log("");
  console.log("═".repeat(72));
  console.log(`  DOSYA      ${opts.file}`);
  console.log(`  BOYUT      ${bytes.length.toLocaleString("tr-TR")} bayt → ${decoded.text.length.toLocaleString("tr-TR")} bayt (çözülmüş)`);
  console.log(`  KAPSAYICI  ${decoded.format}${decoded.innerFormat ? ` → ${decoded.innerFormat}` : ""}${decoded.entryName ? `  (girdi: ${decoded.entryName})` : ""}`);
  console.log(`  SHA-256    ${checksum}`);
  console.log("═".repeat(72));

  const hints = findVersionHints(decoded.value);
  if (hints.length > 0) {
    console.log("\n▸ SÜRÜM İPUÇLARI");
    for (const hint of hints) console.log(`  ${hint}`);
  }

  const target = opts.path ? resolvePath(decoded.value, opts.path) : decoded.value;
  if (opts.path && target === undefined) {
    console.error(`\n✗ Yol bulunamadı: ${opts.path}`);
    process.exitCode = 1;
    return;
  }

  console.log(`\n▸ YAPI${opts.path ? ` (${opts.path})` : ""}  [derinlik ${opts.depth}]`);
  for (const line of describe(target, "  ", opts.depth)) console.log(line);

  if (opts.dump) {
    await writeFile(opts.dump, JSON.stringify(decoded.value, null, 2), "utf8");
    console.log(`\n✓ Çözülmüş JSON yazıldı: ${opts.dump}`);
  }
  console.log("");
}

void main();
