# 04 — Widget Yüzeyi: My Actions (`/widget/myactions`)

- **PRD referansı:** §5.4 (Katmanlar / Widget Galerisi), §6.3 (Widget Kanal Modeli), §8 (Sayfa Dışı Yüzeyler), §15.6 (kabul kriterleri)
- **Faz:** Faz 1 — **yalnız `myactions`** uygulandı; diğer 25 widget kayıtlı ama render edilmiyor
- **Not:** Bu bir SPA sekmesi **değil**, sayfa dışı bir render yüzeyidir (OBS browser source). CLAUDE.md §4 "sekme = dosya" kuralı gereği yine ayrı dosyada belgelenir.

---

## Sekmenin amacı ve hedef kullanıcı

OBS / TikTok LIVE Studio'ya **browser source** olarak eklenen, kromsuz ve şeffaf arka planlı
render yüzeyi. Kural motorundan geçip ekran kuyruğuna düşen eylem medyalarını (metin, görsel,
video, ses) sırayla oynatır. 8 bağımsız ekran vardır; her ekranın kendi FIFO kuyruğu,
maksimum uzunluğu ve heartbeat tabanlı online/offline durumu bulunur.

**Hedef kullanıcı:** Yayın yazılımını yapılandıran yayıncı. Sayfayı **insan doğrudan
görüntülemez** — OBS'in gömülü tarayıcısı (CEF) açar. Bu yüzden i18n, sidebar, topbar ve
locale segmenti yoktur.

---

## Bağlı route, dosya yolları, bileşenler

| Katman | Yol |
|---|---|
| Route | `/widget/{widgetId}` — **locale segmenti yok** (`app/[locale]` dışında) |
| Kabuk | `app/widget/layout.tsx:15` — kendi `<html>`/`<body>`'si, `bg-transparent`, `robots: noindex` |
| Sayfa | `app/widget/[widgetId]/page.tsx:12` (Server Component) |
| Render bileşeni | `components/widgets/myactions.tsx:27` (`'use client'`) |
| Widget envanteri | `lib/widgets/registry.ts:7-34` — 26 widget |
| Kural motoru | `lib/engine/` (`RuleEngine`, `ScreenQueues`) |
| Şemalar | `lib/schemas/widget.ts`, `lib/schemas/action.ts` |

**URL şeması** (PRD §5.4): `/widget/<widgetId>?cid=<channelId>&screen=1-8&preview=1`

| Parametre | İşleniyor mu | Nerede |
|---|---|---|
| `widgetId` (path) | ✅ `widgetMeta(widgetId)` → yoksa `notFound()` | `app/widget/[widgetId]/page.tsx:22-23` |
| `screen` | ✅ 1-8 aralığına klemplenir; geçersizse `1` | `page.tsx:38-42` |
| `preview` | ✅ `"1"` ise debug rozeti + demo akışı | `page.tsx:25`, `myactions.tsx:163-169` |
| `cid` | ❌ **okunmaz** (bkz. sınırlamalar) | — |

**Uygulanmamış widget davranışı:** `meta.implemented === false` ise OBS'de siyah ekran
yerine açık bir durum metni gösterilir: `"<widgetId>: not implemented yet"`
(`page.tsx:27-36`). Kayıtlı 26 widget'tan **yalnız `myactions`** `implemented: true`
(`lib/widgets/registry.ts:8`).

**URL üretimi:** `WidgetRepo.url()` (`lib/data/ports.ts:70`, mock: `lib/data/mock/index.ts:216-222`)
— `cid`'yi mock store'daki `channelId`'den ("demo-channel", `store.ts:60`) alır ve
`origin + /widget/<id>?cid=...&screen=N` üretir. Bu URL Overlay Screens tablosunda ve eylem
editöründe kopyalanabilir olarak gösterilir.

---

## API çağrıları ve veri şeması

