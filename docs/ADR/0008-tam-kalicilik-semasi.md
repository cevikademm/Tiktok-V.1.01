# ADR-0008 — Tam kalıcılık şeması: "her şeyi yükleyebilmek"

- **Tarih:** 2026-07-19
- **Durum:** Kabul edildi
- **Faz:** Faz 2 (ADR-0003 hibrit Supabase altyapısı üzerine, 0006'nın devamı)
- **Karar veren:** `veritabani-mimari` + `supabase-uzmani` (kullanıcı isteği)

## Bağlam

Migration `0006` yalnız **Eylemler** modülünü (actions / events / timers / screens / settings)
ve medya deposunu (`media` bucket + `media_assets`) kalıcı hâle getirmişti. Uygulamanın geri
kalan **tüm** kullanıcı verisi hâlâ tarayıcıdaki tek bir localStorage anahtarında
(`livekit.mock.v1`, `lib/data/mock/store.ts`) duruyordu:

| Kayıp riski taşıyan veri | Nerede tutuluyordu |
|---|---|
| İzleyici puanları, seviye, işlem defteri | `MockState.viewers` / `.transactions` |
| Yayın profilleri, aktif profil, otomatik geçiş | `MockState.streamProfiles` / `.activeProfileId` / `.autoSwitch` |
| Widget (overlay) görünüm ayarları | `MockState.widgetSettings` |
| Hızlı erişim, Pro durumu, kanal kimliği | `MockState.quickAccess` / `.isPro` / `.channelId` |
| İkon rayı sırası, menü/debug/master toggle | `livekit.railOrder.v1` vb. 5 ayrı anahtar |
| Ses uyarıları, chatbot komutları, şarkı istekleri, hedefler | **hiç yoktu** (statik yer tutucu UI) |

Tarayıcı verisi temizlenince veya cihaz değişince hepsi kayboluyordu. Kullanıcının isteği:
*"her şeyi yüklemek için gerekli tabloları oluştur"* — yani yüklenen/oluşturulan **hiçbir şey**
tarayıcıya bağımlı kalmasın.

## Karar

Tek bir idempotent migration: **`supabase/migrations/0008_full_persistence.sql`** — 15 yeni tablo,
`media_assets` genişletmesi, bir denetim günlüğü ve yeni-kullanıcı tohumlaması.

### 1. Kalan tüm modüller için tablo

`viewers`, `point_transactions`, `stream_profiles`, `profile_state`, `widget_settings`,
`sound_alerts`, `goals`, `keyboard_shortcuts`, `chatbot_settings`, `chatbot_commands`,
`chatbot_snippets`, `chatbot_messages`, `song_request_settings`, `song_requests`,
`ui_preferences`, `user_entitlements` (+ `error_reports` garantisi).

Kolonlar `lib/schemas/*.ts` içindeki Zod şemalarıyla birebir (camelCase → snake_case).
**Sık genişleyen ve tek parça okunup yazılan** alan kümeleri (`profileSettingsSchema`,
`autoSwitchRuleSchema`, `widgetSettingsSchema`, spam korunma) `jsonb` olarak tutulur:
kolon başına ayrıştırmak her Zod değişikliğinde migration gerektirirdi, sorgu faydası
getirmezdi. Filtrelenen/sıralanan alanlar (puan, seviye, durum, sıra) gerçek kolondur.

### 2. Güvenlik — 0001/0006 ile aynı duruş

Her tabloda RLS **açık** ve kullanıcı kapsamlı: `(select auth.uid()) = user_id`
(alt-sorgu sarmalı satır başına yeniden değerlendirmeyi önler). `service_role`
(connector, yedek route'ları) RLS'i baypas eder.

İki **bilinçli istisna**:

- **`user_entitlements`** — yalnız `select` politikası var. `insert/update/delete` politikası
  YOK → kullanıcı kendi planını Pro'ya yükseltemez; yalnız `service_role` (ödeme webhook'u)
  yazabilir.
- **`change_log`** — yalnız `select` politikası. Yazma `security definer` tetikleyiciye ait;
  kullanıcı kendi denetim izini kurgulayamaz veya silemez.

`song_request_settings.spotify_refresh_token` bir **sırdır**: RLS onu sahibine açar, ancak
veri erişim katmanı bu kolonu istemciye `select *` ile göndermemelidir (yalnız sunucu okur).

### 3. `media_assets.kind` — üretilmiş (generated) kolon

Kütüphane filtresi (`components/modules/media/media-library.tsx`) türü istemcide MIME
tahminiyle hesaplıyordu. Artık `kind` veritabanında `stored generated` kolon: MIME boş
gelirse (bazı tarayıcılar bırakır) **uzantıdan** türetilir. İndekslenebilir olduğu için
"yalnız sesler" / "yalnız görseller" sorgusu tabloyu taramaz.

### 4. `change_log` — "her yükleme ve değişiklik kaydedilsin"

Uygulama koduna güvenmeyen bir denetim izi: tetikleyici seviyesinde çalışır, yani kayıt
SQL Editor'dan bile değiştirilse günlüğe düşer. `before`/`after` tam satırı jsonb olarak
saklar → yanlış silme geri alınabilir. Kullanıcı silinse de günlük **korunur** (`user_id`
üzerinde FK yok — bilinçli).

Yüksek hacimli tablolar (`stream_events`, `point_transactions`, `chatbot_messages`) bilerek
**dışarıda**: zaten ekle-only ve canlı yayında saniyede yüzlerce satır üretebilirler.

### 5. Veritabanı seviyesinde zorlanan iş kuralları

Uygulamada da olan ama API/SQL üzerinden atlatılabilecek kurallar tetikleyici/kısıt oldu:

- **`point_transactions` idempotency** — `(user_id, source_event_id)` kısmi benzersiz indeks.
  Aynı canlı olay iki kez işlenirse puan İKİ KEZ yazılamaz. `source_event_id` null olanlar
  (elle eklenen) serbest.
- **`MAX_STREAM_PROFILES = 10`** — `enforce_stream_profile_limit` tetikleyicisi.
- **`sound_alerts.media_asset_id`** → `on delete set null`. Dosya silinince uyarı kaydı
  ayakta kalır (`media_url` metin olarak da saklandığı için geçmiş bilgi kaybolmaz).
- **`media_assets.storage_path`** benzersiz — aynı dosya iki kez kataloglanamaz.

### 6. Yeni kullanıcı tohumlaması

`seed_user_defaults()` (`auth.users` üzerinde AFTER INSERT, 0001'deki `handle_new_user`'a
ek bir tetikleyici) tekil tabloların satırlarını ve 8 overlay ekranını açar. Uygulama
"satır yok" durumunu hiç görmez → her okuma yolunda null kontrolü gerekmez. Migration
sonunda aynı tohumlama **mevcut kullanıcılara geriye dönük** de uygulanır.

## Gerekçe — değerlendirilen alternatifler

| Alternatif | Neden seçilmedi |
|---|---|
| Tek `user_data jsonb` tablosu (MockState'i olduğu gibi yaz) | En hızlı yol ama sorgulanamaz, kısmi güncelleme yok (iki sekme birbirini ezer), RLS satır bazlı koruyamaz, denetim izi imkânsız |
| Modül başına ayrı migration | Aynı iş 10 dosyaya yayılır; tohumlama ve `change_log` gibi çapraz kesen parçalar tekrar eder |
| Her şeyi kolonlara aç (jsonb yok) | `profileSettingsSchema` 11, `widgetSettingsSchema` 14 alan ve sık değişiyor — her Zod düzenlemesi migration gerektirirdi |
| Denetim izini uygulama katmanında tut | Doğrudan SQL erişimini kaçırır; asıl korumak istediğimiz senaryo tam da o |

## Sonuçlar

**Olumlu**

- Uygulamada oluşturulan/yüklenen her şeyin bir tablosu ve sahibi var; cihaz değişse de kalır.
- Puan yazımı idempotent → yeniden bağlanma/çift olay puan şişirmesi yapamaz.
- Yanlış silme `change_log.before` üzerinden geri alınabilir.
- Hesap silinince tüm kullanıcı verisi cascade ile temizlenir (KVKK/GDPR silme hakkı),
  denetim izi anonim olarak kalır.

**Olumsuz / borç**

- **Tablolar şu an boş kalır**: `lib/data/supabase/` adaptörü henüz yazılmadı
  (`lib/data/index.ts` `supabase` backend'i için hâlâ "henüz uygulanmadı" fırlatıyor).
  Bu migration şemayı hazırlar; verinin localStorage'dan Supabase'e taşınması ayrı iştir.
- `change_log` büyür — ileride bir saklama süresi (ör. 90 gün) politikası gerekecek.
- `chatbot_*`, `song_request*`, `goals`, `sound_alerts` tablolarının UI'ı hâlâ statik
  yer tutucu; tablolar UI'dan önce hazırlandı (bilinçli sıra: şema önce).

## Doğrulama

Migration zinciri (`0001 → schema.sql → 0005 → 0006 → 0007 → 0008`) gerçek bir PostgreSQL 17
üzerinde (PGlite, Supabase platform nesneleri taklit edilerek) çalıştırıldı:

- Tüm dosyalar hatasız uygulandı; **0008 ikinci kez çalıştırıldığında da hatasız** (idempotent).
- 27 `public` tablosunun tamamında RLS açık (`relrowsecurity` boş küme).
- **26 davranış testi geçti**: tohumlama (6), `kind` üretilmiş kolonu (6, boş MIME ve büyük
  harf uzantı dâhil), `change_log` insert/update/delete + `before`/`after`/`row_id` (8),
  puan idempotency (2), profil limiti (1), medya silinince uyarının ayakta kalması (1),
  hesap silme cascade + günlüğün korunması (2).

> Bu test bir **gerçek hata yakaladı**: `log_change()` ilk hâlinde `TG_OP`'u (Postgres bunu
> `'INSERT'` diye BÜYÜK harf verir) küçük harfli sabitlerle karşılaştırıyordu; sonuç olarak
> her günlük satırının `before` ve `after` alanı NULL kaydediliyordu — yani denetim izi
> sessizce işe yaramaz olacaktı. Düzeltildi ve testle sabitlendi.

## Kurulum

Supabase Dashboard → **SQL Editor** → `supabase/migrations/0008_full_persistence.sql`
içeriğini yapıştır → **Run**. Önce `0001` ve `0006` çalıştırılmış olmalıdır; `0007` bağımsızdır.

## İlgili

- ADR-0003 — Overlay hibrit mimarisi (Supabase Realtime)
- ADR-0004 — `error_reports` yedeği (bu migration tabloyu garanti eder + `user_id` ekler)
- ADR-0007 — `.tfc` içe aktarma (`0007`; `widget_settings` her iki migration'da da
  `if not exists` ile tanımlı, sıra önemsiz)
