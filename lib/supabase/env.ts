/**
 * Supabase env değerlerini okur ve TEMİZLER.
 *
 * Neden: env değerini panoya yanlış yapıştırma (fazladan satır sonu, tekrar
 * yapıştırma) değere `\n`/boşluk sızdırır. Anon key HTTP header'ına
 * `Authorization: Bearer <key>` olarak konduğu için içindeki newline
 * "Headers.append: ... invalid header value" TypeError'ı fırlatır ve OAuth
 * code exchange çöker. URL ve JWT anon key hiçbir zaman boşluk içermediğinden
 * tüm boşluk karakterlerini güvenle sileriz (savunma amaçlı).
 */
export function getSupabaseUrl(): string | undefined {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clean = raw?.replace(/\s/g, "");
  return clean || undefined;
}

export function getSupabaseAnonKey(): string | undefined {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const clean = raw?.replace(/\s/g, "");
  return clean || undefined;
}

/**
 * Supabase kurulu mu?
 *
 * Auth OPSİYONELDİR: env yoksa uygulama yerel (mock) depoyla çalışmaya devam
 * eder. Client kurmayı deneyip patlamak yerine önce bu kontrol yapılır
 * (`createClient()` içindeki `!` non-null iddiaları yalnız kurulu iken geçerli).
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(getSupabaseUrl() && getSupabaseAnonKey());
}