> **Faz 0-1'de gerçek HTTP/WebSocket YOKTUR.** PRD §6.3'ün öngördüğü WS kanal modeli
> (SharedWorker, `cid` bazlı oda, `widgetSettings` push) **uygulanmamıştır**. Widget aynı
> tarayıcı sekmesindeki in-memory `RealtimeBus`'a abone olur — yani gerçek OBS senaryosunda
> (ayrı süreç) olay alamaz (bkz. sınırlamalar). Faz 2'de WS gateway eklenecek.

| Port çağrısı | Nerede | Ne yapar |
|---|---|---|
| `backend.actions.list()` | `myactions.tsx:86` | Motorun okuyacağı eylem listesi |
| `backend.events.list()` | `myactions.tsx:87` | Motorun okuyacağı kural listesi |
| `backend.screens.list()` | `myactions.tsx:88` | Ekran başına `maxQueueLength` |
| `backend.screens.update(screen, { online })` | `myactions.tsx:105`, `:111` | Mount'ta `true`, unmount'ta `false` |
| `backend.bus.subscribe(cb)` | `myactions.tsx:117` | Canlı olay akışı → `engine.dispatch()` |
| `backend.bus.publish(...)` | `myactions.tsx:166` | Yalnız `preview=1` demo akışı (6 sn'de bir hediye) |
| `backend.simulator.simulate("gift", { coins: 1 })` | `myactions.tsx:166` | Demo olayı üretir |

**Zod şemaları — `lib/schemas/widget.ts`:**

| Öğe | Satır | Not |
|---|---|---|
| `widgetIdSchema` | `:8-35` | **26 widget id** (PRD §5.4 envanterinin endpoint'i olan alt kümesi) |
| `widgetCategorySchema` | `:39-46` | `actions, feeds, counters, goals, games, graphics` |
| `widgetMetaSchema` | `:49-58` | `{ id, category, pro, implemented, params }` |
| `overlayScreenSchema` | `:62-68` | `screen` 1-8, `name`, `maxQueueLength` 1-100 (vars. 10), `online` |
| `widgetSettingsSchema` | `:75-89` | Font, boyut, renk, hue/saturation/grayscale, ses, süre — **kaydedilir ama bu widget okumaz** |
| `OVERLAY_FONTS` | `:93-130` | PRD §4.2'deki 35 Google Font kataloğu |
| `widgetInboundSchema` | `:137-156` | Sunucu → widget: `action`, `widgetSettings`, `stateSync`, `heartbeat` |
| `widgetOutboundSchema` | `:160-168` | Widget → sunucu: `status`, `actionDone` |

> **Protokol şemaları tanımlı ama kullanılmıyor.** `widgetInboundSchema` /
> `widgetOutboundSchema` PRD §6.3 sözleşmesini kodda sabitler; Faz 1'de hiçbir taşıma
> katmanı bunları serileştirmez. Faz 2'de WS gateway bu şemalarla konuşacak.

**Kuyruk yapısı** — `QueueItem` (`lib/engine/queue.ts:8-15`):
`{ queueId, actionId, userId, durationSec, skipOnNextAction, enqueuedAt }`.
`HEARTBEAT_TIMEOUT_MS = 10_000` (`lib/engine/queue.ts:22`).

---

## State yönetimi

| Durum | Mekanizma | Kaynak |
|---|---|---|
| `playing` (oynayan öğe) | `useState<Playing \| null>` | `myactions.tsx:34` |
| `queueLength` | `useState` — `pump()` içinde güncellenir | `myactions.tsx:35` |
| `fading` (`"in" \| "out"`) | `useState` | `myactions.tsx:36` |
| Motor örneği | `useRef<RuleEngine>` — **bu widget'a özel örnek** | `myactions.tsx:38`, kurulum `:95` |
| `actions` / `events` listeleri | `useRef` — motor bunları closure'dan okur | `myactions.tsx:39-40` |
| Kuyruk öğesi → tetikleyen olay | `useRef<Map<string, LiveEvent>>` — placeholder ikamesi için | `myactions.tsx:42` |
| `backend` | `useState` başlatıcısı (tek örnek) | `myactions.tsx:46` |

**`useEffectEvent` deseni:** `pump()` (`myactions.tsx:54-78`) yalnız effect/olay bağlamından
çağrılır, render'da değil. Böylece ref'lerdeki imperatif motor durumu güvenle okunur ve
fonksiyon effect bağımlılığı olmadığı için abonelikler her render'da yeniden kurulmaz
(kod yorumu `myactions.tsx:50-53`).

**Effect'ler:**

| Effect | Satır | Görev |
|---|---|---|
| Motor kurulumu + veri yükleme | `:81-113` | `Promise.all([actions, events, screens])` → `new RuleEngine(...)` → ilk heartbeat + `online: true`; cleanup'ta `online: false` |
| Olay veri yolu aboneliği | `:116-129` | `bus.subscribe()` → `engine.dispatch()` → bu ekrana düşen öğeleri `lastEventRef`'e yaz → `pump()` |
| Heartbeat | `:132-137` | `HEARTBEAT_TIMEOUT_MS / 2` = 5 sn'de bir `queues.heartbeat()` |
| Oynatma zamanlayıcısı | `:140-160` | `durationSec * 1000` sonra `dequeue()` + `setPlaying(null)`; `durationMs - fadeOutMs` anında fade-out |
| Demo akışı (`preview=1`) | `:163-169` | 6 sn'de bir sahte hediye olayı |

**Render:** `showText` → `renderPlaceholders(action.config.text, { event })`
(`myactions.tsx:172-174`, motor `lib/engine/placeholders.ts`). Opaklık ve geçiş süresi
`fadeInMs`/`fadeOutMs`'ten türetilir (`myactions.tsx:186-190`).

---

## Erişim kontrolü (RLS / role)

> **Faz 0-1'de kimlik doğrulama YOKTUR ve widget URL'si korumasızdır.**

| Kontrol | Faz 0-1 durumu | Faz 2+ hedefi |
|---|---|---|
| Kimlik doğrulama | Yok — URL'yi bilen herkes açar | Widget URL'leri tahmin edilemez olmalı: `cid` + **imzalı token** (PRD §13) |
| RLS | Yok — veri tarayıcının localStorage'ında | `profile_id` bazlı politika (PRD §7) |
| `cid` doğrulaması | **Yok** — parametre tümüyle yok sayılır | `cid` → kanal odası eşlemesi + yetki kontrolü |
| Arama motoru | `robots: { index: false, follow: false }` (`app/widget/layout.tsx:8`) | Aynı |
| Pro gating | `WidgetMeta.pro` bayrağı tanımlı (`registry.ts`) ama **kontrol edilmez** | Sunucu tarafı abonelik doğrulaması (Faz 7) |

**Güvenlik notu:** Faz 1'de widget yalnız kendi tarayıcı sekmesindeki localStorage'ı okuduğu
için pratik bir yetki sınırı ihlali yoktur — paylaşılan bir sunucu durumu yoktur. Ancak Faz 2'de
veri Supabase'e taşındığında `/widget/*` **kimlik doğrulaması olmayan bir yüzey** olarak
kalacaktır (OBS'te oturum yoktur); bu yüzden PRD §13'teki imzalı token gereksinimi
Faz 2'nin giriş koşuludur. `guvenlik-denetcisi` onayı gerekir.

---

## Test senaryoları

**E2E — `e2e/app.spec.ts`, `test.describe("Widget render (PRD §15.6)")` (`:234`):**

| Test | Doğrulanan |
|---|---|
| `"/widget/myactions şeffaf arka planla açılır ve kuyruk durumu görünür"` (`:235`) | `/widget/myactions?cid=demo-channel&screen=1&preview=1` → `/screen=1/` ve `/queue=/` rozetleri görünür |
| `"uygulanmamış widget açık durum bildirir"` (`:242`) | `/widget/wheel?cid=demo-channel` → `/not implemented yet/` |

**Birim — `tests/engine.test.ts`, `describe("ScreenQueues — ekran kuyrukları (PRD §6.2)")` (`:191`)**
(widget'ın dayandığı kuyruk mantığı):

| Test | Doğrulanan |
|---|---|
| `"maks uzunluk aşılınca reddeder"` (`:194`) | `maxQueueLength: 2` → 3. `enqueue` → `queueFull` |
| `"geçersiz ekran numarası reddedilir (1-8)"` (`:203`) | `screen` 0 ve 9 → `invalidScreen` |
| `"ekranlar bağımsız kuyruk tutar"` (`:209`) | Ekran 1'e eklenen öğe ekran 2'yi etkilemez |
| `"offline ekran requireOnline ile reddedilir, heartbeat sonrası kabul edilir"` (`:216`) | `screenOffline` → `heartbeat()` → `ok: true` |
| `"heartbeat zaman aşımından sonra ekran offline sayılır"` (`:225`) | `isOnline(1, 5000)` ✓, `isOnline(1, 20_000)` ✗ |
| `"FIFO sırası korunur"` (`:232`) | `dequeue()` sırası: `first`, `second` |
| `"skipOnNextAction: bekleyen atlanabilir öğe yeni öğe gelince düşer"` (`:240`) | `["playing", "skippable", "newest"]` → `["playing", "newest"]` |

Ayrıca `describe("renderPlaceholders (PRD §5.3)")` (`:253`) widget'ın metin ikamesini kapsar
(4 test) ve `describe("RuleEngine — uçtan uca sevk")` (`:280`) kuyruğa alma yolunu doğrular.

**Kapsanmayan:** Widget'ın gerçek medya render'ı (metin/görsel/video/ses DOM'a düştü mü),
fade-in/out zamanlaması, `screens.update({ online })` yazımı, heartbeat interval'i,
demo akışının kuyruğa öğe düşürmesi ve `screen` parametresinin klemplenmesi (ör. `?screen=99`)
**test edilmemiştir**. E2E testi yalnız debug rozetinin varlığını doğrular — bir eylemin
gerçekten oynatıldığını doğrulamaz.

---

## Bilinen sınırlamalar

1. **`cid` parametresi tümüyle yok sayılır.** PRD §5.4/§6.3 `cid` bazlı oda modeli öngörür;
   `page.tsx` bu parametreyi okumaz ve `MyActionsWidget`'a geçirmez. Widget hangi kanalı
   render edeceğini bilmez — her zaman yerel mock backend'i kullanır. **Faz 2'nin ön koşulu.**
2. **OBS'te çalışmaz (mimari sınır).** Widget `backend.bus`'a abone olur; bu bus
   `createBus()` ile üretilen **in-memory** bir `Set`'tir (`lib/data/mock/index.ts:326-337`)
   ve yalnız aynı JS bağlamında yaşar. OBS ayrı bir süreçte ayrı bir sayfa açacağı için
   uygulamadaki Event Simulator'dan **hiçbir olay alamaz**. Faz 1'de widget yalnız aynı
   sekmede (veya `preview=1` demo akışıyla) anlamlıdır. Gerçek WS gateway **Faz 2** (PRD §6.3).
3. **Widget kendi motor örneğini kurar.** `new RuleEngine(...)` (`myactions.tsx:95`) —
   uygulama sayfasındaki `getEngine()` singleton'ından (`lib/engine/singleton.ts`) **ayrıdır**.
   İki motor kuyruk paylaşmaz; Overlay Screens tablosundaki "kuyruk" ile widget'ın kuyruğu
   farklı nesnelerdir. Faz 2'de tek otorite (sunucu) olmalıdır.
4. **`widgetSettings` uygulanmaz.** `widgetSettingsSchema` (35 font, renkler, filtreler,
   ses seviyesi…) tanımlı ve `WidgetRepo.getSettings/saveSettings` portu mevcut, ancak
   `MyActionsWidget` **hiçbirini okumaz** — metin `text-5xl` sabit, renk yalnız
   `config.textColor`'dan gelir (`myactions.tsx:192-199`). PRD §5.4'ün "canlı ayar push'u"
   Faz 4.
5. **Yalnız 4 eylem tipi render edilir:** `showText`, `showImage`, `playVideoFile`,
   `playAudio` (`myactions.tsx:192-223`). `showAnimation` dâhil diğer 17 tip **çizilmez**
   (Lottie/animasyon altyapısı Faz 4).
6. **Medya blob URL'lerine bağlı.** Eylem editörü dosyaları `URL.createObjectURL()` ile
   saklar (`action-editor.tsx:93`); bu URL'ler **sayfa/süreç ömrüne bağlıdır**. Widget ayrı
   bir sekmede veya yenilemeden sonra açıldığında görsel/video/ses **yüklenmez**. Kalıcı
   depolama (Supabase Storage) Faz 2.
7. **`volume` yalnız sessize alma için kullanılır.** `<video muted={action.volume === 0}>`
   (`myactions.tsx:216`); `<audio>` öğesine ses seviyesi hiç uygulanmaz (`:222`). Slider
   0-100 değerini saklar ama 1-99 arası bir etki üretmez.
8. **25 widget uygulanmadı.** `registry.ts`'te kayıtlı ama `implemented: false`: `gifts`,
   `chat`, `activity-feed`, `viewercount`, `followercounter`, `topgifter`, `topliker`,
   `ranking`, `transactionviewer`, `userinfo`, `carousel`, `goal`, `countdowngoals`,
   `gcounter`, `lastx`, `timer`, `wheel`, `wheelofactions`, `cannon`, `firework`, `likes`,
   `christmasevent`, `songrequests`, `coindrop`, `quiz`. Faz 4-6 (PRD §2).
9. **Envanter PRD'den dar.** PRD §5.4 tablosu endpoint'i olmayan widget'ları da listeler
   (Coin Jar, Coin Match, Penalty Battle, Stream Buddies, Emojify, Falling Snow,
   Social Media Rotator, YN Memory, SubCatch, Guest Battle, Top Gift/Top Streak, Tiny Diny,
   Webcam Frames…). `widgetIdSchema` yalnız **26** endpoint'li widget'ı içerir — bu bilinçli
   bir kapsam daraltmasıdır, endpoint'i olmayanlar id alamaz.
10. **`params` metadata'sı kullanılmaz.** `WidgetMeta.params` (`screen`, `x`, `c`, `metric`)
    tanımlı ama `page.tsx` yalnız `screen`'i elle okur; `x`/`c`/`metric` işlenmez (ilgili
    widget'lar zaten Faz 4-5).
11. **`online` durumu yarış koşuluna açık.** Aynı ekran için iki widget açılırsa (ör. OBS +
    önizleme sekmesi), birinin unmount'u `online: false` yazarak diğerini yok sayar
    (`myactions.tsx:111`). Heartbeat motoru ekran başına tek örnek varsayar.
12. **`preview=1` demo akışı sabit.** 6 sn'de bir `coins: 1` (Rose) hediyesi üretir
    (`myactions.tsx:166`); tetiklenmesi için `gift_min` (minCoins ≤ 1) kuralı tanımlı olmalı
    — yoksa ekranda hiçbir şey görünmez, yalnız `queue=0` rozeti kalır.

---

## Değişiklik geçmişi

| Tarih | Sürüm | Değişiklik | Faz |
|---|---|---|---|
| 2026-07-16 | 0.1.0 | Faz 0-1 ilk uygulama (`myactions` render, 8 ekran kuyruğu, heartbeat) | Faz 1 |
