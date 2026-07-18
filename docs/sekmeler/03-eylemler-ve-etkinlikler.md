# 03 — Eylemler ve Etkinlikler (`actionsandevents`)

- **PRD referansı:** §5.3 (Otomasyon Çekirdeği), §6.1-6.2 (kural motoru), §15.5 (kabul kriterleri)
- **Faz:** Faz 1 — uygulandı (20 eylem tipi, 15 tetikleyici, 4 tablo, Event Simulator; mock veri)
- **Modül `pageId`:** `actionsandevents` (`lib/nav.ts:79-87`)

---

## Sekmenin amacı ve hedef kullanıcı

Uygulamanın otomasyon çekirdeği. Yayıncı burada **Eylem** (ne olacak?) ve **Etkinlik**
(ne tetikleyecek?) tanımlar, bunları çoktan çoğa bağlar, zamanlayıcı kurar, 8 overlay
ekranını yapılandırır ve Event Simulator ile canlı yayına girmeden test eder.

**Tanımlar** (CLAUDE.md §9): *Eylem* = tetiklenince olan şey (20 tip). *Etkinlik* =
tetikleyici kuralı (15 tip + 6 rol filtresi + koşullar). *Ekran* = 8 bağımsız overlay
kuyruğu.

**Hedef kullanıcı:** Yayınını otomatikleştirmek isteyen TikTok LIVE yayıncısı (PRD §3 —
ücretsiz kullanıcı 5 eylemle sınırlı, Pro sınırsız).

---

## Bağlı route, dosya yolları, bileşenler

| Katman | Yol |
|---|---|
| Route | `/{locale}/actionsandevents` |
| Sayfa (server) | `app/[locale]/(app)/actionsandevents/page.tsx` |
| Sayfa gövdesi (client) | `components/modules/actions/actions-page.tsx:34` |
| Eylem editörü | `components/modules/actions/action-editor.tsx:361` |
| Etkinlik editörü | `components/modules/actions/event-editor.tsx:175` |
| Kural motoru | `lib/engine/` (saf TypeScript — DOM/framework bağımlılığı yok) |
| Şemalar | `lib/schemas/action.ts`, `lib/schemas/event.ts`, `lib/schemas/live.ts`, `lib/schemas/widget.ts` |

Sayfa dosyası yalnız `setRequestLocale` + metadata yapar ve gövdeyi client bileşene devreder
(`app/[locale]/(app)/actionsandevents/page.tsx:16-24`) — tablo/modal etkileşimi client
gerektirir (CLAUDE.md §5.1).

**Sayfa yapısı** (PRD §5.3 sırası — `actions-page.tsx:382-497`):

```
ActionsAndEventsPage
├── "👈 Start here" + ana Enabled toggle       actions-page.tsx:385-388
├── Card #section-actions    → DataTable + Pro gating   :391-426
├── Card #section-events     → DataTable                :429-448
├── Card #section-timers     → DataTable + timerHint    :451-465
├── Card #section-screens    → DataTable (8 satır)      :468-478
├── Card #section-simulator  → 5 buton                  :481-497
├── ActionEditor  (Modal)                               :499-506
├── EventEditor   (Modal)                               :508-514
└── Timer editörü (Modal)                               :517-573
```

**Editör remount deseni:** Her iki editör de `key` ile açılışta sıfırdan monte edilir
(`actions-page.tsx:501`, `:509`) — böylece draft prop'tan bir kez türetilir ve
effect + setState senkronizasyonuna gerek kalmaz (`action-editor.tsx:375-383`).

---

## API çağrıları ve veri şeması

> **Faz 0-1'de gerçek HTTP çağrısı YOKTUR.** Sayfa hiçbir `fetch`/Route Handler çağırmaz;
> WebSocket yoktur. Tüm erişim `lib/data/ports.ts` interface'leri üzerinden gider;
> implementasyon `lib/data/mock/index.ts` (in-memory + localStorage). Faz 2'de aynı imzalar
> `lib/data/supabase/` ile değiştirilecek (PRD §12; imza değişikliği ADR gerektirir —
> CLAUDE.md §7).

