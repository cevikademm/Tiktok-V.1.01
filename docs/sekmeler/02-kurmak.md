# 02 — Kurmak (`setup`)

- **PRD referansı:** §5.2 (Kurmak — 14 Alt Bölüm), §10 (Pro tablosu), §15.4 (kabul kriterleri)
- **Faz:** Faz 1 — uygulandı (14 alt bölümün tamamı render olur; bağlantı testleri mock)
- **Modül `pageId`:** `setup` (`lib/nav.ts:54-62`)

---

## Sekmenin amacı ve hedef kullanıcı

Uygulamanın tek yapılandırma merkezi. Yayıncı buradan TikTok hesabını bağlar, puan
ekonomisini ve seviye eğrisini tanımlar, harici araçlara (OBS, Streamer.bot, Minecraft)
bağlantı kurar, ayarlarını içe/dışa aktarır ve gelişmiş/debug seçeneklerini yönetir.

**Hedef kullanıcı:** Kurulum yapan yayıncı (PRD §3 — ücretsiz ve Pro kullanıcı). Faz 0-1'de
rol ayrımı yoktur (bkz. *Erişim kontrolü*).

---

## Bağlı route, dosya yolları, bileşenler

| Katman | Yol |
|---|---|
| Route | `/{locale}/setup` |
| Sayfa | `app/[locale]/(app)/setup/page.tsx` |
| Bileşenler | `components/modules/setup/setup-sections.tsx` (14 bölümün tamamı tek dosyada) |
| Bölüm sırası (tek kaynak) | `lib/schemas/settings.ts:8-23` — `SETUP_SECTIONS` |
| Form şemaları | `lib/schemas/settings.ts` |
| Seviye hesabı | `lib/schemas/points.ts` — `levelTable()`, `levelForPoints()` |
| Gezgin | `components/layout/section-navigator.tsx:12` |

**Bölüm sırası enum'dan türer.** Sayfa gezgin başlıklarını `SETUP_SECTIONS.map()` ile üretir
(`app/[locale]/(app)/setup/page.tsx:46-49`), bölüm kartları ise aynı sırayla elle dizilir
(`setup/page.tsx:54-67`). DOM `id` deseni: `section-<key>`.

`SECTION_COUNTS.setup = 14` (`lib/nav.ts:199`) — topbar breadcrumb rozeti.

**Ortak yardımcı bileşen:** `ConnectionSection` (`setup-sections.tsx:289`) — OBS /
Streamer.bot / Minecraft bölümlerinin ortak "Test Bağlantısı" akışını (testing state,
`role="status"` sonuç satırı) sarmalar.

---

## API çağrıları ve veri şeması

> **Faz 0-1'de gerçek HTTP çağrısı YOKTUR.** Sayfa hiçbir `fetch`/Route Handler çağırmaz;
> hiçbir gerçek WebSocket/soket açılmaz. Tüm erişim `lib/data/ports.ts` → `SettingsRepo`
> interface'i üzerinden gider, implementasyon `lib/data/mock/index.ts:163-203`. Faz 2'de
> aynı imzalar `lib/data/supabase/` ile değiştirilecek (PRD §12; imza değişikliği ADR
> gerektirir — CLAUDE.md §7).

| Port çağrısı | Port imzası | Ne yapar |
|---|---|---|
| `backend.settings.get()` | `lib/data/ports.ts:54` | Tüm `SetupSettings`'i okur; her bölüm mount'ta çağırır |
| `backend.settings.patch(patch)` | `lib/data/ports.ts:55` | Kısmi güncelleme; mock'ta sığ merge (`lib/data/mock/index.ts:166-173`) |
| `backend.settings.test(target)` | `lib/data/ports.ts:57` | **Mock** bağlantı testi — `obs \| streamerbot \| minecraft` |
| `backend.settings.export()` | `lib/data/ports.ts:58` | Tüm mock state'i JSON string olarak döndürür |
| `backend.settings.import(json)` | `lib/data/ports.ts:59` | JSON'u `setupSettingsSchema` ile doğrulayıp yazar |
| `backend.settings.reset()` | `lib/data/ports.ts:60` | Tüm state'i varsayılana döndürür (`resetState()`) |
| `connect(username)` | `lib/data/ports.ts:89` | Bağlantı durum makinesi (`AppProvider` üzerinden) |

**Zod şemaları — `lib/schemas/settings.ts`:**

