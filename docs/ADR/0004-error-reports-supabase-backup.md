# ADR-0004 — Hata Bildirimleri'nin Supabase'e sürekli yedeği

- **Tarih:** 2026-07-18
- **Durum:** Kabul edildi
- **Faz:** Faz 1.5 (ADR-0003 hibrit Supabase altyapısının üzerine)
- **Karar veren:** `supabase-uzmani` + `arka-yuz-gelistirici` (kullanıcı isteği)

## Bağlam

"Hata Bildir" modülü (`components/error-report`) ürettiği `ErrorReport` kayıtlarını yalnız
yereldeki mock store'da (localStorage `livekit.mock.v1`) tutuyordu; tarayıcı temizlenince veya
başka cihazda kayıtlar kaybolur. Kullanıcı bu kayıtların **Supabase'e sürekli yedeklenmesini**
istedi. `lib/error-report/types.ts` zaten "Faz 2'de aynı şekil bir `error_reports` tablosuna
taşınabilir (alanlar birebir)" notunu düşmüştü. ADR-0003 ile Supabase istemcileri
(`lib/supabase/{admin,browser}.ts`), env-gated desen ve `supabase/schema.sql` altyapısı mevcut.

## Karar

**1. `error_reports` tablosu** (`supabase/schema.sql`). Alanlar `ErrorReport` ile birebir
(camelCase → snake_case), `severity`/`status` check constraint'li, `created_at`/`status` index'li.
Güvenlik `overlay_configs` ile **aynı duruş**: RLS açık, politika YOK → yalnız `service_role` erişir
(anon/authenticated erişemez). Ekran görüntüsü base64 JPEG olarak `screenshot_data (text)` içinde
(Supabase Storage'a taşıma Faz 2).

**2. Yazma sunucuda (service-role).** Tarayıcıda yalnız anon key var (RLS yazmayı engeller), bu
yüzden yedekleme `POST/DELETE /api/error-reports` route'undan `getAdminSupabase()` ile yapılır.
Route env-gated: Supabase yapılandırılmamışsa `{transport:"none"}` zararsız no-op döner.

**3. "Sürekli" iki katman:**
- **Anlık (per-mutation):** `store.ts` mutasyonları — `addErrorReport`/`setErrorReportStatus` →
  tek kaydı upsert, `removeErrorReport` → satırı sil. Her değişiklik anında yedeğe yansır.
- **Mount catch-up:** `<ErrorReportBackup>` ((app) kabuğunda) — Supabase yapılandırıldığı AN,
  yedekte olmayan yerel kayıtları (yedek kapalıyken yazılmış eskiler) tek seferde upsert eder
  (id-diff: `GET /api/error-reports` → yedekteki id'ler).

**4. Tarayıcı kapısı:** `isSupabaseConfigured()` (NEXT_PUBLIC_* var mı) — yoksa hiç istek atılmaz
(gereksiz büyük base64 POST'ları önler). Yerel mock store her zaman kaynak (source of truth);
yedek best-effort.

## Gerekçe

- ADR-0003 desenini birebir tekrar kullanır (env-gated, service-role, RLS-açık/politikasız, aynı
  `supabase/schema.sql`). Yeni env değişkeni YOK — mevcut Supabase kurulumu yeter.
- Yazmayı sunucuya taşımak service-role key'i gizli tutar (tarayıcıya sızmaz).
- Yerel-öncelikli + best-effort yedek: Supabase kapalıyken/erişilemezken UI hiç etkilenmez.

## Sonuçlar / sınırlar

- ⚠️ **Auth yok:** RLS'de politika olmadığından tablo yalnız service-role ile erişilir; panelde
  gösterim hâlâ yerel store'dan. Çok-kullanıcı/restore Faz 2 (Supabase Auth).
- ⚠️ **Ekran görüntüsü boyutu:** base64 JPEG `text` kolonda; büyük kayıtlar POST'u şişirebilir
  (per-mutation tek kayıt olduğu için pratikte sorun değil). Storage'a taşıma Faz 2.
- Silme yereli takip eder (`removeErrorReport` → DELETE); yedek bir "arşiv" değil, yerelin aynası.

## Uygulama

- `supabase/schema.sql` — `error_reports` tablosu (+ index, check, RLS)
- `app/api/error-reports/route.ts` — POST(bulk upsert) / GET(ids) / DELETE
- `lib/error-report/backup.ts` — istemci ağ yardımcıları (env-gated)
- `lib/error-report/store.ts` — mutasyonlara anlık yedek bağlandı
- `components/error-report/error-report-backup.tsx` — mount catch-up (app kabuğunda)
- `.env.example` — aynı Supabase değişkenleri (ADR-0003 ile paylaşımlı)