| Port | İmza | Kullanım |
|---|---|---|
| `ActionsRepo` | `lib/data/ports.ts:22-30` | `list/get/create/update/remove/nameExists` |
| `EventsRepo` | `lib/data/ports.ts:32-39` | `list/create/update/remove/signatureExists` |
| `TimersRepo` | `lib/data/ports.ts:41-46` | `list/create/update/remove` |
| `ScreensRepo` | `lib/data/ports.ts:48-51` | `list/update` (ad, maks kuyruk, online) |
| `WidgetRepo.url()` | `lib/data/ports.ts:70` | `/widget/myactions?cid=<id>&screen=N` üretir |
| `EventSimulator` | `lib/data/ports.ts:101-113` | Sahte `LiveEvent` üretir |
| `RealtimeBus` | `lib/data/ports.ts:95-98` | `publish/subscribe` — widget'lara yayın |
| `EntitlementsService.limit()` | `lib/data/ports.ts:116-127` | Pro gating (`actions` limiti) |

**Referans bütünlüğü:** Bir eylem silindiğinde mock adapter onu tüm etkinlik bağlantılarından
ve zamanlayıcılardan da düşürür (`lib/data/mock/index.ts:63-74`).

### Zod şemaları

**`lib/schemas/action.ts`:**

| Öğe | Satır | Not |
|---|---|---|
| `actionTypeSchema` | `:7-29` | **21 enum değeri** — adlar PRD ile birebir (sayım farkı için bkz. aşağıdaki not) |
| `HIDDEN_ACTION_TYPES` | `:33-36` | `playVideo` (deprecated), `setSnapCamEffect` (devre dışı) |
| `SELECTABLE_ACTION_TYPES` | `:38-39` | Görünür **19** tip = 21 − 2 gizli; e2e testi bu sayıyı doğrular |
| `ACTION_MEDIA_COLUMN` | `:42-49` | Tip → tablo kolonu: `showAnimation→animation`, `showImage→picture`, `playAudio→sound`, `playVideoFile→video` |
| `actionConfigSchema` | `:57-103` | Tip başına opsiyonel yapılandırma alanları |
| `SCREEN_MIN/MAX`, `screenSchema` | `:111-113` | 1-8 |
| `actionSchema` | `:115-139` | `durationSec` 5, `pointsDelta` **int** (float yasak), `volume` 50, cooldown'lar 0, fade 200 ms |
| `actionDraftSchema` | `:143` | `id` hariç — editör formu |

> **"20 eylem tipi" sayım notu.** PRD §5.3 tablosu **20 satır** listeler çünkü
> `addPoints` / `removePoints` tek satırda birleştirilmiştir ("Puan ekle / kaldır",
> radio çifti). Kod bunları ayrı enum değeri olarak tuttuğu için `actionTypeSchema`
> **21 değer** içerir. Gizli ikisi (`playVideo`, `setSnapCamEffect`) çıkınca editörde
> **19** seçilebilir tip görünür — e2e testi (`e2e/app.spec.ts:216-217`) tam olarak bunu
> doğrular. Yani "20 tip" ile "21 enum" çelişmez; farklı sayım birimleridir.

**`lib/schemas/event.ts`:**

| Öğe | Satır | Not |
|---|---|---|
| `triggerTypeSchema` | `:7-23` | **15 tetikleyici** — enum birebir (`invite` = Share) |
| `triggerWhoSchema` | `:27-34` | **6 rol**: `any, followers, subscribers, moderators, topgifter, specific_user` |
| `THIRD_PARTY_TRIGGER_ID` | `:42-54` | PRD §9 triggerTypeId haritası (1=Share … 13=FirstActivity) |
| `eventConditionsSchema` | `:60-87` | `command` (`/^[!/]\S+$/`), `minCoins`, `giftId`, `minLikes`, `emoteId`, `stickerId`, `productNameContains`, `topGifterCount`, `specificUsername`… |
| `REQUIRED_CONDITION` | `:91-101` | Hangi tetikleyici hangi koşulu zorunlu kılar |
| `eventSchema` | `:107-129` | 2 `.refine()`: en az 1 eylem bağlı (`noActionsLinked`) + zorunlu koşul (`conditionRequired`) |
| `eventSignature()` | `:136-147` | Tekrar tespiti — koşul sırasından bağımsız imza |
| `timerSchema` | `:153-158` | `intervalMinutes` 1-1440 |

**`lib/schemas/live.ts`:** `liveEventSchema` (`:35-66`) — connector payload şekli;
`PLACEHOLDERS` (`:73-90`) — PRD §5.3'teki 16 değişken birebir.

---

## State yönetimi