| Şema | Satır | Alanlar / varsayılanlar |
|---|---|---|
| `SETUP_SECTIONS` | `:8` | 14 bölüm anahtarı (alt menü sırasıyla birebir) |
| `tiktokAccountSchema` | `:27` | `username`: 1-24 char, `/^@?[A-Za-z0-9._]+$/`, `@` önekini `transform` ile kırpar |
| `pointsSystemSchema` | `:38` | `currencyName` "Puan", `pointsPerCoin` 1, `pointsPerShare` 5, `pointsPerChatMinute` 1 |
| `subscriberBonusSchema` | `:52` | `bonusRatePercent` 100 (0-1000) |
| `levelSettingsSchema` | `:57` | `pointsPerLevel` 50, `levelMultiplier` 1.2 (1-5) |
| `obsConnectionSchema` | `:67` | `ip` "127.0.0.1", `port` 4455, `password` "" |
| `streamerbotConnectionSchema` | `:74` | `address` "127.0.0.1", `port` 8080, `endpoint` "/" |
| `minecraftConnectionSchema` | `:81` | `mode` "fabric", `port` 4567 (PRD Ek A), `playerName`/`ip`/`password` |
| `advancedSettingsSchema` | `:91` | 6 boolean toggle + `tiktokLanguage` "en-US" |
| `debugSettingsSchema` | `:102` | `debugMode` false |
| `setupSettingsSchema` | `:107` | Yukarıdakilerin bileşimi — mock store'un `settings` alanı |
| `testResultSchema` | `:121` | `{ ok, messageKey, latencyMs? }` — `messageKey` i18n anahtarı, ham metin değil |

**RHF + Zod tip notu:** `.default()` kullanan şemalarda giriş tipi opsiyonel, çıkış tipi
zorunludur; bu yüzden `useForm<Input, unknown, Output>` üç tipli kullanılır
(`lib/schemas/settings.ts:45-49`, örnek `setup-sections.tsx:117-121`).

---

## State yönetimi

Merkezî bir form store'u **yoktur** — her bölüm kendi durumunu tutar. Üç desen kullanılır:

| Desen | Bölümler | Kaynak |
|---|---|---|
| RHF + `zodResolver`, `useEffect` ile `reset()` | TikTok Hesabı, Puan Sistemi, Seviye Ayarları | `setup-sections.tsx:43`, `:117`, `:207` |
| `useState` + `onBlur`/`onChange` ile `settings.patch()` | Abone Bonusu, OBS, Streamer.bot, Minecraft, Advanced, Debug | `setup-sections.tsx:170`, `:350`, `:395`, `:434`, `:697`, `:766` |
| Durumsuz (statik render) | Sıfırlama, Pro, Patreon, Hesabınız | `setup-sections.tsx:495`, `:524`, `:588`, `:604` |

| Paylaşılan durum | Mekanizma | Kaynak |
|---|---|---|
| `backend`, `connection`, `refresh` | `AppProvider` context'i (`useApp()`) | `components/providers/app-provider.tsx:45` |
| Toast bildirimleri | `useToast()` — `ToastProvider` (AppProvider içinde) | `app-provider.tsx:113` |
| Bağlantı başarı banner'ı | **Türetilmiş** — `connection === "live"`; ayrı state yok | `setup-sections.tsx:55` |
| Seviye tablosu | **Türetilmiş** — `watch()` + `levelTable()`; state değil | `setup-sections.tsx:220-222` |

**Kalıcılık:** Tüm ayarlar mock store'un tek localStorage kaydında (`livekit.mock.v1` —
`lib/data/mock/store.ts:13`). SSR sırasında salt-bellek başlangıç durumu kullanılır.

**Kaydetme davranışı tutarsız (bilinçli değil, bkz. sınırlamalar):** Puan Sistemi ve Seviye
Ayarları açık "Kaydet" butonu ister; bağlantı bölümleri her tuş vuruşunda `patch()` yazar
(`setup-sections.tsx:356-360`); Abone Bonusu `onBlur`'da yazar.

---

## Erişim kontrolü (RLS / role)

> **Faz 0-1'de kimlik doğrulama (auth) YOKTUR.** Sayfa herkese açıktır; PRD §3'teki giriş
> kapısı uygulanmamıştır. Supabase Auth, RLS ve oturum **Faz 2** kapsamındadır (PRD §12.3).

