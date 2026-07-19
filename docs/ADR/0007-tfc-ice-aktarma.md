# ADR-0007 — TikFinity `.tfc` içe/dışa aktarma

- **Durum:** Kabul edildi
- **Tarih:** 2026-07-19
- **Bağlam:** Kurmak sekmesi → "Ayarları İçe / Dışa Aktar" bölümü
- **İlgili:** ADR-0003 (overlay hibrit), ADR-0006 (akış profilleri), `0006_actions_media_storage.sql`

## Bağlam

Gerçek TikFinity'den gelen kullanıcılar eylem/etkinlik kütüphanelerini taşımak
istiyor. TikFinity setup sayfası "Import / Export Settings" bölümünden **`.tfc`**
uzantılı bir dosya üretiyor.

Mevcut durum yetersizdi: `SettingsRepo.import()` yalnız `settings` alanını
okuyordu; eylemler, etkinlikler, zamanlayıcılar, ekranlar ve widget ayarları
tamamen yok sayılıyordu — yani taşınmak istenen asıl veri hiç gelmiyordu.

**Kısıt:** `.tfc` biçimi belgelenmemiş. Gerçek TikFinity bundle'ı
(`kurmak_files/app.js`) tamamen obfuscate; `settingsExportButton` yalnız
render edilmiş DOM'da geçiyor, handler'ı statik olarak çözülemedi. Bundle'da
`pako` (zlib) kullanıldığı tespit edildi → dosyanın sıkıştırılmış JSON olması
kuvvetle muhtemel, ama garanti değil.

## Kararlar

### 1. Kapsayıcı biçimi ŞART koşulmaz, SNIFF edilir

`lib/tfc/container.ts` baytlara bakıp sırayla dener: düz JSON → gzip (`1f 8b`)
→ ZIP (`50 4b`) → zlib (`78 xx`) → base64 (tek seviye özyineleme) → başlıksız
deflate. İlk başarılı çözüm kullanılır.

**Neden:** Tek bir biçime bağlanmak, TikFinity sürüm atladığında içe aktarmayı
sessizce kırardı. Sniff etmek yanlış tahmine karşı sigortadır.

**Bağımlılık eklenmedi:** Web Streams `DecompressionStream`/`CompressionStream`
hem tarayıcıda hem Node 18+'da global. ZIP okuyucu elle yazıldı (~80 satır,
yalnız okuma). Sıkıştırma bombasına karşı 64 MB açılmış boyut tavanı var.

### 2. Alan adları toleranslı okunur

`lib/tfc/read.ts` her nesnenin anahtarlarını normalize eder
(`Points_Per Coin` → `pointspercoin`) ve `pick(source, ...aliases)` ile birden
çok aday adı dener. Tip dönüştürücüler hoşgörülü (`"4455"` → `4455`, `1` → `true`).

**Neden:** TikFinity aynı bilgiyi sürümlere göre `duration` / `durationSec` /
`durationMs` gibi farklı adlarla ve farklı tiplerle yazabiliyor. Sabit şema
yerine alias listeleri, gerçek dosya elde edilmeden de çalışan bir haritalama
sağlıyor; dosya geldiğinde alias listesine ekleme yapmak yeterli.

### 3. Enum köprüsü PROJEDE ZATEN VARDI — yeniden yazılmadı

- Eylem tipleri (`showText`, `playAudio`, `speakText`…) PRD'den TikFinity
  adlarıyla birebir türetilmişti → eşleme 1:1, yalnız eş anlamlılar eklendi.
- Tetikleyiciler için `THIRD_PARTY_TRIGGER_ID` (`lib/schemas/event.ts`)
  **tersine çevrilerek** kullanıldı: TikFinity'nin sayısal `triggerTypeId`'si
  (3 = gift_min, 11 = chat…) → bizim `TriggerType`. Yeni sözlük uydurulmadı.

### 4. `ImportPlan` saf veri; önizleme ile yazım AYNI kodu kullanır

`buildImportPlan()` yan etkisiz bir fonksiyondur. `?dryRun=1` yolu bu planı
rapor olarak döner, onay yolu aynı planı yazar. Kullanıcının onayladığı rapor
ile yazılan veri arasında fark oluşamaz.

Sapmalar sessizce yutulmaz: `warnings` (alındı, düzeltildi) ve `skipped`
(alınamadı, gerekçesiyle) listelerine düşer ve önizlemede gösterilir.