| Durum | Mekanizma | Kaynak |
|---|---|---|
| Ana "Enabled" toggle | `useLocalStorage` (`useSyncExternalStore`) — anahtar `livekit.actionsEnabled.v1` | `actions-page.tsx:30-40`, hook `lib/use-local-storage.ts:79` |
| `actions`, `events` | `AppProvider` context — `refresh()` ile yeniden çekilir | `app-provider.tsx:65-68` |
| `timers` | `AppProvider` context — `refresh()` ile yeniden çekilir (ADR-0005) | `app-provider.tsx` |
| `screens` | Yerel `useState` + mount'ta `backend.screens.list()` | `actions-page.tsx` |
| Editör açık/kapalı + düzenlenen kayıt | Yerel `useState` | `actions-page.tsx:44-49` |
| Editör draft'ı | `useState` başlatıcısı (prop'tan bir kez) + `key` remount | `action-editor.tsx:379`, `event-editor.tsx:190` |
| **Kuyruk / cooldown / dedup** | **`RuleEngine` singleton** — modül seviyesi, React ağacı dışında | `lib/engine/singleton.ts:16-29` |
| Toast'lar | `useToast()` | `components/ui/toast.tsx` |

**Neden motor singleton:** Kuyruk, cooldown ve dedup durumu oturum boyunca yaşamalıdır;
React ağacına bağlanırsa remount'ta sıfırlanır (`lib/engine/singleton.ts:5-13`). Motor güncel
eylem/etkinlik listesini `setEngineData()` ile alır; `AppProvider` bunu effect'ten çağırır
(`app-provider.tsx:57-63`) — render sırasında değil.

**Olay akışı** (`dispatch` — `app-provider.tsx:75-84`):

```
Simulator butonu → backend.simulator.simulate(kind) → LiveEvent
   → engine.dispatch(event)   (dedup → eşleştirme → cooldown → kuyruk)
   → backend.bus.publish(event)  → widget'lar (ayrı motor örneğiyle) dinler
```

**Kural motoru boru hattı** (`lib/engine/index.ts:62-127`):
`dedup.accept(ev.id)` → `matchEvents()` → `resolveActionIds()` → `enabled` kontrolü →
`cooldowns.canRun()` → combo tekrarı (`repeatWithCombos`) → `queues.enqueue()` →
`cooldowns.mark()`.

---

## Erişim kontrolü (RLS / role)

> **Faz 0-1'de kimlik doğrulama (auth) YOKTUR.** Sayfa herkese açıktır; giriş kapısı
> uygulanmamıştır. Supabase Auth, RLS ve oturum **Faz 2** kapsamındadır (PRD §12.3).

| Kontrol | Faz 0-1 durumu | Faz 2+ hedefi |
|---|---|---|
| Kimlik doğrulama | Yok | E-posta + Google OAuth (PRD §8) |
| RLS | Yok — `actions`/`events` tarayıcının localStorage'ında | `profile_id` bazlı politika (PRD §7) |
| Pro limiti (5 eylem) | **Yalnız istemci tarafı.** `entitlements.limit("actions")` → 5 (`lib/data/mock/index.ts:349`); UI butonu `disabled` yapar (`actions-page.tsx:396`) | Sunucu tarafı zorlama — istemci limiti bypass edilebilir |
| Rol filtresi (`who`) | Motor içinde uygulanır (`matchEvents`) — **ürün mantığı**, güvenlik sınırı değil | Aynı; olay kaynağı connector'dan gelecek |
| Webhook URL'si | `z.url()` ile doğrulanır (`lib/schemas/action.ts:81`) ama **çağrılmaz** | SSRF koruması + imza gerekir (PRD §13) |

**Güvenlik notu:** `triggerWebhook`, `simulateKeystroke`, `triggerMcCmd`,
`execThirdPartyAction` gibi eylem tipleri Faz 1'de **yalnız yapılandırma olarak saklanır,
çalıştırılmaz**. Bunlar çalıştırılmaya başlandığında (Faz 3+) SSRF, komut enjeksiyonu ve
keystroke güvenliği `guvenlik-denetcisi` incelemesi gerektirir (PRD §13).

---

## Test senaryoları

**E2E — `e2e/app.spec.ts`, `test.describe("Eylemler ve Etkinlikler (PRD §15.5)")` (`:161`):**

