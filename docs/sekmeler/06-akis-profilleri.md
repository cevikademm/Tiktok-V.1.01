# 06 — Akış Profilleri (`stream-profiles`)

- **PRD referansı:** §3 (Stream Profiles), §4.4 bileşen 7 (topbar switcher), §10 (Free 1 / Pro 10)
- **Karar kaydı:** `docs/ADR/0006-akis-profilleri-otomatik-gecis.md`
- **Faz:** Faz 1 — uygulandı (mock veri; bazı ayarlar saklanır, motora Faz 2'de bağlanır)
- **Modül `pageId`:** yok — ikon rayında görünmez, topbar profil değiştiricisinden açılır

---

## Sekmenin amacı ve hedef kullanıcı

Yayıncının **her oyun için ayrı bir ayar seti** tutmasını ve yayındaki oyun değiştiğinde
bu setin **kendiliğinden** devreye girmesini sağlar. Örneğin CS2 oynarken TTS kapalı ve
eylem bekleme süresi 15 sn iken, sohbet moduna geçildiğinde TTS açık ve bekleme 0 olur —
yayıncı hiçbir düğmeye basmaz.

**Hedef kullanıcı:** Birden fazla oyun/format yayınlayan TikTok LIVE yayıncısı.

---

## Bağlı route, dosya yolları, bileşenler

| Katman | Yol |
|---|---|
| Route | `/{locale}/stream-profiles` |
| Sayfa | `app/[locale]/(app)/stream-profiles/page.tsx` |
| Yönetim | `components/modules/stream-profiles/profiles-manager.tsx` |
| Profil kartı | `components/modules/stream-profiles/profile-card.tsx` |
| Etiket yardımcısı | `components/modules/stream-profiles/profile-label.ts` |
| Topbar değiştirici | `components/layout/stream-profile-switcher.tsx` (topbar bileşen 7) |
| Şema | `lib/schemas/stream-profile.ts` |
| Motor | `lib/engine/profile-switcher.ts` (saf TS) |
| Port | `lib/data/ports.ts` → `StreamProfilesRepo`, `DataBackend.profiles` |
| Mock repo | `lib/data/mock/index.ts` (`profiles`) |
| Depo alanları | `lib/data/mock/store.ts` → `streamProfiles`, `activeProfileId`, `autoSwitch`, `gameSignal`, `lastProfileSwitchAt` |
| Testler | `tests/profile-switcher.test.ts` (19 senaryo) |

**Bölüm kimlikleri:** `section-autoSwitch`, `section-gameSignal`, `section-profiles`.

---

## Alt Bölüm: Otomatik profil geçişi

| Ayar | Alan | Varsayılan | Anlamı |
|---|---|---|---|
| Ana anahtar | `autoSwitch.enabled` | açık | Kapalıyken profil yalnız elle değişir |
| Elle seçim sonrası bekleme | `manualHoldSeconds` | 300 sn | Elle profil seçilince otomatik geçiş bu süre susar |
| Asgari kalma süresi | `minDwellSeconds` | 60 sn | Art arda geçişleri (flapping) engeller |

Karar sırası (`resolveSwitch`, ADR-0006 §3): `disabled` → `manualHold` → `gameId` eşleşmesi →
başlık kelimesi (en uzun kazanır) → `alreadyActive` → `dwell` → geçiş.

## Alt Bölüm: Oyun sinyali

`reportSignal({ gameId, title, source })` tek giriş noktasıdır. Faz 1'de sinyal bu karttan
elle verilir; Faz 2'de connector yayın başlığını/kategoriyi aynı çağrıya besleyecek — UI ve
motor değişmeyecek.

Kelime eşleşmesi kelime sınırıyla yapılır: `"ff"` (Free Fire) `"offline"` içinde eşleşmez.
Normalleştirme aksanları atar ve `İ/I/ı` harflerini `i`'ye katlar; Türkçe locale lowercase
**bilinçli olarak kullanılmaz** (`"FREE FIRE"` → `"free fıre"` tuzağı — ADR-0006 §4).

## Alt Bölüm: Profil listesi

- Başlangıçta **10 profil**, katalogdaki 10 oyuna bağlı (PUBG Mobile, Free Fire, Valorant,
  League of Legends, CS2, Minecraft, GTA RP, Fortnite, Roblox, Sohbet).
- **Profil ekle** / **Kopyala** / **Profil içe aktar** → listeye **yeni** kayıt ekler
  (her içe aktarma sayıyı artırır, var olanı ezmez).
- **Sil** → profili kaldırır; silinen profil aktifse listenin ilki etkinleşir.
  Son profil silinemez.
- Üst sınır `MAX_STREAM_PROFILES = 10`. Dolduğunda ekleme/içe aktarma düğmeleri kapanır ve
  "önce bir profil silin" uyarısı çıkar.
- **Varsayılan profillere dön** → 10 profillik başlangıç setini geri yükler.

### Profil başına ayarlar

| Alan | Tip | Faz 1'de etkisi |
|---|---|---|
| `ttsEnabled` / `soundsEnabled` / `actionsEnabled` | bool | **Uygulanır** — Hızlı Erişim anahtarlarına yazılır (PRD §5.1) |
| `ttsVolume` / `soundsVolume` | 0-100 | Saklanır; motora Faz 2'de bağlanacak |
| `chatbotEnabled` / `songRequestsEnabled` | bool | Saklanır; ilgili modüller Faz 2+ |
| `pointsMultiplierPercent` | tamsayı % (100 = 1x) | Saklanır; puan motoru Faz 2 |
| `overlayScreen` | 1-8 | Saklanır; overlay kuyruğu bağlantısı Faz 2 |
| `giftMinCoins` | tamsayı | Saklanır |
| `cooldownSeconds` | 0-3600 | Saklanır |

> **Bilinen sınırlama:** "Saklanır" satırları kaydedilir ve dışa aktarılır ama henüz kural
> motorunu etkilemez. Kullanıcıya yanlış beklenti vermemek için burada açıkça belirtilmiştir.

### Varsayılan ayarların oyun bazlı farkı (örnekler)

| Oyun | TTS | Ses | Puan çarpanı | Ekran | Bekleme |
|---|---|---|---|---|---|
| CS2 | kapalı | 40 | %110 | 5 | 15 sn |
| Valorant | kapalı | 45 | %100 | 3 | 10 sn |
| Minecraft | açık | 75 | %150 | 6 | 0 sn |
| Sohbet | açık | 70 | %100 | 2 | 0 sn |

---

## API çağrıları ve veri şeması

Tümü `backend.profiles` (`StreamProfilesRepo`) üzerinden — UI doğrudan store'a yazmaz:

| Çağrı | Not |
|---|---|
| `list()` / `active()` | Liste ve aktif profil |
| `create(draft)` / `duplicate(id)` / `importProfile(json)` | Sınır dolu → `PROFILE_LIMIT_ERROR` |
| `update(id, patch)` | Aktif profil düzenlenirse ayarlar anında yürürlüğe girer; dwell sayacı **korunur** |
| `remove(id)` | Son profil → `PROFILE_LAST_ERROR` |
| `activate(id, { manual })` | `manual: true` → elle seçim askısını başlatır |
| `exportProfile(id)` | `{ kind: "livekit.streamProfile", version: 1, profile }` JSON'u |
| `getAutoSwitch()` / `setAutoSwitch(patch)` | Otomatik geçiş ayarları |
| `getSignal()` / `reportSignal(patch)` | Sinyal + `SwitchDecision` + yeni aktif profil |
| `resetAll()` | Varsayılan 10 profil |

Şemalar: `streamProfileSchema`, `streamProfileDraftSchema`, `profileSettingsSchema`,
`autoSwitchRuleSchema`, `autoSwitchStateSchema`, `gameSignalSchema`, `switchDecisionSchema`.

---

## State yönetimi

- Kalıcılık: mock store (`localStorage`, `livekit.mock.v1`).
- Okuma: `useMockStore()` (`useSyncExternalStore`) — sunucu snapshot'ı sabit referans
  olduğu için hidrasyon uyumsuzluğu doğmaz.
- Yazma: yalnız repo üzerinden; `mutate()` aboneleri uyarır, topbar ve sayfa birlikte tazelenir.
- Askı göstergesi (`holdActive`) render'da `Date.now()` okumaz — saniyede bir tazelenen
  durumdur (React saflık kuralı, `react-hooks/purity`).

---

## Erişim kontrolü (RLS / role)

Faz 1'de yok (mock, tek kullanıcı). Faz 2'de `stream_profiles` tablosu `profile_id` bazlı
RLS ile korunacak; Free planda 1 profil kapısı `entitlements.limit("streamProfiles")`
üzerinden uygulanacak (PRD §10).

---

## Test senaryoları

`tests/profile-switcher.test.ts` — 19 test, tamamı yeşil:

1. Varsayılan set 10 profil üretir, her biri ayrı oyuna bağlıdır.
2. Oyun başına ayarlar gerçekten farklıdır (CS2 TTS kapalı, Sohbet açık; Minecraft %150).
3. `gameId` eşleşmesi başlık eşleşmesini ezer.
4. Başlıktan kelime eşleşmesi (büyük harf, Türkçe ek, aksan dayanıklı).
5. Kısaltmalar kelime sınırı olmadan eşleşmez (`"offline"` ≠ Free Fire).
6. Kullanıcının eklediği kelimeler de aranır.
7. Otomatik geçişe kapalı profil aday olmaz.
8. `disabled` / `manualHold` / `alreadyActive` / `dwell` / `noMatch` kararları.
9. Askı ve dwell süresi dolduğunda geçiş yeniden çalışır.

**Elle doğrulama:** `pnpm dev` → topbar profil düğmesi → profil seç (askı başlar) →
`/stream-profiles` → "Oyun sinyali" kartından oyun seç → "Sinyali gönder" → askı nedeniyle
geçmediği görülür; askı süresi 0 yapılınca geçiş anında olur.

---

## Bilinen sınırlamalar

1. Ayarların bir kısmı saklanır ama motora bağlı değil (yukarıdaki tablo).
2. Oyun kataloğu 10 sabit oyunla sınırlı; katalog dışı oyunlar "ek başlık kelimeleri"
   alanıyla çözülür.
3. Profiller eylem/etkinlik listelerini **izole etmez** — ayrışma ayar seti düzeyindedir
   (ADR-0006 "Alternatifler").
4. Sinyal Faz 1'de elle verilir; connector bağlantısı Faz 2.
5. Modül ikon rayında yer almaz (PRD §2 modül envanterini bozmamak için); erişim yalnız
   topbar değiştiricisindeki "Profilleri yönet" bağlantısıyla.

---

## Değişiklik geçmişi

| Tarih | Değişiklik |
|---|---|
| 2026-07-19 | İlk sürüm — 10 varsayılan profil, oyun bazlı otomatik geçiş, dinamik liste (ekle/kopyala/içe aktar/sil), topbar değiştiricisi, 19 birim testi (ADR-0006). |