| Kontrol | Faz 0-1 durumu | Faz 2+ hedefi |
|---|---|---|
| Kimlik doğrulama | Yok | E-posta + Google OAuth (PRD §8) |
| RLS | Yok — veri tarayıcının localStorage'ında | `profile_id` bazlı politika (PRD §7) |
| "Hesabınız" bölümü | Tüm alanlar `—` (sabit) — oturum yok | User-ID / E-Mail / Signup Date gerçek değerler |
| Pro gating | Yalnız görsel tablo; `entitlements.isPro()` mock `false` | Sunucu tarafı abonelik doğrulaması (Faz 7) |
| Sırlar (OBS/MC parolaları) | **localStorage'da düz metin** | Vault / sunucu tarafı `integrations` tablosu (PRD §7) |

**Güvenlik notu:** OBS ve Minecraft parolaları `type="password"` alanlarına girilir ancak
mock store'a **şifrelenmeden** yazılır ve `settings.export()` çıktısında düz metin yer alır
(`lib/data/mock/index.ts:191`). Faz 0-1 için kabul edilmiştir (gerçek bağlantı yok, üretim
verisi yok); Faz 2'de sırlar Vault'a taşınmalıdır (PRD §7, §13).

---

## Test senaryoları

**E2E — `e2e/app.spec.ts`, `test.describe("Kurmak sayfası (PRD §15.4)")` (`:106`):**

| Test | Doğrulanan |
|---|---|
| `"14 alt bölümün tamamı render olur"` (`:107`) | `section-tiktokAccount`, `section-pointsSystem`, `section-subscriberBonus`, `section-levelSettings`, `section-obsConnection`, `section-streamerbotConnection`, `section-minecraftConnection`, `section-resetPoints`, `section-pro`, `section-patreon`, `section-account`, `section-importExport`, `section-advanced`, `section-debug` — her biri tam 1 kez |
| `"kullanıcı adı doğrulaması hatayı gösterir"` (`:130`) | `#tiktok-username`'e "geçersiz kullanıcı!" → "bağlanın" → "Geçersiz kullanıcı adı" görünür |
| `"mock Test Bağlantısı akışı sonuç döndürür"` (`:140`) | `#section-obsConnection` → "Test Bağlantısı" → `role="status"` içinde `/Bağlantı başarılı/` |
| `"seviye listesi üstel eğriyi gösterir"` (`:153`) | "Seviye listesini göster" → `#section-levelSettings table` görünür |
| `"/setup — kritik/ciddi axe ihlali yok"` (`:250`) | axe-core `wcag2a/2aa/21a/21aa/22aa`; `critical` + `serious` = 0 |

Ayrıca `"⌘K arama overlay'i açılır ve modüle götürür"` (`:64`) bu sekmeye yönlenir
("Kurmak" → `/setup`).

**Birim — `tests/engine.test.ts`, `describe("Seviye hesabı (PRD §5.2)")` (`:365`):**

| Test | Doğrulanan |
|---|---|
| `"0 puan = seviye 0"` (`:366`) | `levelForPoints(0, 50, 1.2) === 0` |
| `"üstel eğri: çarpan arttıkça seviye zorlaşır"` (`:370`) | `levelForPoints(50,50,1.2)===1`, `(49,…)===0`, çarpan 1.2 < çarpan 1.0 |
| `"seviye tablosu kümülatif toplamı doğru üretir"` (`:376`) | `levelTable(50, 1.0, 3)` kümülatif `[50, 100, 150]` |
| `"puanlar tamsayıdır (float yasak — PRD §7)"` (`:381`) | `levelTable(50, 1.2, 10)` tüm `required`/`cumulative` `Number.isInteger` |

**Kapsanmayan:** Import/Export akışı (dosya indirme/yükleme), bozuk JSON hata yolu,
`settings.reset()`, Advanced toggle'larının kalıcılığı, Streamer.bot/Minecraft test akışları
(yalnız OBS test edilmiştir) ve başarı banner'ının görünmesi test edilmemiştir.

---

## Alt Bölüm: TikTok Hesabınızı Bağlayın (`tiktokAccount`)

- **Bileşen:** `TiktokAccountSection` — `setup-sections.tsx:34`
- **DOM id:** `section-tiktokAccount` · `featured` kart (maroon çerçeve)
- **Alanlar:** `#tiktok-username` (required) — RHF + `tiktokAccountSchema`
- **Doğrulama:** `required` ve `invalidUsername` mesaj anahtarları
  (`lib/schemas/settings.ts:29-32`); hata metni `t("validation.<message>")` ile çevrilir
  (`setup-sections.tsx:68`)