| Test | Doğrulanan |
|---|---|
| `"eylem oluşturma → etkinlik bağlama → simülatör zinciri çalışır"` (`:162`) | Boş durum ("Tanımlı eylem yok") → "Yeni Eylem Oluştur" → `#action-name`="Takip Uyarısı", `#cfg-text`="{username} takip etti!" → Kaydet → "Eylem kaydedildi!" + ad hücresi → "Yeni Etkinlik Oluştur" → "Takip" tetikleyicisi + ilk checkbox → Kaydet → "Etkinlik kaydedildi!" → "Takip Simüle Et" → `/etkinlik eşleşti/` |
| `"aynı adla ikinci eylem reddedilir"` (`:195`) | Aynı adla 2. kayıtta "Bu adda bir eylem zaten var" (PRD §5.3 tekrar hatası) |
| `"20 eylem tipi ve 15 tetikleyici seçilebilir durumda"` (`:211`) | Eylem editöründe `button[aria-pressed]` **19** adet (20 tip − `playVideo` deprecated − `setSnapCamEffect` devre dışı); etkinlik editöründe **15** |
| `"8 overlay ekranı ve widget URL'leri listelenir"` (`:225`) | `#section-screens tbody tr` = 8; `/\/widget\/myactions/` görünür |
| `"/actionsandevents — kritik/ciddi axe ihlali yok"` (`:250`) | axe-core `wcag2a/2aa/21a/21aa/22aa`; `critical` + `serious` = 0 |

**Birim — `tests/engine.test.ts`** (bu sekmenin çekirdeği; motor %100 saf TS):

*`describe("matcher — tetikleyici eşleştirme (PRD §6.2)")` (`:60`)*

| Test | Doğrulanan |
|---|---|
| `"gift_min: min coin eşiğinin altındaki hediye tetiklemez"` (`:61`) | `coins:4` < `minCoins:5` → 0 eşleşme |
| `"gift_min: eşiğe eşit veya üstü tetikler"` (`:66`) | `coins:5` ve `coins:500` → 1 eşleşme |
| `"gift_min: combo sürerken (repeatEnd=false) tetiklemez"` (`:71`) | Combo bitmeden eylem tetiklenmez |
| `"pasif kural hiç eşleşmez"` (`:75`) | `active:false` → 0 |
| `"olay tipi tetikleyiciyle uyuşmazsa eşleşmez…"` (`:80`) | `follow` olayı `gift_min` kuralını tetiklemez |
| `"command: yalnız tam komut eşleşir"` (`:84`) | `!spin` ✓, `!SPIN` ✓ (case-insensitive), `!spinner` ✗, `lütfen !spin` ✗, `undefined` ✗ |
| `"command: takım seviyesi eşiği uygulanır"` (`:92`) | `minTeamLevel:3` → level 2 ✗, level 3 ✓ |
| `"rol filtresi: subscribers yalnız aboneleri geçirir"` (`:100`) | `who:"subscribers"` |
| `"rol filtresi: topgifter yalnız izin verilen sayıdaki top gifter'ı geçirir"` (`:108`) | `topGifterCount:2` → 3. sıradaki ✗ |
| `"rol filtresi: specific_user @ önekinden bağımsız eşleşir"` (`:115`) | `@ayse_kaya` = `ayse_kaya` |
| `"first_activity: yalnız ilk aktivitede tetiklenir"` (`:120`) | `isFirstActivity` bayrağı |
| `"resolveActionIds: 'hepsi' + 'rastgele birini' birleşir"` (`:126`) | `["a1","a2"]` + random index 1 → `["a1","a2","r2"]` |

*`describe("eventSignature — tekrar tespiti (PRD §5.3)")` (`:134`)*: koşul sırası imzayı
değiştirmez (`:135`); farklı rol farklı imza üretir (`:141`).

*`describe("CooldownTracker (PRD §6.2)")` (`:150`)*: global cooldown (`:151`), kullanıcı
cooldown'ı yalnız o kullanıcıyı engeller (`:158`), cooldown 0 hiç engellemez (`:165`).

*`describe("EventDeduplicator — idempotency (PRD §6.2)")` (`:172`)*: aynı olay id'si iki kez
kabul edilmez (`:173`); kapasite dolunca en eski kayıt düşer — bellek sızıntısı yok (`:179`).

*`describe("ScreenQueues — ekran kuyrukları (PRD §6.2)")` (`:191`)*: maks uzunluk aşımı →
`queueFull` (`:194`); geçersiz ekran (0, 9) reddedilir (`:203`); ekranlar bağımsız kuyruk
tutar (`:209`); offline ekran `requireOnline` ile reddedilir, heartbeat sonrası kabul edilir
(`:216`); heartbeat zaman aşımı sonrası offline (`:225`); FIFO sırası korunur (`:232`);
`skipOnNextAction` bekleyen öğeyi düşürür (`:240`).

