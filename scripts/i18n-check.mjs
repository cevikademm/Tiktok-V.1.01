#!/usr/bin/env node
/**
 * i18n denetimi — CLAUDE.md §5.2 ("hardcoded string YASAK", 4 dilde anahtar parite).
 *
 * Kontroller:
 *  1) Tüm locale'ler kaynak dil (en) ile aynı anahtar kümesine sahip mi?
 *  2) ICU placeholder'lar ({name}) ve rich-text etiketleri (<tag>) çeviriler arasında tutarlı mı?
 *  3) Boş değer var mı?
 *  4) `// TODO(i18n)` işaretli, henüz çevrilmemiş değerler raporlanır (uyarı).
 *
 * Çıkış kodu: hata varsa 1, yoksa 0.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const MESSAGES_DIR = "messages";
const SOURCE_LOCALE = "en";

function flatten(obj, prefix = "") {
  const out = {};
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(out, flatten(value, path));
    } else {
      out[path] = value;
    }
  }
  return out;
}

/** "{count} şey <b>vurgulu</b>" → { args: ['count'], tags: ['b'] } */
function extractTokens(value) {
  if (typeof value !== "string") return { args: [], tags: [] };
  const args = [...value.matchAll(/\{(\w+)[,}]/g)].map((m) => m[1]);
  const tags = [...value.matchAll(/<(\w+)>/g)].map((m) => m[1]);
  return { args: [...new Set(args)].sort(), tags: [...new Set(tags)].sort() };
}

const locales = readdirSync(MESSAGES_DIR)
  .filter((f) => f.endsWith(".json"))
  .map((f) => f.replace(/\.json$/, ""));

if (!locales.includes(SOURCE_LOCALE)) {
  console.error(`✖ Kaynak dil bulunamadı: ${SOURCE_LOCALE}.json`);
  process.exit(1);
}

const flat = {};
for (const locale of locales) {
  flat[locale] = flatten(JSON.parse(readFileSync(join(MESSAGES_DIR, `${locale}.json`), "utf8")));
}

const sourceKeys = Object.keys(flat[SOURCE_LOCALE]).sort();
const errors = [];
const warnings = [];

for (const locale of locales) {
  if (locale === SOURCE_LOCALE) continue;

  const keys = Object.keys(flat[locale]).sort();

  for (const key of sourceKeys) {
    if (!(key in flat[locale])) errors.push(`${locale}: EKSİK anahtar → ${key}`);
  }
  for (const key of keys) {
    if (!(key in flat[SOURCE_LOCALE])) errors.push(`${locale}: FAZLA anahtar → ${key}`);
  }

  for (const key of sourceKeys) {
    if (!(key in flat[locale])) continue;

    const src = extractTokens(flat[SOURCE_LOCALE][key]);
    const dst = extractTokens(flat[locale][key]);

    if (src.args.join(",") !== dst.args.join(",")) {
      errors.push(
        `${locale}: ${key} → placeholder uyuşmuyor (en: {${src.args}} / ${locale}: {${dst.args}})`,
      );
    }
    if (src.tags.join(",") !== dst.tags.join(",")) {
      errors.push(
        `${locale}: ${key} → rich-text etiketi uyuşmuyor (en: <${src.tags}> / ${locale}: <${dst.tags}>)`,
      );
    }

    const value = flat[locale][key];
    if (typeof value === "string" && value.trim() === "") {
      errors.push(`${locale}: ${key} → boş değer`);
    }
    if (typeof value === "string" && value.includes("TODO(i18n)")) {
      warnings.push(`${locale}: ${key} → çeviri bekliyor`);
    }
  }
}

console.log(`Diller: ${locales.join(", ")}  ·  Anahtar: ${sourceKeys.length}`);

for (const w of warnings) console.warn(`⚠ ${w}`);

if (errors.length > 0) {
  for (const e of errors) console.error(`✖ ${e}`);
  console.error(`\n${errors.length} i18n hatası.`);
  process.exit(1);
}

console.log(`✓ i18n temiz (${locales.length} dil × ${sourceKeys.length} anahtar).`);