- **Aksiyon:** "TikTok LIVE'a bağlanın" → `connect(values.username)` → durum makinesi
- **Başarı banner'ı:** `connection === "live"` iken `role="status"` ile gösterilir
  (`setup-sections.tsx:98-106`)
- **Link:** "How to find my username?" → `https://support.tiktok.com` (`setup-sections.tsx:81`)
- **Sınırlama:** PRD §5.2.1'deki *"Enter your own TikTok username!"* (kendi hesabın mı)
  kontrolü **yoktur** — kendi hesap doğrulaması oturum gerektirir (Faz 2).

## Alt Bölüm: Puan Sistemi (`pointsSystem`)

- **Bileşen:** `PointsSystemSection` — `setup-sections.tsx:112`
- **Alanlar:** `#currency-name`, `#per-coin`, `#per-share`, `#per-minute`
- **Şema:** `pointsSystemSchema` (`lib/schemas/settings.ts:38`) — hepsi `z.number().int()`,
  float yasak (CLAUDE.md §5.6)
- **Kaydetme:** açık "Kaydet" butonu → `settings.patch({ points })` → `setup.saved` toast'ı
- **Sınırlama:** Ayarlar kaydedilir ancak Faz 1'de **puan kazandıran bir akış yoktur** —
  `points` modülleri Faz 5'tir (`lib/nav.ts:113-118`). Değerler yalnız saklanır.

## Alt Bölüm: Abone Bonusu (`subscriberBonus`)

- **Bileşen:** `SubscriberBonusSection` — `setup-sections.tsx:166`
- **Alan:** `#bonus-rate` — çarpan yüzdesi (varsayılan 100, aralık 0-1000)
- **Kaydetme:** `onBlur` → `settings.patch({ subscriberBonus })` (butonsuz)
- **Sınırlama:** Bonus oranı hiçbir hesaba uygulanmaz (puan kazanımı Faz 5).

## Alt Bölüm: Seviye Ayarları (`levelSettings`)

- **Bileşen:** `LevelSettingsSection` — `setup-sections.tsx:201`
- **Alanlar:** `#points-per-level` (vars. 50), `#level-multiplier` (vars. 1.2, `step=0.1`)
- **"Seviye listesini göster":** `useState` ile açılır tablo; `aria-expanded` doğru
  (`setup-sections.tsx:255-262`)
- **Tablo:** `levelTable(pointsPerLevel || 50, multiplier || 1.2, 10)` — 10 satır, kolonlar
  Seviye / Gereken / Kümülatif (`setup-sections.tsx:222`, `:265-283`)
- **Canlı önizleme:** `watch()` ile form değerlerinden türetilir — kaydetmeden güncellenir.
- **Test:** `"seviye listesi üstel eğriyi gösterir"` (e2e) + 4 birim testi (yukarıda).

## Alt Bölüm: OBS Bağlantısı (`obsConnection`)

- **Bileşen:** `ObsSection` — `setup-sections.tsx:347` (`ConnectionSection` sarmalayıcısı)
- **Alanlar:** `#obs-ip` (vars. `127.0.0.1`), `#obs-port` (vars. **4455** — obs-websocket v5
  standardı; PRD port değeri vermez), `#obs-password` (`type="password"`)
- **Test akışı:** `settings.test("obs")` → 600 ms bekleme → `ip` doluysa
  `{ ok: true, latencyMs: 40-99 }`, değilse `{ ok: false }` (`lib/data/mock/index.ts:176-189`)
- **Sonuç sunumu:** `role="status"` + renk `--link-blue` / `--error` (`setup-sections.tsx:333-341`)
- **Sınırlama:** **Gerçek obs-websocket bağlantısı yoktur.** Test yalnız "alan dolu mu"ya
  bakar; parola/port doğrulanmaz. Gerçek entegrasyon PRD §9 → Faz 3+.

## Alt Bölüm: Streamer.bot Bağlantısı (`streamerbotConnection`)

- **Bileşen:** `StreamerbotSection` — `setup-sections.tsx:392`
- **Alanlar:** `#sb-address` (vars. `127.0.0.1`), `#sb-port` (vars. 8080), `#sb-endpoint` (vars. `/`)
- **Test:** `settings.test("streamerbot")` — `address` dolu mu (mock)
- **Sınırlama:** PRD §5.2.6'daki **kurulum linki yoktur**. Gerçek WebSocket yok.

## Alt Bölüm: Minecraft Bağlantısı (`minecraftConnection`)