*`describe("renderPlaceholders (PRD §5.3)")` (`:253`)*: olay alanları yerleşir (`:254`);
bilinmeyen placeholder olduğu gibi kalır (`:261`); büyük/küçük harf duyarsız (`:267`);
puan/seviye bağlamı yerleşir (`:271`).

*`describe("RuleEngine — uçtan uca sevk (PRD §6.1)")` (`:280`)*: eşleşen olay kuyruğa alır
(`:291`); tekrar eden olay yutulur (`:301`); devre dışı eylem kuyruğa girmez (`:312`);
cooldown içindeki eylem girmez (`:320`); `repeatWithCombos` combo sayısı kadar ekler (`:329`);
kapalıyken tek kez (`:335`); kuyruk dolduğunda `rejected`/`queueFull` (`:341`); eylem kendi
ekranının kuyruğuna gider (`:354`).

**Zamanlayıcı (ADR-0005):** `tests/timer-runner.test.ts` (aralık/uzlaşım/başlat-durdur),
`tests/engine.test.ts` → `fireAction` (eşleştirmesiz çalıştırma, ekran yönlendirme,
queueFull, cooldown bypass), `tests/overlay-hub.test.ts` → timer teslimatı (abone bağlıyken
eylem ilgili ekrana push edilir; abone gidince durur).

**Kapsanmayan:** Eylem düzenleme (edit) UI'ı, silme onayı, "Action executed!" butonu, ekran
adı/maks kuyruk düzenleme, URL kopyalama, `signatureExists` tekrar hatası (etkinlik için),
ana Enabled toggle'ının kalıcılığı ve 20 tipin **yapılandırma alanları** test edilmemiştir.

---

## Bilinen sınırlamalar

1. **Gerçek TikTok olayı yok.** Tüm olaylar Event Simulator'dan veya demo akışından gelir
   (`lib/data/mock/simulator.ts:71-112`). Connector sidecar **Faz 2** (PRD §12.4).
2. **Eylemlerin çoğu çalıştırılmaz — yalnız yapılandırılır.** Faz 1'de sadece `showText`,
   `showImage`, `playVideoFile`, `playAudio` widget'ta render edilir
   (`components/widgets/myactions.tsx:192-223`). `speakText` (TTS), `sendText` (chatbot),
   `switchObsScene`, `activateObsSource`, `triggerWebhook`, `triggerMcCmd`,
   `simulateKeystroke`, `execThirdPartyAction`, `controlCustomGoal`, `setVoicemodVoice`,
   `setStreamerbotAction`, `controlTimer`, `addPoints`, `removePoints` **hiçbir yan etki
   üretmez** — ilgili modüller Faz 3-6'dadır.
3. **`showAnimation` render edilmez.** Editörde seçilebilir ve `animationId` saklanır
   (`action-editor.tsx:99-113`) ama widget bu tipi işlemez.
4. **`pointsDelta` puan defterine yazılmaz.** Editörde girilir ve tabloda gösterilir ama
   `points.addTransaction()` çağrılmaz — puan modülleri Faz 5.
5. **"Screen is offline!" toast'ı pratikte tetiklenmez.** Motor `requireOnlineScreen`
   seçeneğini destekler (`lib/engine/index.ts:28`, `:108`) ancak `getEngine()` singleton'ı
   bunu **ayarlamaz** (`lib/engine/singleton.ts:24-28`) — sayfa tarafında yalnız `queueFull`
   reddi gerçekleşebilir. Toast kodu her iki dalı da kapsar (`actions-page.tsx:363-374`).
   Bu PRD §5.3 ile bir tutarsızlıktır; Faz 2'de bayrak açılmalıdır.
6. **Sayfadaki motor ile widget'taki motor ayrı örneklerdir.** Sayfa `getEngine()`
   singleton'ını (`app-provider.tsx:55`), widget ise `new RuleEngine(...)` ile kendi
   örneğini kurar (`myactions.tsx:95`). Kuyruklar paylaşılmaz; ortak nokta yalnız
   `backend.bus`. Simülatör butonu olayı hem sayfa motoruna hem bus üzerinden widget
   motoruna verir — bu yüzden **olay iki kez, iki ayrı kuyrukta işlenir** (dedup örnek
   başına olduğu için engellemez). Faz 2'de tek WS gateway ile birleştirilmelidir (PRD §6.3).