**Id yeniden yazımı:** İçe aktarılan her eylem yeni bir id alır (`act_xxx`),
orijinali `externalId` olarak saklanır; etkinliklerin referansları eski→yeni
harita üzerinden çevrilir. Çözülemeyen referans `skipped`'a düşer. Böylece
mevcut kütüphaneyle id çakışması imkânsızdır.

### 5. Ayrı bir "profil" kavramı YARATILMADI

`stream_profiles` bu projede **oyun profili** demek (ADR-0006: PUBG/Valorant →
TTS/ses/otomatik geçiş) ve eylem kütüphanesi taşımıyor. TikFinity'nin "profile
settings" kavramı için ikinci bir profil listesi açmak kullanıcıyı şaşırtırdı.

Bunun yerine: içe aktarılan kayıtlar kullanıcının **tek kütüphanesine** eklenir
ve `import_id` ile etiketlenir. Kullanıcı "TikFinity İçe Aktarmalarım"
geçmişinden herhangi birini **topluca geri alabilir**.

### 6. Şema additive — `0006_actions_media_storage.sql` değiştirilmedi

`0007_tfc_imports.sql` yalnız EKLER:

- `settings_imports` — denetim kaydı + üzerine yazılan tekil tabloların
  içe aktarma öncesi hâli (`previous_state`)
- `actions` / `stream_events` / `stream_timers` → nullable `import_id` +
  `external_id` kolonları (`on delete set null`: denetim kaydı silinse bile
  veri kalır)
- `widget_settings` — 0006'da yoktu
- `import_tfc(payload, meta)` — TEK transaction; yarım içe aktarma oluşamaz
- `undo_tfc_import(import_id)` — etiketli kayıtları siler, tekil tabloları
  `previous_state`'ten geri yükler

Fonksiyonlar `SECURITY INVOKER`: RLS çağıranın kimliğiyle uygulanır, yetki
aşımı yolu açılmaz.

### 7. Dışa aktarma çift hedefli

`.tfc` (gzip) ve `.json` (düz) aynı yükü taşır:

- **Geri uyumluluk** — ayarlar TikFinity'nin düz sözlüğüne açılır
  (`obsIp`, `pointsPerCoin`…), etkinliklere sayısal `triggerTypeId` eklenir,
  eylemlere tekil `type` de yazılır.
- **Kayıpsızlık** — kanonik verimiz `livekit` bloğunda aynen taşınır; kendi
  içe aktarıcımız bu bloğu görürse tahmin yapmadan okur.

## Port sözleşmesi değişikliği

`SettingsRepo`'ya tek metot eklendi (CLAUDE.md §7 gereği bu ADR ile):

```ts
applyImport(plan: ImportPlan): Promise<void>;
```

Yerel depoya TEK `mutate()` ile uygular. Eylem başına `create()` çağırmak
50 eylem için 50 ayrı yazma + 50×80 ms sahte gecikme demekti ve yarım uygulama
riski taşıyordu.

## Sonuçlar

**Olumlu**
- Gerçek `.tfc` elde edilmeden de çalışan, sürüm değişimlerine dayanıklı bir hat.
- Sessiz veri kaybı yok: her sapma raporlanır ve onaydan önce görülür.
- Yanlış içe aktarma tek tıkla geri alınabilir.
- Yeni npm bağımlılığı yok.

**Olumsuz / riskler**
- Alias listeleri tahminle başladı. Gerçek `.tfc` gelince
  `pnpm tfc:inspect <dosya>` çıktısına bakılıp doğrulanmalı, eksik alanlar
  alias listelerine eklenmelidir. **Golden test bu dosya olmadan yazılamaz.**
- Ürettiğimiz `.tfc`'nin gerçek TikFinity tarafından kabul edildiği henüz
  doğrulanmadı (elde referans dosya yok).
- Tekil tablolar (ayarlar/ekranlar/widget) üzerine yazılır. Kullanıcı bunu
  önizlemede görüyor ve geri alma bunları da eski hâline döndürüyor.

## Alternatifler

- **`pako` bağımlılığı eklemek:** Web Streams zaten yeterli; bundle'a ~45 kB
  eklemenin karşılığı yok.
- **Katı Zod şeması ile doğrulama:** Tek bir bilinmeyen alan tüm dosyayı
  düşürürdü. Doğrulama kayıt bazında yapılıp bozuk kayıt atlanıyor.
- **İçe aktarmayı tarayıcıda çözmek:** 64 MB'lık sıkıştırma bombası sekmeyi
  kilitlerdi; ayrıca yazma ve önizleme yolları ayrışırdı.
