# ADR-0006 — Akış Profilleri: dinamik liste + oyun bazlı otomatik geçiş

- **Durum:** Kabul edildi
- **Tarih:** 2026-07-19
- **Bağlam:** PRD §3 (Stream Profiles), §10 (Free 1 / Pro 10), §12 (veri portları), CLAUDE.md §7 (port imzası değişikliği ADR gerektirir)

## Bağlam

Topbar'daki "Stream Profile 1" düğmesi Faz 0-1'de yalnız görsel bir kabuktu: tek bir sabit
etiket, altında veri yoktu. İstenen davranış iki maddeydi:

1. On adet profil, **her oyun için ayrı ayar seti**.
2. Yayındaki oyun değiştiğinde profilin **kendiliğinden** değişmesi.

Çalışma sırasında gelen ek istek: **içe aktarma profil sayısını artırmalı, profiller
silinebilmeli** — yani liste sabit 10 slot değil, dinamik olmalı.

## Karar

### 1. Yeni port: `StreamProfilesRepo`

`lib/data/ports.ts` içine `StreamProfilesRepo` eklendi ve `DataBackend.profiles` alanı açıldı.
CLAUDE.md §7 gereği port imzası değişikliği bu ADR ile kayda geçiyor. İmzalar Faz 2 Supabase
implementasyonunda aynen karşılanacak (`stream_profiles` tablosu, `profile_id` bazlı RLS).

### 2. Liste dinamik, üst sınır PRD limitinde

Profiller sabit slot değil, sıralı bir listedir:

- `create` / `duplicate` / `importProfile` → listeye **yeni** kayıt ekler (her içe aktarma
  var olanı ezmez, sayıyı artırır).
- `remove` → siler; silinen aktifse listenin ilki etkinleşir.
- Üst sınır `MAX_STREAM_PROFILES = 10` (PRD §10 Pro satırı). Sınır dolduğunda repo
  `PROFILE_LIMIT_ERROR` fırlatır, UI "önce bir profil silin" mesajı gösterir.
- En az bir profil kalmalı → `PROFILE_LAST_ERROR`.

**PRD'den sapma yok:** 10 sayısı korunur; değişen tek şey, 10'un *sabit slot* değil *tavan*
olmasıdır. Free/Pro kapısı (Free 1) Faz 2'de `entitlements.limit("streamProfiles")` ile
uygulanacak; Faz 1'de mock backend tavanı tek başına uygular.

### 3. Otomatik geçiş saf motorda

`lib/engine/profile-switcher.ts` — DOM/React bağımlılığı olmayan saf TypeScript
(CLAUDE.md §5.5). `resolveSwitch(ctx)` bir `SwitchDecision` döner; öncelik sırası:

1. `enabled` kapalı → `disabled`
2. Elle seçim askısı sürüyor → `manualHold`
3. `gameId` birebir eşleşme → en güçlü sinyal
4. Başlık kelime eşleşmesi → **en uzun** eşleşen kelime kazanır (`"gta v"` > `"gta"`)
5. Hedef zaten aktif → `alreadyActive`
6. Asgari kalma süresi dolmadı → `dwell`

İki koruma bilinçli olarak eklendi:

- **Elle seçim askısı (`manualHoldSeconds`, varsayılan 300 sn):** yayıncı elle profil
  seçtiyse algılama onu ezmemeli.
- **Asgari kalma süresi (`minDwellSeconds`, varsayılan 60 sn):** başlık/oyun sinyali
  gidip gelirse profil saniyede bir değişmesin (flapping).

Karar tipi (`switchDecisionSchema`) motorda değil **şemada** tanımlıdır; böylece `ports.ts`
motora bağımlı olmaz.

### 4. Kelime eşleştirmede Türkçe tuzağı

Normalleştirmede `toLocaleLowerCase("tr")` **kullanılmaz**: Türkçe kuralı `"FREE FIRE"`
metnini `"free fıre"` yapar ve İngilizce oyun adı katalogla eşleşmez. Bunun yerine NFD ile
aksanlar ayrıştırılıp atılır, ardından `İ/I/ı` tek bir `i`'ye katlanır. Eşleşme kelime
sınırıyla yapılır (`(?<![\p{L}\p{N}])…`), böylece `"ff"` kısaltması `"offline"` içinde
yanlış eşleşmez.

### 5. Sinyal kaynağı

`reportSignal({ gameId?, title? })` tek giriş noktasıdır. Faz 1'de sinyal elle verilir
(profil sayfasındaki "Oyun sinyali" kartı). Faz 2'de connector yayın başlığını/kategoriyi
aynı çağrıya besleyecek — UI ve motor değişmeyecek.

### 6. Profil ayarlarının yürürlüğe girmesi

`applyProfile` şu an **Hızlı Erişim** anahtarlarını (TTS / Ses / Eylemler — PRD §5.1) günceller;
bu, geçişin uygulamada gerçekten görülen etkisidir. `ttsVolume`, `soundsVolume`,
`pointsMultiplierPercent`, `overlayScreen`, `giftMinCoins`, `cooldownSeconds` alanları
saklanır ama kural motoruna Faz 2'de bağlanacaktır — o bağlama ayrı bir iş kalemidir ve bu
ADR'nin kapsamı dışındadır.

## Sonuçlar

**Olumlu**
- Oyun başına ayar seti, elle uğraşmadan yayın içinde değişir.
- Motor saf ve test edilebilir: `tests/profile-switcher.test.ts` 19 senaryo (öncelik sırası,
  askı, dwell, Türkçe/kısaltma eşleşmesi).
- İçe/dışa aktarma dosya biçimi sürümlü (`kind` + `version`), ileride göç yazılabilir.

**Olumsuz / riskler**
- Profil ayarlarının bir kısmı henüz "saklanıyor ama uygulanmıyor" durumda (yukarıda §6).
  Kullanıcıya yanlış beklenti vermemek için sekme dokümanında açıkça yazıldı.
- Oyun kataloğu 10 sabit oyunla sınırlı; katalog dışı oyunlar için kullanıcı "ek başlık
  kelimeleri" alanını kullanır. Serbest metinli oyun kimliği Faz 2'de değerlendirilecek.
- `MAX_STREAM_PROFILES` dolduğunda içe aktarma başarısız olur; kullanıcı önce silmelidir.

## Alternatifler

- **Sabit 10 slot (silinemez):** ilk tasarımdı; içe aktarmanın sayıyı artırması isteğiyle
  çeliştiği için bırakıldı.
- **Profil başına eylem/etkinlik izolasyonu:** her profilin kendi eylem listesi olması.
  Çok daha büyük bir veri modeli değişikliği; Faz 2'de `profile_id` yabancı anahtarıyla
  ele alınacak, şimdilik profiller ayar seti düzeyinde ayrışıyor.