7. **Ana "Enabled" toggle'ı yalnız görseldir.** Kapalıyken kartlar soluklaşır
   (`opacity-60`) ve simülatör butonları `disabled` olur (`actions-page.tsx:490`), ancak
   motor durdurulmaz — `bus`'tan gelen olaylar (ör. widget `preview=1` akışı) işlenmeye
   devam eder.
8. ~~**Timer'lar çalışmaz.**~~ **ÇÖZÜLDÜ (ADR-0005).** Zamanlayıcılar artık overlay
   runtime'ında (SSE hub + connector) çalışır: yayın canlıyken (hub'da abone / connector'da
   upstream) her `intervalMinutes` dakikada bir bağlı eylem `RuleEngine.fireAction` ile
   ilgili ekrana tetiklenir. Taşıma: `overlay_configs.timers` (JSONB) → `useOverlaySync` →
   `/api/overlay/register`. Çalıştırıcı `lib/overlay/timer-runner.ts` (saf TS, test edilir).
   Eylem düzenleme/aktif-toggle UI'ı eklendi. Kalan sınır: timer atışlarında cooldown
   uygulanmaz (aralık tek hız sınırıdır) ve placeholder'larda kullanıcı alanları boş çözülür
   (`systemLiveEvent`).
9. **Ekran `online` durumu yalnız widget açıkken.** `screens.list()` `online: false`
   varsayılanıyla gelir (`lib/data/mock/store.ts:35`); widget mount olduğunda `true`,
   unmount'ta `false` yazar (`myactions.tsx:105`, `:111`). Aynı sekmede widget açık
   değilse tablo hep "Offline" gösterir ve **tablo canlı yenilenmez** (`screens` yerel
   state, mount'ta bir kez okunur).
10. **Pro limiti istemci tarafında.** 5 eylem sınırı yalnız butonu `disabled` yapar
    (`actions-page.tsx:396`); `backend.actions.create()` limiti **doğrulamaz**.
11. **Hediye kataloğu statik.** `gift_specific` seçicisi mock `GIFT_CATALOG`'u kullanır
    (11 hediye — `lib/data/mock/simulator.ts:21-33`, PRD Ek A coin değerleri birebir).
    PRD §5.3'ün öngördüğü "API'den bölgesel katalog" Faz 2.
12. **Sticker/emote seçicileri ham metin alanı.** PRD §5.3 sticker modalı (Partner + Global
    grid) ve emote seçici öngörür; kod düz `<input>` ile `stickerId`/`emoteId` ister
    (`event-editor.tsx:136-157`).
13. **Medya yüklemesi kalıcı değil.** Dosyalar `URL.createObjectURL()` ile blob URL'ine
    çevrilir (`action-editor.tsx:93`); sayfa yenilenince **URL geçersizleşir** ve medya
    kaybolur. Supabase Storage Faz 2.
14. **PRD'de olmayan kolon:** Actions ve Events tablolarına PRD §5.3 listesinde bulunmayan
    bir `rowActions` (düzenle/çalıştır/sil) kolonu eklenmiştir (`actions-page.tsx:103`,
    `:190`) — kullanılabilirlik için gerekli, PRD'den sapma olarak kaydedilir.
15. **"Action executed!" butonu sahte.** Yalnız toast gösterir; eylemi gerçekten
    çalıştırmaz (`actions-page.tsx:122-125`).
16. **Onaylar tarayıcı `confirm()`'ü.** Silme onayları özel modal yerine `confirm()`
    kullanır (`actions-page.tsx:132`, `:211`) — PRD §4 tasarım sistemine ve a11y focus-trap
    hedefine uymaz.
17. **Etkinlik editöründe koşul doğrulaması eksik.** `eventSchema`'nın `conditionRequired`
    refine'ı (`lib/schemas/event.ts:123-128`) editörde **çalıştırılmaz** — `save()` yalnız
    "en az 1 eylem bağlı" ve imza tekrarını kontrol eder (`event-editor.tsx:210-221`).
    Örneğin `gift_min` koşulsuz kaydedilebilir.

---

## Değişiklik geçmişi

| Tarih | Sürüm | Değişiklik | Faz |
|---|---|---|---|
| 2026-07-16 | 0.1.0 | Faz 0-1 ilk uygulama | Faz 1 |
| 2026-07-18 | 0.2.0 | Zamanlayıcı çalıştırıcısı (ADR-0005): timer'lar canlıyken ateşlenir; `overlay_configs.timers`, `RuleEngine.fireAction`, `timer-runner`, timer düzenleme UI | Faz 1.5 |
