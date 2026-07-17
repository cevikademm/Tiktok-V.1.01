# 01 — Başlangıç (`start`)

- **PRD referansı:** §5.1 (Başlangıç — Ana Panel), §15.1-3 (kabul kriterleri)
- **Faz:** Faz 1 — uygulandı (mock veri; embed/medya alanları yer tutucu)
- **Modül `pageId`:** `start` (`lib/nav.ts:46-53`)

---

## Sekmenin amacı ve hedef kullanıcı

Uygulamanın açılış paneli. Yayıncıyı TikTok LIVE'a bağlanmaya yönlendirir, en sık
kullanılan üç modülü (TTS / Sesli Uyarılar / Eylemler ve Etkinlikler) tek tıkla
açılıp kapanabilir "Hızlı Erişim" kutuları hâlinde sunar; ajans rehberi, haberler,
Pro promosyonu, eğitim içerikleri ve SSS ile onboarding'i tamamlar.

**Hedef kullanıcı:** Uygulamaya yeni giren veya yayına başlamak üzere olan TikTok LIVE
yayıncısı (PRD §3 — ziyaretçi ve ücretsiz kullanıcı). Faz 0-1'de rol ayrımı yoktur
(bkz. *Erişim kontrolü*).

---

## Bağlı route, dosya yolları, bileşenler