- **Bileşen:** `MinecraftSection` — `setup-sections.tsx:431`
- **Alanlar:** `#mc-mode` (`fabric` | `servertap`), `#mc-player`, `#mc-ip`, `#mc-port`
  (vars. **4567** — ServerTap, PRD Ek A), `#mc-password`
- **Test:** `settings.test("minecraft")` — `ip` dolu mu (mock)
- **Sınırlama:** PRD §5.2.7'deki **indirme linkleri (Fabric mod / ServerTap plugin) yoktur**.
  Gerçek ServerTap REST çağrısı yok.

## Alt Bölüm: Sıfırlama Noktaları (`resetPoints`)

- **Bileşen:** `ResetPointsSection` — `setup-sections.tsx:495`
- **Butonlar:** "Kriterlere göre..." (outline, **işlevsiz** — `onClick` yok),
  "Tüm Puanları..." (danger) → `confirm()` → yalnız `setup.saved` toast'ı
- **Alan:** `#coupon` — Mobil Kupon kodu (kaydedilmez)
- **Sınırlama:** **Hiçbir puan gerçekten silinmez.** `points.removeTransaction()` portu var
  (`lib/data/ports.ts:83`) ama bu bölüm çağırmaz — puan modülleri Faz 5'tir.
  Onay için tarayıcı `confirm()` kullanılır (özel modal değil).

## Alt Bölüm: Pro (`pro`)

- **Bileşen:** `ProSection` — `setup-sections.tsx:524` · `featured` kart
- **Başlık:** `t("setup.sections.pro", { app: APP_NAME })` — marka parametrik
  (CLAUDE.md §8, `NEXT_PUBLIC_APP_NAME`)
- **Tablo:** PRD §10 birebir — 12 satır dizide (`setup-sections.tsx:527-540`) + 2 satır elle
  (`systemAccess`, `basicOverlays` — `:562-571`)
- **Fiyat:** `$19 / ay · $172 / yıl` (`setup-sections.tsx:580`)
- **Sınırlama:** "Yükselt" butonu **işlevsiz**; ödeme entegrasyonu Faz 7 (PRD §2).
  Değerler koda gömülü (`5`, `∞`, `25/gün`…) — Zod/enum kaynağı yok; `entitlements.limit()`
  tablosuyla (`lib/data/mock/index.ts:348-356`) **elle senkron tutulur**.

## Alt Bölüm: Patreon Connection (`patreon`)

- **Bileşen:** `PatreonSection` — `setup-sections.tsx:588`
- **İçerik:** durum satırı (`setup.patreon.notConnected` — sabit) + "Connect Patreon" butonu
- **Sınırlama:** Tamamen statik. OAuth yok (PRD §9 → Faz 7). Buton `onClick` içermez.

## Alt Bölüm: Hesabınız (`account`)

- **Bileşen:** `AccountSection` — `setup-sections.tsx:604`
- **İçerik:** `<dl>` — User-ID / E-Mail / Signup Date, **üçü de sabit `—`**
- **Butonlar:** "TikTok Login" (outline), "Çıkış yap" (ghost) — ikisi de `onClick` içermez
- **Sınırlama:** Auth **yoktur** (Faz 2). Bu bölüm oturum gelene kadar iskelettir.

## Alt Bölüm: Import / Export Settings (`importExport`)

- **Bileşen:** `ImportExportSection` — `setup-sections.tsx:630`
- **Export:** `settings.export()` → `Blob` → `a.download = "livekit-settings.json"`
  (`setup-sections.tsx:635-645`)
- **Import:** `<input type="file" accept="application/json">` (`sr-only`, `<label>` ile sarılı)
  → `settings.import(text)` → `setupSettingsSchema.parse()` → `refresh()`
- **Hata yolu:** bozuk JSON / şema uyuşmazlığı → `try/catch` → `setup.importExport.invalidFile`
  toast'ı, durum bozulmaz (`setup-sections.tsx:647-656`)
- **Sıfırla:** `settings.reset()` → `refresh()`
- **PRD farkı:** PRD §5.2.12 **JSZip + FileSaver** öngörür; kod düz `Blob` + `URL.createObjectURL`
  kullanır (zip yok, ek bağımlılık yok). Dışa aktarılan JSON **tüm mock state**'tir
  (`loadState()`), yalnız `settings` değil (`lib/data/mock/index.ts:191`); içe aktarma ise
  `parsed.settings ?? parsed` ile her iki şekli de kabul eder (`:194-195`).

## Alt Bölüm: Advanced Settings (`advanced`)

- **Bileşen:** `AdvancedSection` — `setup-sections.tsx:694`
- **Toggle'lar (6):** `serverSideConnection`, `openInNewWindow`, `localizedGiftNames`,
  `useDisplayNames`, `onlyFirstEmote`, `keystrokeQueue` (`setup-sections.tsx:711-718`)
- **Alan:** `#tiktok-lang` — `tiktokLanguage` (vars. `en-US`)
- **API Connectivity:** "Switch Server" / "Restore Server" butonları — **işlevsiz**
- **Yükleme durumu:** `adv === null` iken `return null` (`setup-sections.tsx:703`) — bölüm
  ilk boyada DOM'da yoktur, `settings.get()` çözülünce belirir
- **Sınırlama:** Toggle'lar kaydedilir ama **hiçbir davranışı değiştirmez** — ilgili
  özellikler (sunucu taraflı bağlantı, keystroke kuyruğu, hediye adı yerelleştirme)
  Faz 2+ kapsamındadır.

## Alt Bölüm: Debug Options (`debug`)

- **Bileşen:** `DebugSection` — `setup-sections.tsx:763`
- **Toggle:** "Enable Debug Mode" → `settings.patch({ debug: { debugMode } })`
- **Buton:** "Open TikTok LIVE" — **işlevsiz** (`onClick` yok)
- **Sınırlama:** Debug modu açılabilir ama hiçbir yerde okunmaz; debug çıktısı yok.

---

## Bilinen sınırlamalar

1. **Hiçbir bağlantı gerçek değil.** OBS / Streamer.bot / Minecraft "Test Bağlantısı"
   yalnız "ilgili alan dolu mu" kontrolü + 600 ms bekleme yapar
   (`lib/data/mock/index.ts:176-189`). Gerçek obs-websocket v5 / Streamer.bot WS /
   ServerTap REST entegrasyonu PRD §9 → Faz 3+.
2. **TikTok bağlantısı simülasyon.** `disconnected → connecting → live`, 1200 ms
   `setTimeout` (`lib/data/mock/index.ts:302-311`). Connector sidecar Faz 2.
3. **Auth yok.** "Hesabınız" bölümü sabit `—` gösterir; Çıkış/TikTok Login butonları işlevsiz.
4. **Sırlar düz metin.** OBS/Minecraft parolaları localStorage'da şifrelenmeden durur ve
   export JSON'unda görünür.
5. **Kaydetme davranışı bölümler arası tutarsız.** Puan Sistemi/Seviye → "Kaydet" butonu;
   OBS/Streamer.bot/Minecraft/Advanced → **her tuş vuruşunda** `patch()` (`:356-360`);
   Abone Bonusu → `onBlur`. Kullanıcı için öngörülemez; Faz 2'de tekilleştirilmeli.
6. **`settings.patch()` sığ merge yapar.** `{ ...s.settings, ...patch }`
   (`lib/data/mock/index.ts:169`) — iç içe kısmi patch (`{ obs: { port } }`) diğer OBS
   alanlarını **siler**. Bileşenler bunu tam nesne göndererek telafi eder
   (`setup-sections.tsx:357-359`), ancak port sözleşmesi `Partial<SetupSettings>` olduğu
   için bu bir tuzaktır.
7. **İşlevsiz butonlar:** "Kriterlere göre Puanları Sil", "Yükselt", "Connect Patreon",
   "TikTok Login", "Çıkış yap", "Switch/Restore Server", "Open TikTok LIVE".
8. **Eksik PRD öğeleri:** Streamer.bot kurulum linki (§5.2.6), Minecraft indirme linkleri
   (§5.2.7), *"Enter your own TikTok username!"* hatası (§5.2.1), JSZip tabanlı export (§5.2.12).
9. **Advanced/Debug ayarları okunmaz.** Kaydedilir ama hiçbir kod yolu bu bayrakları
   kontrol etmez.
10. **Pro tablosu iki yerde.** `ProSection` satırları (`:527`) ile `entitlements.limit()`
    tablosu (`lib/data/mock/index.ts:348`) ayrı ayrı tanımlıdır; tek kaynak yoktur.
11. **Puan/seviye ayarları tüketilmez.** Faz 1'de puan kazandıran/harcatan akış yoktur
    (Faz 5). `levelTable()` yalnız önizleme için kullanılır.

---

## Değişiklik geçmişi

| Tarih | Sürüm | Değişiklik | Faz |
|---|---|---|---|
| 2026-07-16 | 0.1.0 | Faz 0-1 ilk uygulama | Faz 1 |