| Katman | Yol |
|---|---|
| Route | `/{locale}/start` (varsayılan locale `tr` prefix'siz) |
| Sayfa | `app/[locale]/(app)/start/page.tsx` |
| Kabuk | `app/[locale]/(app)/layout.tsx:10` (topbar 54px + ray 64px + alt menü) |
| Bileşenler | `components/modules/start/*` |
| Gezgin | `components/layout/section-navigator.tsx:12` |

**Bileşen ağacı** (sayfa `app/[locale]/(app)/start/page.tsx:51-74`):

```
StartPage (Server Component)
├── DesktopPromo            components/modules/start/sections.tsx:19    (server)
├── WelcomeCard             components/modules/start/connection-card.tsx:68  ('use client')
├── ConnectionCard          components/modules/start/connection-card.tsx:14  ('use client')
├── Card #section-quick-access
│   └── QuickAccess         components/modules/start/quick-access.tsx:25     ('use client')
├── AgenciesSection         components/modules/start/sections.tsx:37    (server)
├── TiktokChannelSection    components/modules/start/sections.tsx:118   (server)
├── NewsSection             components/modules/start/sections.tsx:131   (server)
├── ProPromo                components/modules/start/sections.tsx:164   (server)
├── HowToSection            components/modules/start/sections.tsx:185   (server)
│   └── #section-how-to + #section-faq + About + Contact kartları
└── SectionNavigator        components/layout/section-navigator.tsx:12  ('use client')
```

**Bölüm kimlikleri** (`app/[locale]/(app)/start/page.tsx:38-49` — gezgin listesi ve DOM
`id`'leri birebir eşleşir; e2e testi bu 10 `id`'yi doğrular):

| # | `id` | Bileşen |
|---|---|---|
| 1 | `section-desktop` | `DesktopPromo` |
| 2 | `section-welcome` | `WelcomeCard` (yalnız offline'da render olur) |
| 3 | `section-connection` | `ConnectionCard` |
| 4 | `section-quick-access` | `QuickAccess` |
| 5 | `section-agencies` | `AgenciesSection` |
| 6 | `section-tiktok-channel` | `TiktokChannelSection` |
| 7 | `section-news` | `NewsSection` |
| 8 | `section-pro` | `ProPromo` |
| 9 | `section-how-to` | `HowToSection` |
| 10 | `section-faq` | `HowToSection` içindeki SSS kartı |

`SECTION_COUNTS.start = 10` (`lib/nav.ts:198`) — topbar breadcrumb rozeti bu sayıyı gösterir.

**Metadata:** `generateMetadata` (`app/[locale]/(app)/start/page.tsx:16-24`) başlığı
`start.title` anahtarından alır; hardcoded string yok (CLAUDE.md §5.2).

---

## API çağrıları ve veri şeması

> **Faz 0-1'de gerçek HTTP çağrısı YOKTUR.** Bu sayfa hiçbir `fetch`/Route Handler
> çağırmaz. Tüm veri erişimi `lib/data/ports.ts` interface'leri üzerinden gider;
> implementasyon `lib/data/mock/index.ts` (in-memory + localStorage, `LATENCY_MS = 80`
> ile sahte ağ gecikmesi — `lib/data/mock/index.ts:34-36`). Faz 2'de aynı imzalar
> `lib/data/supabase/` ile değiştirilecek (PRD §12; imza değişikliği ADR gerektirir —
> CLAUDE.md §7).

| Port çağrısı | Nerede | Ne yapar |
|---|---|---|
| `backend.settings.get()` | `components/modules/start/connection-card.tsx:23` | Kayıtlı TikTok kullanıcı adını okur; yoksa `/setup`'a yönlendirir |
| `connect(username)` → `backend.connection.connect()` | `connection-card.tsx:28`, port: `lib/data/ports.ts:87-92` | Bağlantı durum makinesini `connecting` → `live` yapar (1200 ms mock gecikme — `lib/data/mock/index.ts:302-311`) |
| `disconnect()` → `backend.connection.disconnect()` | `connection-card.tsx:41` | Durumu `disconnected`'a çeker |
| `mutate()` (port dışı, doğrudan mock store) | `components/modules/start/quick-access.tsx:31-34` | Hızlı Erişim toggle'ını yazar |

**İlgili Zod şemaları:**

| Şema | Dosya | Not |
|---|---|---|
| `connectionStateSchema` | `lib/schemas/live.ts:97-102` | `disconnected \| connecting \| live \| error` (PRD §12.4 durum makinesi) |
| `setupSettingsSchema` | `lib/schemas/settings.ts:107-117` | `tiktok.username` bu sayfadan okunur |

**Hızlı Erişim veri şekli** — Zod şeması değil, `MockState` alanı
(`lib/data/mock/store.ts:25`): `quickAccess: { tts: boolean; sounds: boolean; actions: boolean }`,
varsayılan üçü de `true` (`lib/data/mock/store.ts:59`).

**Statik (kod içine gömülü) veriler** — Faz 2'de porta taşınacak:
- Ajans marquee listesi: `sections.tsx:40` (`Nova, Aurora, Pulse, Vertex, Lumen, Orbit`)
- Live Channels kartları: `sections.tsx:193-202` — 8 kanal, **sabit** izleyici sayıları
  (SSG çıktısı deterministik olsun ve hidrasyon uyuşmazlığı olmasın diye; koddaki yorum
  `sections.tsx:191-192` bunu açıklar)
- Haber satırı anahtarları: `sections.tsx:134-145` (10 satır)
- SSS: 13 soru, `start.faq.q1..q13` / `start.faq.a1..a13` (`sections.tsx:188`, `sections.tsx:264-273`)

---

## State yönetimi

| Durum | Mekanizma | Kaynak |
|---|---|---|
| Hızlı Erişim toggle'ları | `useSyncExternalStore` üzerinden mock store aboneliği (`useMockStore()`) | `lib/data/mock/use-store.ts:14-16`, kullanım `quick-access.tsx:28` |
| Bağlantı durumu (`ConnectionState`) | `AppProvider` context'i (`useApp()`) — altında `backend.connection.subscribe()` | `components/providers/app-provider.tsx:45-117`, kullanım `connection-card.tsx:18` |
| Aktif bölüm (TOC) | `useState` + `IntersectionObserver` | `components/layout/section-navigator.tsx:18-38` |
| Gezgin daraltma | `useState` (kalıcı değil) | `section-navigator.tsx:19` |

**Kalıcılık:** Hızlı Erişim durumu mock store'un tek localStorage kaydında tutulur —
anahtar `livekit.mock.v1` (`lib/data/mock/store.ts:13`). `mutate()` her çağrıda yeni bir
kök nesne üretir; aksi hâlde `useSyncExternalStore` değişimi görmez
(`lib/data/mock/store.ts:118-127`).

**Neden `useEffect` + `setState` değil:** localStorage sunucuda yoktur; effect'te okuyup
setState etmek ilk boyada yanlış değeri gösterir ve cascading render'a yol açar. Bu yüzden
sunucu/hidrasyon pass'inde sabit referanslı `getServerSnapshot` kullanılır
(`lib/data/mock/store.ts:71`, `lib/data/mock/use-store.ts:6-13`).

**Kural motoru:** Bu sayfa motoru doğrudan kullanmaz, ancak `AppProvider` uygulama
düzeyinde tekil `RuleEngine` örneğini kurar (`lib/engine/singleton.ts:23-29`) — kuyruk ve
cooldown durumu React ağacının ömrüne bağlı olmamalıdır.

---

## Erişim kontrolü (RLS / role)

> **Faz 0-1'de kimlik doğrulama (auth) YOKTUR.** `app/[locale]/(auth)/login` route'u
> henüz mevcut değildir. Sayfa herkese açıktır; PRD §3'teki giriş kapısı
> ("Please sign in or create a free account to continue.") **uygulanmamıştır**.
> Supabase Auth, RLS ve oturum yönetimi **Faz 2** kapsamındadır (PRD §12.3).

| Kontrol | Faz 0-1 durumu | Faz 2+ hedefi |
|---|---|---|
| Kimlik doğrulama | Yok — sayfa doğrudan açılır | E-posta + Google OAuth (PRD §8) |
| RLS | Yok — Postgres yok, veri tarayıcının localStorage'ında | `profile_id` bazlı politika, her tabloda RLS (PRD §7) |
| Rol ayrımı (ziyaretçi/free/pro) | Yok — `entitlements.isPro()` mock `false` (`lib/data/mock/store.ts:61`) | Sunucu tarafı abonelik doğrulaması (Faz 7) |
| Pro gating görünürlüğü | `ProPromo` kartı herkese gösterilir; limit sayacı yok | Gerçek limit + upgrade akışı |

**Güvenlik notu:** Mock store'daki veri tarayıcıya aittir ve hiçbir yetkilendirmeden
geçmez. Bu, Faz 0-1 için kabul edilen bir durumdur (üretim verisi yok); Faz 2'de veri
Supabase'e taşındığında RLS zorunludur (CLAUDE.md §7).

---

## Test senaryoları

**E2E — `e2e/app.spec.ts`** (bu sekmeyi kapsayan testler):

| Test | Doğrulanan |
|---|---|
| `"start sayfası TR açılır ve 10 bölümün tamamı render olur"` (`e2e/app.spec.ts:9`) | "Hoş geldin!", "Hızlı Erişim", "Sıkça Sorulan Sorular" başlıkları + 10 bölüm `id`'sinin her birinin tam 1 kez bulunması |
| `"4 dilde de arayüz çevrilir, hardcoded string kalmaz"` (`e2e/app.spec.ts:33`) | `/start`→"Hoş geldin!", `/en/start`→"Welcome!", `/de/start`→"Willkommen!", `/es/start`→"¡Bienvenido!" |
| `"topbar ölçüleri ve bileşenleri PRD §4.3-4.4 ile uyumlu"` (`e2e/app.spec.ts:47`) | Topbar `height: 54px`, ray `width: 64px` + 10 link, "TikTok LIVE'a bağlanın" butonu, "Aramak" tetikleyicisi |
| `"⌘K arama overlay'i açılır ve modüle götürür"` (`e2e/app.spec.ts:64`) | `ControlOrMeta+k` → "Uygulamada ara" dialogu → "Kurmak" yazıp Enter → `/setup` |
| `"dil değişimi tüm UI'ı çevirir"` (`e2e/app.spec.ts:77`) | Hesap menüsü → "English" → `/en/start` + "Welcome!" |
| `"toggle durumu sayfa yenilendikten sonra korunur"` (`e2e/app.spec.ts:89`) | `#section-quick-access` ilk switch `aria-checked=true` → tıkla → `false` → `page.reload()` → hâlâ `false` (localStorage + hidrasyon) |
| `"/start — kritik/ciddi axe ihlali yok"` (`e2e/app.spec.ts:250`) | axe-core, `wcag2a/2aa/21a/21aa/22aa` etiketleri; `critical` + `serious` ihlal sayısı 0 |

**Birim testleri:** Bu sekmeye ait birim testi **yoktur**. `tests/engine.test.ts` yalnız
kural motorunu ve puan/seviye hesabını kapsar (bkz. `docs/sekmeler/03-eylemler-ve-etkinlikler.md`).

**Kapsanmayan:** Bağlan butonunun `/setup` yönlendirmesi (kullanıcı adı yokken),
"You are LIVE!" online varyantı, ajans marquee animasyonu, SSS akordeon açılışı ve
bölüm gezgininin `IntersectionObserver` davranışı test edilmemiştir.

---

## Bilinen sınırlamalar

1. **Gerçek TikTok bağlantısı yok.** "TikTok LIVE'a bağlanın" yalnız durum makinesini
   simüle eder: `disconnected → connecting → live`, 1200 ms `setTimeout` ile
   (`lib/data/mock/index.ts:302-311`). TikTok-Live-Connector sidecar'ı **Faz 2** (PRD §12.4).
2. **Embed alanları yer tutucu.** Resmi TikTok kanalı kartı (`sections.tsx:123`) ve
   "How to use?" YouTube alanı (`sections.tsx:208`) yalnız `min-h-[420px]` / `aspect-video`
   kutu + `common.loading` metni gösterir; gerçek embed yok. Video Tutorials grid'i boş
   `div`'lerden ibarettir (`sections.tsx:215-223`).
3. **Live Channels mock ve statik.** 8 kanal, sabit izleyici sayıları; "Live Channels (16054)"
   sayısı da sabit (`sections.tsx:226`). Gerçek veri Faz 2'de connector'dan gelecek.
4. **Ajanslar bölümü tamamen mock.** "Nova Agency", 2021, 1.2M etkileşim ve avatar
   yer tutucuları koda gömülüdür (`sections.tsx:51-96`). Ajans modülleri **Faz 7** (PRD §2).
5. **Navigasyonsuz CTA'lar.** "Profili görüntüle" (`sections.tsx:70`), "Tüm Ajansları Gör"
   (`sections.tsx:112`), masaüstü promosyon CTA'sı (`sections.tsx:28`), "View Details"
   (`sections.tsx:176`) ve haber satırlarındaki "eğitim linki" (`sections.tsx:155`)
   **link değil, statik `<span>`/`<p>`'dir** — hiçbir yere gitmez.
6. **"Klavye Kısayolu Ayarla" işlevsiz.** Buton render edilir ancak `onClick` yoktur
   (`quick-access.tsx:65-71`). Kısayol kaydı faz dışıdır.
7. **Hızlı Erişim toggle'ları yalnız görsel durum.** Değer localStorage'da kalıcıdır ama
   TTS/Sesler/Eylemler modüllerini gerçekten devre dışı bırakmaz — ilgili modüller
   sırasıyla Faz 3 ve Faz 1'dedir ve toggle'ı okumazlar.
8. **PRD §5.1 bölüm listesiyle küçük fark.** PRD 10 bölümü sayarken 4. sırada ayrı bir
   "Online durum (You are LIVE!)" bölümü listeler ve SSS'yi 10. bölümün alt parçası sayar.
   Kod ise online durumu `ConnectionCard` içinde birleştirip (`connection-card.tsx:31-46`)
   SSS'yi ayrı bir bölüm (`section-faq`) olarak sayar. Toplam yine 10'dur; gezgin ve
   `SECTION_COUNTS.start` tutarlıdır.
9. **`WelcomeCard` online'da kaybolur.** `connection === "live"` iken `null` döner
   (`connection-card.tsx:72`); bu durumda `#section-welcome` DOM'da bulunmaz ve bölüm
   gezginindeki bağlantı ölü kalır. E2E testi yalnız offline durumu doğruladığı için
   bunu yakalamaz.
10. **Kredi bakiyesi / Stream Profile switcher** topbar'a aittir; bu sekmenin kapsamında
    değildir ve mock'tur.

---

## Değişiklik geçmişi

| Tarih | Sürüm | Değişiklik | Faz |
|---|---|---|---|
| 2026-07-16 | 0.1.0 | Faz 0-1 ilk uygulama | Faz 1 |
