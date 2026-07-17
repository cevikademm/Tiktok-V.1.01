# PRD — LiveKit (TikFinity Klonu)

> **Ürün Gereksinim Dokümanı (Product Requirements Document)**
> Sürüm: 1.0 · Tarih: 2026-07-15 · Sahip: urun-yoneticisi + orkestrator
> Kaynak: `tikfinity.zerody.one` v1.70.1 birebir analizi (3 kayıtlı sayfa + canlı site araştırması)

---

## 0. Yönetici Özeti

TikTok LIVE yayıncıları için **TikFinity'nin birebir klonu** olan bir web uygulaması geliştirilecek. Uygulama; sesli uyarılar, TTS (metin okuma), etkileşimli overlay'ler (OBS/TikTok LIVE Studio kaynakları), chatbot, izleyici puan ekonomisi, mini oyunlar ve oyun entegrasyonlarını (Minecraft, GTA 5) TikTok LIVE olaylarıyla (hediye, beğeni, takip, paylaşım, abonelik…) tetikler.

- **Hedef:** TikFinity v1.70.1'in görsel ve işlevsel birebir kopyası (piksel düzeyinde UI, aynı modül seti).
- **Veri bağlantısı:** İlk fazlarda **mock/adapter katmanı** ile; gerçek TikTok bağlantısı ve Supabase şeması sonraki fazda takılacak (bkz. §12).
- **Dil desteği:** TR / EN / DE / ES (next-intl, ICU MessageFormat) — mimari 12+ dile hazır.
- **Geliştirme yöntemi:** VS Code + Claude Code, `.claude/agents/` altındaki çok-ajanlı ekip (orkestrator yönetiminde).

---

## 1. Teknoloji Yığını (KESİN KARAR)

| Katman | Teknoloji | Not |
|---|---|---|
| Framework | **Next.js 15+ (App Router)** + React 19 + TypeScript strict | Orijinal Vue 3'tür; klon React ile yeniden yazılır |
| Stil | **Tailwind CSS v4** + shadcn/ui + CSS değişkenli tema token'ları | Orijinaldeki Tailwind arbitrary değerleri token'a çevrilir |
| İkonlar | Font Awesome 6 (ücretsiz set) veya Lucide eşlemesi | Orijinal FA Pro kullanır; birebir eşleme tablosu §4.5 |
| Veri/BaaS | **Supabase** (Postgres + RLS + Auth + Realtime + Storage + Edge Functions) | Faz 2'de bağlanır; Faz 0-1 mock adapter |
| Gerçek zaman | Supabase Realtime (Broadcast/Presence) + gerekirse ayrı **Node.js WS servisi** | Widget'lar için Socket.IO benzeri kanal modeli |
| TikTok bağlantısı | **TikTok-Live-Connector** (zerodytrash, MIT) — Node.js sidecar servis | Orijinalin de kullandığı kütüphane |
| Form/Şema | React Hook Form + **Zod** (schema-first, FE/BE paylaşımlı) | |
| Tablolar | TanStack Table (DevExtreme datagrid yerine) | Kolon yapıları §7.4 |
| State | Zustand (UI) + TanStack Query (server state) | |
| i18n | **next-intl** — TR (varsayılan), EN, DE, ES | ICU plural/select; §11 |
| Test | Vitest + Playwright + Testing Library + MSW + axe | |
| Paket | pnpm | |
| Deploy | Vercel (web) + Fly.io/Railway (WS + connector sidecar) | |
| Gözlemlenebilirlik | Sentry + OTel | |

**Mimari şema:**

```
[Tarayıcı SPA (Next.js)] ──HTTP──> [Next.js Route Handlers /api/*]
        │                                    │
        │ WebSocket (widget kanalları)       ├──> [Supabase: Auth/DB/RLS/Storage]
        ▼                                    │
[WS Gateway (Node)] <──events── [Connector Servisi: TikTok-Live-Connector]
        │                                    ▲
        ▼                                    │ @kullaniciadi ile bağlanır
[OBS Browser Source /widget/*]        [TikTok Webcast (resmi olmayan)]
```

---

## 2. Ürün Kapsamı — Modül Envanteri

Orijinal uygulamanın **29 modülü** (SPA `data-pageid` kayıt defterinden birebir):

`start, setup, obsoverlays, obsdocks, sounds, actionsandevents, goals, countdowngoals, followercounter, giftoverlays, graphicoverlays, lastx, chatcommands, chatbot, tts, user, transactions, songrequests, likeathon, timer, wheel, coindrop, rtmpgen, challenge, halving, dapi, agencyregistry, agencyapplications, christmasevent`

### Faz kapsamı

| Faz | Modüller | Durum |
|---|---|---|
| **Faz 0** | Proje iskeleti, tema, layout (sidebar+topbar), i18n altyapısı, mock adapter | MVP temel |
| **Faz 1** | `start`, `setup`, `actionsandevents` (3 kayıtlı sayfanın birebir klonu) | MVP |
| **Faz 2** | Supabase şeması + Auth + gerçek TikTok connector + `dapi` (Event API) | Veri bağlantısı |
| **Faz 3** | `sounds`, `tts`, `chatbot`, `chatcommands` | Ses/sohbet |
| **Faz 4** | `obsoverlays` (widget galerisi) + widget render altyapısı (`/widget/*`) + `obsdocks` | Overlay |
| **Faz 5** | `user`, `transactions`, `goals`, `countdowngoals`, `followercounter`, `lastx`, `giftoverlays`, `graphicoverlays` | Puan + hedefler |
| **Faz 6** | `wheel`, `coindrop`, `timer`, `likeathon`, `challenge`, `halving`, `songrequests`, `rtmpgen` | Oyunlar/araçlar |
| **Faz 7** | Pro/ödeme, `agencyregistry`, `agencyapplications`, `christmasevent` | Monetizasyon |
| **Faz 8** | Masaüstü sarmalayıcı (Electron, `ws://localhost:21213` Event API), üçüncü taraf API | Genişleme |

---

## 3. Kullanıcı Rolleri ve Hesap

- **Ziyaretçi:** Giriş yapmadan sayfaları görür; her modülde giriş kapısı: *"Please sign in or create a free account to continue. (Required!)"* — butonlar: **"E-posta ile Giriş Yapın veya Kaydolun"**, **"Google ile Giriş Yapın veya Kaydolun"** + ToS/Privacy dipnotu.
- **Ücretsiz kullanıcı:** Limitli özellikler (bkz. §10 gating tablosu).
- **Pro kullanıcı:** Tüm limitler açık.
- **Ajans üyesi:** İndirimli Pro + ajans portalı bağlantısı.

Hesap alanları (Setup > Hesabınız): `User-ID`, `E-Mail`, `Signup Date`, "Çıkış yap" butonu, TikTok Login/Logout.
**Stream Profiles:** Kullanıcı başına çoklu profil (Free: 1, Pro: 10) — topbar'dan emoji avatarlı switcher ("Stream Profile 1", 🌹).

---

## 4. Tasarım Sistemi (Piksel Düzeyi Spec)

### 4.1 Tema — Koyu (tek tema)

| Token | Hex | Kullanım |
|---|---|---|
| `--primary` | `#D43555` | Marka kırmızısı, ana butonlar |
| `--primary-dark` | `#661525` / `#570D1C` | Buton alt gölge katmanı |
| `--accent` | `#EF3F62` | Bildirim rozeti, "Disconnected" durumu |
| `--tiktok-red` | `#FE2C55` | Vurgu |
| `--sidebar-bg` | `#2E1F22` | Sol ikon rayı |
| `--topbar-bg` | `#343333` | Üst bar (+ sol `rgba(212,53,85,0.14)` kırmızı degrade) |
| `--surface-1..4` | `#1C1C1C`, `#212121`, `#222222`, `#2A2A2A`, `#303030` | Kart/panel yüzeyleri |
| `--border-maroon` | `#92223E` | Öne çıkan kart çerçevesi |
| `--border-soft` | `#3F3F3F`, `white/8` | Standart çerçeve/ayraç |
| `--heading-blue` | `#37A1DC` / `#42A9FF` | Bölüm başlıkları |
| `--link-blue` | `#53AFDF`, `#359BD4` | Linkler, hover |
| `--discord` | `#4D6BEE` | Discord ikonu |
| `--warning` | `#FDB100` | Trial banner |
| `--success-banner` | `#2D4B2E` | Yıllık yükseltme banner'ı |
| `--error` | `#DA5454`, `#E73C3C` | Hata metinleri |
| `--news-bg` | `#122531` | Haber kartı |
| `--pro-gradient` | `linear-gradient(45deg,#591650 0%,#162C5F 50%)` | PRO promo kutusu |
| `--text-muted` | `#949494`, `#9B9B9B`, `white/50-70` | İkincil metin |

**Sidebar bubble aksan renkleri (modül başına):**
Başlangıç `#FF5C7F` · Kurmak `#3AFF68` · Katmanlar `#5EC4FF` · Eylemler `#AF54FF` · Sesler `#60F7C8` · Sohbet `#B1FF3B` · Puanlar `#FF5C7F` · Şarkı `#FF73F3` · Aletler `#6471FF` · Ajanslar `#00823F`

### 4.2 Tipografi
- Birincil UI: **Outfit** (Google Fonts). Form alanlarında **Inter**. Legacy başlık: "Exo 2".
- Overlay özelleştirme için 35 Google Font kataloğu: Inter, Open Sans, Source Sans Pro, Roboto, Noto Sans, Lato, Macondo, Exo 2, Koulen, Pacifico, Kalam, Permanent Marker, Gloria Hallelujah, Sacramento, Codystar, Geo, Lacquer, Sriracha, Monoton, Major Mono Display, Chewy, Shrikhand, Syncopate, Luckiest Guy, Bangers, Cinzel Decorative, DM Serif Display, Shadows Into Light, Indie Flower, Mountains of Christmas, Fontdiner Swanky, Akronim, Caesar Dressing, Eater, Faster One, Press Start 2P.

### 4.3 Layout Metrikleri
- **Topbar:** 54px yükseklik, `bg-white/10 backdrop-blur-lg` cam efekti, SVG köşe kesikleri (sol/sağ), `px-4 py-2`.
- **Sol ikon rayı:** 64px genişlik (`w-16 p-3 gap-3`), bubble'lar `size-11 rounded-xl`, varsayılan bg `rgba(255,255,255,0.06)`, hover `rgba(255,255,255,0.2)`; aktif öğede soldan beyaz gösterge çubuğu `w-[6px] h-[28px] rounded-r`; öğeler `draggable` (sürükle-bırak sıralama); Kurmak bubble'ında kurulum ilerleme halkası (`--progress`).
- **Alt menü paneli:** 256px (`w-64`, `bg-secondary`), grup başlığı + chevron (açıkken `rotate-90`), alt öğe hover rengi `#53AFDF`, aktif `bg-accent`.
- **İçerik alanı:** `h-[calc(100%-54px)]`; kartlar sabit genişlik **860–902px**, `rounded-[10px]`.
- **Yapışkan banner'lar:** trial/yükseltme `sticky top-[62px]`.
- Geçişler `duration-200`, easing `cubic-bezier(.4,0,.2,1)`; PRO kutusunda `shakeEffect` animasyonu.

### 4.4 Topbar Bileşenleri (soldan sağa)
1. **Logo** (32px, ana sayfa linki, hover scale-105)
2. **Arama tetikleyici** — 15rem, `bg-[#222222]`, placeholder "Aramak", `fa-search`, klavye çipi **⌘K** → tam ekran animasyonlu arama overlay'i
3. **Breadcrumb** (xl+): modül ikonu + "Kurmak / Kurmak" + bölüm sayısı rozeti (ör. `14`)
4. **Bağlan butonu** (primary): `fa-link` + "TikTok LIVE'a bağlanın" — çift katmanlı (gölge katmanı `bg-primary-dark`), hover kalkma/basma animasyonu
5. **Bildirim zili** + accent rozet (okunmamış sayısı) → "Inbox" dropdown: sekmeler **All / Features / Announcements**, öğe kartları (başlık, gövde, CTA, tarih, görsel), "hepsini okundu işaretle" + ayar dişlisi, boş durum maskotu
6. **Yardım** (`fa-question-circle`) → "Blog, Nasıl Yapılır ve Destek" dropdown: akordeon eğitimler (Actions & Events / Sound Alerts / TTS kurulumu, her biri "YouTube'da izle") + "Blog'a git"
7. **Stream Profile switcher** — emoji avatar + "Stream Profile 1" + `fa-angles-up-down`
8. **Kredi bakiyesi** — coin ikonu + sayı (`bg-[#D435554D] border-[#D4355580]`)
9. **Hesap menüsü** — avatar + 2 satır: kullanıcı adı / bağlantı durumu ("Disconnected" `#EF3F62`) + chevron

Her grup arası dikey ayraç `h-6 w-px bg-white/8`.

### 4.5 İkon Eşleme (FA → klonda kullanılacak)
`fa-home, fa-sliders-simple, fa-desktop, fa-bolt, fa-volume, fa-messages, fa-hundred-points, fa-list-music, fa-gamepad, fa-people-roof, fa-search, fa-command, fa-link, fa-bell, fa-question-circle, fa-angles-up-down, fa-chevron-down, fa-stars, fa-arrow-right, fa-discord (brands), fa-check, fa-gear, fa-eye, fa-badge-check`
> FA Pro lisansı yoksa: FA Free + Lucide karışımı; birebir görsel eşleşme için `erisilebilirlik-denetcisi` + `ux-tasarimcisi` onayı gerekir.

---

## 5. Sekme Spec'leri (Her Sekme = `docs/sekmeler/` Altında Ayrı Dosya)

> Kural: Uygulamadaki her sekme için `docs/sekmeler/<sıra>-<ad>.md` dosyası tutulur (ajan standardındaki "sekme = dosya" kuralı). Aşağıdaki spec'ler bu dosyaların çekirdeğidir.

### 5.1 Başlangıç (`start`) — Ana Panel

Sıralı bölümler (breadcrumb rozeti = 10 bölüm):
1. **Masaüstü uygulaması promosyon şeridi** — "Windows için ücretsiz TikFinity Masaüstü Uygulamasını edinin…" → `/app/`
2. **Hoş geldin kartı** (offline durumda): H2 "Hoş geldin!" + TTS ve Sesli Uyarılar sayfalarına inline linkler
3. **TikTok LIVE Connection kartı:** H3 + açıklama + "TikTok LIVE'a bağlanın" butonu
4. **Online durum** (bağlıyken): "You are LIVE!" — tarayıcı/masaüstü varyant metinleri
5. **Hızlı Erişim** (3 kutu): TTS / Sound Alerts / Eylemler ve Etkinlikler — her birinde ayar linki (ilgili sayfaya), **Etkinleştirilmiş/Engelli** toggle'ı, "Klavye Kısayolu Ayarla"
6. **Ajanslar bölümü:** "yeni" rozeti, öne çıkan ajans kartı (banner + logo + doğrulama rozeti + tier ikonu + istatistik şeridi: En İyi İçerik Üreticileri (3 avatar), Kuruluş yılı, Etkileşimler) + "Profili görüntüle", sonsuz logo marquee, "Tüm Ajansları Gör"
7. **Resmi TikTok kanalı** kartı (embed alanı, min-h 420px)
8. **Haberler: "⭐ The Latest and Greatest ⭐"** (`bg #122531`): Desktop App, OWN3D Pro, Voicemod, Sub Emotes, Team Member Levels, GTA 5 Plugin, Minecraft, Keystroke Simulation, Countdown, Streamer.bot satırları (ikon + metin + eğitim linki)
9. **PRO promo kutusu** (gradient + shake): "Ready for the next level? 🚀" + "View Details"
10. **"How to use TikFinity?"** YouTube embed + **Video Tutorials** topluluk grid'i + **Live Channels** grid'i (başlık "Live Channels (16054)", 200×50px kartlar: avatar + kullanıcı adı + parlayan LIVE + `fa-eye` izleyici sayısı, "Show More") + **FAQ** (13 soru) + **About** + **Contact**

Ek: sağda daraltılabilir **"bu sayfada" bölüm gezgini** (TOC paneli).

### 5.2 Kurmak (`setup`) — 14 Alt Bölüm

Alt menü sırasıyla:
1. **TikTok Hesabınızı Bağlayın** — "TikTok Adınız (Required!)" input + "TikTok LIVE'a bağlanın" + doğrulama hataları ("Invalid Username", "Enter your own TikTok username!") + "How to find my username?" linki + başarı banner'ı "Tamamdır! TikTok hesabınız başarıyla bağlandı!"
2. **Puan Sistemi** — Para biriminin adı, Madeni para başına puan, Hisse başına puan, Sohbet dakikası başına puan
3. **Abone Bonusu** — Abone Bonus Oranı (çarpan %)
4. **Seviye Ayarları** — Seviye Puanları (varsayılan 50), Seviye Çarpanı (üstel eğri), "Seviye listesini göster"
5. **OBS Bağlantısı** — OBS 28+ (WebSocket v5): IP (vars. `127.0.0.1`), Port, Password, "Test Bağlantısı"
6. **Streamer.bot Bağlantısı** — Address, Port, Endpoint, Test + kurulum linki
7. **Minecraft Bağlantısı** — mod (Fabric) vs ServerTap plugin; Player Name, IP, Port (vars. `4567`), Password, Test; indirme linkleri
8. **Sıfırlama Noktaları** — "Kriterlere göre Puanları ve Seviyeleri Sil", "Tüm Puanları ve Seviyeleri Sil" + Mobil Kupon kodu
9. **TikFinity Pro 🚀** — karşılaştırma tablosu (bkz. §10)
10. **Patreon Connection** — durum + "Connect Patreon"
11. **Hesabınız** — User-ID, E-Mail, Signup Date, Çıkış
12. **Import / Export Settings** — dosyadan içe aktar, ayarları sıfırla (JSZip + FileSaver)
13. **Advanced Settings** — toggle'lar: sunucu taraflı bağlantı, yeni pencerede aç, yerelleştirilmiş hediye adları, görünen adlar (@ yerine), yalnız ilk emote'u işle, keystroke kuyruğu; TikTok Language alanı (`en-US`); API Connectivity (Switch/Restore Server)
14. **Debug Options** — "Enable Debug Mode" toggle, "Open TikTok LIVE" butonu

### 5.3 Eylemler (`actionsandevents`) — Otomasyon Çekirdeği

**Model:** Eylemler (ne olacak?) ⟷ Etkinlikler (ne tetikleyecek?) — çoktan çoğa bağlantı.

**Sayfa yapısı:** Üstte "👈 Start here" etiketi + ana Enabled toggle → Actions tablosu → Events tablosu → Timers tablosu → Overlay Screen Settings tablosu → Event Simulator.

#### Eylem tipleri (20 — enum birebir)
| Enum | Etiket (EN/TR) | Yapılandırma alanları |
|---|---|---|
| `showText` | Show Alert (User + Text) / Uyarıyı Göster | metin + renk seçici + Global Overlay Settings |
| `showImage` | Show Picture / GIF | dosya yükleyici (`image/*` + Lottie JSON) |
| `showAnimation` | Show Animation | "Choose Animation" seçici |
| `playAudio` | Play Audio / Sesi Çal | Sound Library (MyInstants) + `audio/*` upload |
| `playVideoFile` | Play Video File | `video/*` upload (MP4/H264 önerisi) |
| `playVideo` | Play YouTube Video | **deprecated** — gizli |
| `speakText` | Read Text (TTS) | metin + Ses seçimi + Hız + Perde slider + rastgele ses + Test |
| `sendText` | Send Chatbot Message | chatbot metni |
| `switchObsScene` | Switch OBS Scene | sahne seçimi + davranış alt-modalı (süre sonunda geri dön / kalıcı) |
| `activateObsSource` | Activate OBS Source | kaynak seçimi (süre bitince otomatik kapanır) |
| `triggerWebhook` | Trigger WebHook | URL + "How does this work?" |
| `triggerMcCmd` | Exec Minecraft Command | komut editörü + MC Command Library + şablon bağlama (Check for updates / Unlink) + Expand Editor |
| `simulateKeystroke` | Simulate Keystrokes | keystroke kaydedici modalı |
| `execThirdPartyAction` | Third-Party Action | kategori + eylem seçimi + Test (127.0.0.1:8832 API) |
| `controlCustomGoal` | Control Custom Goal | hedef + tip + değer |
| `setVoicemodVoice` | Set Voicemod Voice | ses + süre + Test |
| `setStreamerbotAction` | Streamer.bot Action | eylem seçimi + kurulum linki |
| `controlTimer` | Control Timer | saniye (+/-) |
| `addPoints` / `removePoints` | Puan ekle / kaldır | sayı (radio çifti) |
| `setSnapCamEffect` | Snap Camera Effect | **devre dışı/gizli** |

**Eylem editörü modal sırası:** 1) Ad ("What is the name of the action?", placeholder "e.g. Subscription Animation", tekrar hatası) → 2) Ne olsun? (çoklu seçim yukarıdaki liste) → 3) Görüntüleme süresi (sn) → 4) Ödül/bedel (puan +/-) → 5) Ek ayarlar: medya ses seviyesi (slider), Overlay Screen (1-8), Global Cooldown, User Cooldown, Fade-In/Out, "Repeat with gift combos", "Skip on next action" → 6) Offline ekran uyarısı + widget URL'si → 7) Kaydet/İptal + "Save changes?" onayı.

#### Etkinlik tetikleyicileri (15) ve koşul alanları
| Enum | Etiket | Ek koşul alanı |
|---|---|---|
| `chat` | Chat (any comment) | — |
| `command` | Commenting a command | komut metni ("! veya / ile başlamalı") + TikTok team level + puan seviyesi |
| `follow` | Follow | — |
| `invite` | Share | — |
| `subscribe` | Subscribe | — |
| `join` | Join | — |
| `raid` | Raiding your broadcast | — |
| `first_activity` | First user activity | — |
| `gift_min` | Gift with min. coins | min coin sayısı |
| `gift_specific` | Specific gift | hediye seçici (API'den bölgesel katalog) |
| `gift_likes_min` | Likes (taps) | min beğeni |
| `emote_specific` | Subscriber emote | emote seçici |
| `sticker_specific` | Specific sticker | sticker modalı (Partner + Global grid) |
| `fanclub_sticker_specific` | Fan club sticker | seçici |
| `shop_purchase` | TikTok Shop purchase | "Product name contains (optional)" |

**Kim tetikleyebilir:** `any` (Everyone), `followers`, `subscribers`, `moderators`, `topgifter` (+ "Allowed number of top gifters" sayısı), `specific_user` (kullanıcı seçimi).
**Eylem bağlama:** "Trigger all of these actions" (çoklu) + "Trigger one of these actions (random)" (çoklu). Tekrar hatası: "An event already exists with the same trigger settings…"

#### Tablolar
- **Actions:** Enabled (toggle) · Name · Screen · Duration (sec.) · Points +/- · Animation · Picture · Sound · Video · Description. Boş: "No Actions defined". Buton "Create new Action". Silme onayı + toast'lar ("Action saved!", "Action deleted!", "Action executed!", "Screen queue is full!", "Screen is offline!").
- **Events:** Active · User · Trigger · Action(s). "Create new Event".
- **Timers:** Active · Interval (minutes) · Action to execute. "Create new Timer" — "Timer yayına girdiğinizde başlar."
- **Overlay Screens (8 adet):** Screen Name · Screen URL (`/widget/myactions?cid=<id>&screen=N`) · Max. queue length · Status (Offline/Online).
- **Event Simulator:** Simulate Follow / Share / Subscribe-Super Fan / 15 Likes / Gift butonları.

#### Placeholder değişkenleri
`{username} {nickname} {comment} {giftname} {coins} {repeatcount} {likecount} {totallikecount} {submonth} {playername} {level} {rank} {points} {currencyname} {amount} {destination}` + MC helper: `delay <ms>`, `break_delays`, `skip_delays`.

### 5.4 Katmanlar (`obsoverlays` + `obsdocks` + `giftoverlays` + `graphicoverlays`) — Widget Galerisi

**Widget URL şeması:** `/widget/<widgetId>?cid=<channelId>` + parametreler: `&screen=1-8` (myactions), `&x=N` (lastx slotları), `&c=N` (sayaçlar), `&metric=` (hedefler), `&preview=1`. Her galeri kartında: **Copy URL / Customize / Test** butonları.

**Widget listesi (tam envanter):**

| Widget | Endpoint | PRO? | Açıklama |
|---|---|---|---|
| My Actions | `myactions` | — | Eylem medyalarını render eder; 8 bağımsız ekran, ekran başına kuyruk |
| Gift Feed | `gifts` | — | Gelen hediye akışı |
| Chat | `chat` | — | Canlı sohbet overlay'i |
| Activity Feed | `activity-feed` | — | Birleşik olay akışı (dock olarak da) |
| Viewer Count | `viewercount` | — | Anlık izleyici |
| Follower Count | `followercounter` | — | Takipçi toplamı |
| Top Gifters | `topgifter` | — | En çok hediye gönderenler |
| Top Liker | `topliker` | — | En çok beğeni (Likeathon bağlantılı) |
| Ranking List | `ranking` | — | Puan liderlik tablosu |
| Points Animation | `transactionviewer` | — | İşlem başına avatar + puan |
| User Info Screen | `userinfo` | — | Komut sonuçları/kullanıcı paneli |
| Command Info Screen | — | — | Komut çıktıları |
| Interaction Slider | `carousel` | — | Tüm etkileşim/komutları döndürür |
| Goal | `goal` | çoğu PRO | likes/shares/follows/viewers/coins/points/subs/custom hedef çubukları |
| Countdown Goals | `countdowngoals` | PRO kısmi | Geri sayımlı hedefler + milestone eylem tetikleme |
| Gift Counter | `gcounter` | 1 free / 3 pro | Belirli hediye sayacı + Poll Mode |
| Last X | `lastx` | — | Son takipçi/hediyeci/abone (çoklu slot) |
| Timer (Subathon) | `timer` | — | Hediye/abonelikle uzayan geri sayım |
| Wheel of Fortune | `wheel` | — | !spin çarkı |
| Wheel of Actions | `wheelofactions` | **PRO** | Dilimleri eylem tetikleyen çoklu çark |
| Gift Cannon | `cannon` | **PRO** | Avatar + hediye fırlatma |
| Gift Firework | `firework` | **PRO** | Hediyeyle havai fişek |
| Like Fountain | `likes` | **PRO** | Beğenide yükselen kalpler |
| Coin Jar | — | **PRO** | Kavanoza düşen hediyeler + liderlik |
| Coin Match | — | **PRO** | Hediyeyle açık artırma savaşı (snipe mode, min bid) |
| Penalty Battle | — | **PRO** | Penaltı oyunu (kaleci = rastgele chatter) |
| World Cup Live Ticker | — | — | Canlı skor/gol animasyonu |
| Stream Buddies | — | — | Top gifter avatarları ekranda yürür |
| Emojify | — | — | Emojiler ekranda kayar |
| Falling Snow | — | — | Ortam karı (3 stil) |
| Christmas Event | `christmasevent` | — | Sezonluk etkinlik |
| Social Media Rotator | — | 2 slot free / 100 pro | Sosyal medya pop-up rotasyonu |
| Song Requests | `songrequests` | — | Spotify kuyruğu |
| Points Drop | `coindrop` | — | Toplanabilir coin yağmuru |
| YN Memory | — | — | Profil fotoğraflı hafıza oyunu |
| SubCatch / SubCatch Info | — | kısmi PRO | Yakalama oyunu (1280×720 + 500×400) |
| Guest Battle | — | — | Konuk beğeni savaşı skorbordu |
| Top Gift / Top Streak | — | **PRO** | En yüksek hediye / en uzun combo |
| Tiny Diny | — | — | Maskot/evcil widget |
| Quiz | `quiz` | — | Bilgi yarışması |
| Webcam Frames / Talking Banners / Overlay Frames | — | çoğu PRO | Grafik çerçeve/banner setleri |

**Widget özelleştirme ayarları (ortak):** font (35 Google Font), boyut/satır/harf aralığı, RTL hizalama, renkler (yazı, arka plan, ilerleme, kalan, rank, kullanıcı adı, puan, başlık, seviye, kazanç katmanları…), hue/saturation/grayscale filtreleri, paralelkenar şekli, animasyon, görüntüleme/duraklama/anons/dönüş/bekleme süreleri, ses aç/kapa + seviye, alt öğe göster/gizle. Ayarlar **canlı olarak sokete push edilir** (`widgetSettings` eventi) ve localStorage'da önbelleklenir.

**OBS Docks:** Dock 1 / Dock 2 kopyalanabilir URL'ler; OBS → Docks → Custom Browser Docks.

### 5.5 Sesler (`sounds`)
- Hediye/takip/paylaşım/abonelik/sub-emote → ses eşleme; bir tetikleyiciye çoklu ses → rastgele seçim.
- Ses kaynağı: kendi yüklemesi veya **MyInstants kütüphanesi** (arama modalı).
- Klavye kısayoluyla manuel tetikleme. "click here to import predefined alerts!" hazır paket içe aktarma.
- Free: 5 uyarı; Pro: sınırsız. Süresi dolunca banner: "Some sounds are currently disabled…"

### 5.6 Sohbet Grubu (`tts`, `chatbot`, `chatcommands`)
**TTS Chat:**
- Yorumları gerçek zamanlı sesli okur; overlay gerekmez (tarayıcıda çalar).
- Ayarlar: dil, ses, hız, perde, ses seviyesi; kullanıcıya/olaya özel ses atama; kısıtlama (herkes/abone/mod/top gifter/team); komut-önek modu (".tts").
- **43 ses kataloğu:** default, google_female/male + ⭐ premium (ghostface, c3po, stitch, stormtrooper, rocket, çok dilli en/fr/de/es/br/id/jp/kr setleri) + 🎵 şarkı sesleri (5) + narrator/wacky/peaceful. ⭐ ve 🎵 Pro.
- Free: günlük 100 parçacık; AI sesleri 25/gün. TTS kredi paketleri (small/medium/big).

**Chatbot:**
- Olay/komutlarda otomatik yanıt; `%placeholder%`'lı düzenlenebilir mesaj parçacıkları; mesaj başına aç/kapa.
- Gönderim: TikFinity hesabı (doğrulama gerekli) veya kendi hesabın (**Tampermonkey** userscript + açık tiktok.com sekmesi). AI yanıt: bot @mention'landığında.
- Varsayılan senaryo paketi (EN/DE/ES snippet'lerinden): Help, Reset, Points Info (!score), Points Transfer (!send), Wheel of Fortune (!spin), Level Up, My Actions, TTS, Song Request.

**Chat Commands:**
- Yerleşik komutlar (yeniden adlandırılabilir + dişli ayarları): Help, !score, !send, !spin, coin toplama, !play/!skip.
- Özel komutlar Actions & Events'ten; puan bedeli + rol kısıtı; sonuç chatbot mesajı veya Command Info overlay'inde.

### 5.7 Puanlar Grubu (`user`, `transactions`, `challenge`, `halving`)
- **User & Points:** izleyici veritabanı — puan, seviye, ilk/son aktivite; kapasite Free 2.5k / Pro 100k; sağ tık menü: puan ekle/çıkar, TikTok profilini aç.
- **Transactions:** tüm puan hareketleri defteri; manuel işlem (+/-), "count to level" bayrağı, silme/geri alma. Kolonlar: Streamer · User · Amount · Description + toplam sayaç.
- **Challenge:** geçici sıfırlamalı yarışma; bitişte puanlar kalsın/silinsin kararı.
- **Halving:** tüm puanları %X azalt (seviyeler sabit) — enflasyon kontrolü.
- Kazanım: coin, paylaşım, sohbet dakikası, abone bonusu. Harcama: çark, şarkı, komut, memory…

### 5.8 Şarkı (`songrequests`)
Spotify OAuth; !play/!skip; puan bedeli, kullanıcı başına + global kuyruk limiti, explicit içerik toggle'ı, kim kullanabilir, kalıcı kuyruk overlay'i, geçmiş.

### 5.9 Aletler Grubu (`wheel`, `coindrop`, `timer`, `likeathon`, `challenge`, `halving`, `rtmpgen` + oyunlar)
- **Wheel of Fortune:** spin bedeli, bekleme süresi, ana ödül + maks normal ödül, özel dilimler (metin, renk, puan +/-, bağlı eylem), chat gamble modu + maks bahis, Test butonu.
- **Points Drop:** coin adedi, coin değeri, timeout, kullanıcı başına tek coin, otomasyon (her X dakikada).
- **YN Memory:** kart kaynağı (izleyiciler/top fanlar/trend yayınlar), çevirme komutu + bedeli, eşleşme puanı, tahta genişlik/yükseklik, eşleşmede eylem, otomatik yeniden başlatma.
- **SubCatch:** tek seferlik aktivasyon; Pro: ekleme sıklığı + arka plan rengi.
- **Guest Battle:** 2-3 konuk, geri sayım, yayıncı dahil mi, kazanana puan.
- **Likeathon:** top-liker sıralaması + otomatik erime (her 10 sn %X), yoğunluk ayarı, sıfırlama.
- **Timer (Subathon):** manuel kontrol (başlat/duraklat/sıfırla/hızlı ekle) + "Control Timer" eylemi; renk özelleştirme; hediye/abonelikle uzatma.
- **Stream Key (rtmpgen):** TikTok stream key edinme yardımcısı (`keygenOnlyPro: true` — Pro'ya kilitli).

### 5.10 Ajanslar (`agencyregistry`, `agencyapplications`)
- Ajans rehberi: kart grid (banner, logo, doğrulama + tier ikonu, açıklama, istatistikler, "Profili görüntüle"), başvuru akışı, "My Applications".
- Ajans üyeliği → Pro indirimi ($19 → $12-16). Ajans portalı ayrı alan (klon kapsamı: rehber + başvuru; portal Faz 8+).

### 5.11 Event API (`dapi`) — Geliştirici Sekmesi
- Masaüstü uygulaması `ws://localhost:21213/` push-only JSON: `{"event":"<tip>","data":{...,"uniqueId":"..."}}`.
- Olay tipleri: `chat, gift, like, follow, share, member/join, subscribe, emote, envelope, roomUser` (TikTok-Live-Connector payload'ları).
- İndirilebilir örnek: `ws_api_example.zip`. Sayfada bağlantı durumu + dokümantasyon.

---

## 6. Gerçek Zamanlı Mimari

### 6.1 Olay Akışı
```
TikTok Webcast ──> Connector (TikTok-Live-Connector, @uniqueId ile) ──> Event Bus
Event Bus ──> Kural Motoru (Events eşleştirme: trigger + koşullar + rol filtresi + cooldown)
Kural Motoru ──> Action Executor (kuyruk: ekran başına FIFO, maks uzunluk)
Action Executor ──> WS yayını ──> /widget/* (OBS browser source)
                └─> TTS servisi / chatbot / webhook / OBS-WS / oyun entegrasyonları
```

### 6.2 Kural Motoru Gereksinimleri
- Etkinlik eşleştirme: tetikleyici tipi + koşul (min coin, spesifik hediye ID, min like, komut regex) + rol filtresi + seviye eşikleri.
- **Cooldown:** global + kullanıcı başına, eylem düzeyinde.
- **Streak/combo:** `repeatcount` ile hediye combo tekrarı (opsiyonel).
- **Ekran kuyrukları:** 8 ekran, her biri bağımsız FIFO + maks uzunluk + offline algılama (heartbeat).
- **Rastgele eylem:** "one of these actions (random)" desteği.
- **Timer olayları:** yayın canlıyken X dakikada bir.
- İdempotency: aynı TikTok event'i iki kez işlenmez (event id dedup).

### 6.3 Widget Kanal Modeli
- Widget bağlantısı: `cid` (channel id) bazlı oda; SharedWorker ile çoklu widget tek bağlantı (orijinaldeki "SharedIO" deseni).
- Sunucu → widget: `action` (medya çal), `widgetSettings` (canlı ayar push), `stateSync`, heartbeat.
- Widget → sunucu: durum raporu (online/offline), kuyruk durumu.

---

## 7. Veri Modeli (Faz 2'de Supabase — Şema Taslağı)

> Veri bağlantısı sonradan kurulacak; Faz 0-1'de tüm arayüz `lib/data/` altındaki **adapter interface**'leri + mock JSON ile çalışır. Aynı interface Faz 2'de Supabase implementasyonuyla değiştirilir.

Çekirdek tablolar (tümü RLS'li, `profile_id` bazlı):
- `users` (auth), `stream_profiles` (kullanıcı başına 1-10, emoji avatar)
- `tiktok_connections` (unique_id, durum, bölge/dil)
- `actions` (tip bileşimi JSONB, süre, cooldown'lar, ekran, ses seviyesi, fade, streak, skip bayrağı, medya URL'leri)
- `events` (trigger tipi, koşullar JSONB, who filtresi, bağlı eylemler [all/random])
- `timers_schedule` (interval, action_id)
- `overlay_screens` (1-8, ad, maks kuyruk)
- `widgets` + `widget_settings` (widget tipi, JSONB ayar)
- `viewers` (izleyici DB), `points_ledger` (transactions — append-only), `levels_config`
- `sounds` (event→ses eşleme), `tts_settings`, `chatbot_snippets`, `chat_commands`
- `goals`, `countdown_goals`, `gift_counters`, `wheels` + `wheel_segments`, `song_requests`
- `subscriptions` (pro durumu, sağlayıcı, tier), `agency_memberships`
- `integrations` (obs/streamerbot/minecraft/voicemod/spotify/patreon bağlantı konfigleri — sırlar Vault'ta)
- `notifications` (inbox), `media_assets` (Storage referansları)

Kritik kurallar: puan hareketleri **append-only ledger** (float yasak, tamsayı); yüksek yazma tabloları (chat/gift olayları kalıcıysa) partitioned; RLS policy kolonları indeksli.

---

## 8. Sayfa Dışı Yüzeyler

- **`/widget/<id>`** — chrome'suz, şeffaf arka planlı render (OBS için); `?preview=1` önizleme modu.
- **Giriş kapısı** — e-posta + Google OAuth.
- **Arama (⌘K)** — modüller + ayarlar + dokümanlar arası fuzzy arama, tam ekran overlay.
- **Bildirim tercihleri modalı** — In-App kategorileri: Başlat ve Hızlı Erişim / Kurulum ve Seçenekler / Widget'lar, Hedefler ve Katmanlar / Eylemler ve Etkinlikler / Sesli Uyarılar ve Metin Okuma / Komutlar ve TTS Sohbeti / Kullanıcı ve Puanlar / Şarkı / Likeathon, Zamanlayıcı ve Daha Fazlası / Ajans Rehberi.
- **Legal:** `/legal/tos`, `/legal/privacy` (hukuk-uyum-danismani taslakları, `[TASLAK — avukat onayı]`).
- **Yardım içerikleri:** FAQ, eğitim videoları, blog linki, Discord.

---

## 9. Üçüncü Taraf Entegrasyonları (Spec)

| Entegrasyon | Protokol | Detay |
|---|---|---|
| OBS | obs-websocket v5 | sahne/kaynak değiştirme; IP/Port/Password + Test |
| Streamer.bot | WebSocket | parametreler: `%userId% %username% %nickname% %profilePicturUrl% %commandParams% %giftId% %giftName% %coins% %repeatCount% %likeCount% %totalLikeCount% %subMonth% %emoteId% %emoteImageUrl%`; ters kanal (mesaj push) |
| Minecraft | Fabric mod / ServerTap REST (port 4567) | çok satırlı komut + şablon paketleri |
| Voicemod | Control API | ses değiştirme + süre |
| Spotify | OAuth | şarkı istekleri |
| Patreon | OAuth | Pro erişim eşleme |
| Üçüncü taraf araçlar | Dış araç `http://127.0.0.1:8832` REST host eder | `GET /api/app/info`, `GET /api/features/categories`, `GET /api/features/actions?categoryId=`, `POST /api/features/actions/exec` (context: triggerTypeId, userId, username, coins…); triggerTypeId haritası: 1=Share 2=Command 3=Gift(min) 4=Gift(specific) 6=Join 7=Likes 9=Follow 10=Subscribe 11=Chat 12=Emote 13=FirstActivity; CORS `*` |
| Event API | `ws://localhost:21213` (Electron fazında) | §5.11 |
| Webhook | Giden HTTP POST | eylem tipi olarak |

---

## 10. Ücretlendirme ve Özellik Kapıları

**Free vs Pro tablosu (birebir):**

| Özellik | Free | Pro |
|---|---|---|
| Actions & Events | 5 | ∞ |
| Sound Alerts | 5 | ∞ |
| Günlük TTS Parçacıkları | 100 | ∞ |
| Premium Kaplamalar | — | ✓ |
| AI Sesleri | 25/gün | ✓ |
| Deneysel Özellikler | — | ✓ |
| Discord Rolü | — | ✓ |
| Erken Özellik Erişimi | — | ✓ |
| Hediye Sayacı | 1 | 3 |
| Akış Profilleri | 1 | 10 |
| Social Media Rotator | 2 | 100 |
| Puan Sistemi Kullanıcıları | 2.5k | 100k |
| Sistem Erişilebilirliği | Normal | Öncelikli |
| Temel Kaplamalar, Chat Commands, Oyunlar, Chatbot, Subathon Timer, TTS, Minecraft | ✓ | ✓ |

**Fiyatlar:** $19/ay (varsayılan), $172/yıl ("2 ay ücretsiz"); ajans kademeleri $12/$14/$15/$16. Sağlayıcılar (klonda soyutlanır): LemonSqueezy / Paddle / Xsolla / Tazapay — klon Faz 7'de tek sağlayıcı (LemonSqueezy veya Stripe) + adapter deseni.
**Gating UX:** limit aşımında inline banner ("Some actions are currently disabled because your TikFinity Pro subscription has expired…"), PRO rozetli widget kartları, upgrade CTA'ları (sidebar "Yükselt", promo kutusu, trial banner `#FDB100`, yıllık banner `#2D4B2E`).

---

## 11. Dil Desteği (i18n)

- **Diller:** `tr` (varsayılan), `en`, `de`, `es`. Altyapı orijinaldeki 12 dile genişleyebilir (ja, id, th, vi, tl, ms, ko, pt-BR).
- **Kütüphane:** next-intl (App Router) — locale routing `/{locale}/...`, middleware yönlendirmesi, `Accept-Language` algılama + kullanıcı tercihi kalıcılığı.
- **Anahtar şeması:** orijinaldeki namespace düzeni korunur: `actionsandevents_*`, `setup_*`, `start_*`, `sounds_*`, `tts_*`, `chatbot_*`, `goals_*`, `wheel_*`, `checkout_modal_*`, `quickaccess_*` … (~1000 anahtar).
- ICU MessageFormat (plural/select); tarih/sayı `useFormatter`; hardcoded string **yasak** (CI'da yakalanır).
- Kaynak dil EN (orijinal metinler İngilizce dump'tan), TR/DE/ES çevirileri AI + insan review; hukuki metinler yalnız insan onaylı.
- Dil seçici: giriş sayfası altbilgisi + ayarlar; SEO hreflang alternates.

---

## 12. Veri Bağlantısı Stratejisi (Sonradan Kurulacak)

1. **`lib/data/ports.ts`** — tüm veri erişimi interface'ler üzerinden: `ActionsRepo`, `EventsRepo`, `PointsRepo`, `WidgetRepo`, `ConnectionService`, `RealtimeBus`…
2. **Faz 0-1:** `lib/data/mock/` — statik JSON + in-memory store + sahte olay üretici (Event Simulator butonları buradan beslenir; rastgele chat/gift/follow üretimi ile demo modu).
3. **Faz 2:** `lib/data/supabase/` — aynı interface'lerin Supabase implementasyonu; `.env` anahtarları takılınca `DATA_BACKEND=supabase` ile geçiş.
4. Connector sidecar Faz 2'de eklenir; öncesinde "Bağlan" butonu mock bağlantı simülasyonu yapar (durum makinesi: Disconnected → Connecting → LIVE).

---

## 13. Fonksiyonel Olmayan Gereksinimler

- **Performans:** LCP < 2.5s, INP < 200ms; widget render 60fps; olay→overlay gecikmesi < 500ms (yerel), < 1.5s (bulut).
- **Güvenlik:** RLS her tabloda; widget URL'leri tahmin edilemez (cid + imzalı token opsiyonu); webhook imza; puan double-spend koruması (idempotent ledger); OWASP Top 10; sırlar env/Vault.
- **Erişilebilirlik:** WCAG 2.2 AA — klavye navigasyonu, focus yönetimi (modallar), kontrast (koyu temada dikkat), `prefers-reduced-motion`.
- **Ölçek hedefi (v1):** eşzamanlı 1k yayıncı, yayıncı başına saniyede 50 olay burst.
- **Tarayıcılar:** Chrome, Firefox, Edge, Opera (orijinalle aynı) + OBS CEF.

---

## 14. Ajan Eşleme Matrisi (Hangi İş Kime)

| İş alanı | Birincil ajan | Destek |
|---|---|---|
| Planlama/koordinasyon | orkestrator | urun-yoneticisi |
| Mimari + ADR | mimar | veritabani-mimari |
| Layout/tema/sayfalar | on-yuz-gelistirici | ux-tasarimcisi, erisilebilirlik-denetcisi |
| Kural motoru + API | arka-yuz-gelistirici | mimar |
| Gerçek zaman + TikTok bağlantısı | **realtime-uzmani (yeni)** + **tiktok-live-uzmani (yeni)** | arka-yuz-gelistirici, supabase-uzmani |
| Widget/overlay render | **overlay-widget-uzmani (yeni)** | 3d-animasyon-uzmani (Lottie/animasyon), on-yuz-gelistirici |
| Supabase şema/RLS/Realtime | supabase-uzmani | veritabani-mimari |
| Puan ekonomisi/ledger | veritabani-mimari + odeme-entegratoru | guvenlik-denetcisi |
| Pro/ödeme | odeme-entegratoru | hukuk-uyum-danismani |
| i18n TR/EN/DE/ES | yerellestirme-uzmani | ux-tasarimcisi |
| TTS/AI | yapay-zeka-ml-muhendisi | arka-yuz-gelistirici |
| OBS/Streamer.bot/Minecraft/Spotify | api-entegratoru | arka-yuz-gelistirici |
| Test | test-muhendisi | tüm üreticiler |
| Kod kalitesi | kod-inceleyici | — |
| Güvenlik | guvenlik-denetcisi | supabase-uzmani |
| Performans | performans-optimizasyoncusu | on-yuz-gelistirici |
| A11y | erisilebilirlik-denetcisi | ux-tasarimcisi |
| CI/CD | devops-muhendisi | sre-gozlemlenebilirlik |
| Dokümantasyon (sekme dosyaları!) | dokumantasyon-yazari | tüm ajanlar |
| Analitik/growth/SEO/e-posta/reklam | ilgili uzmanlar | Faz 7+ |

---

## 15. Kabul Kriterleri (MVP — Faz 0-1)

1. Uygulama `pnpm dev` ile açılır; TR/EN/DE/ES dilleri çalışır, dil değişimi tüm UI'ı çevirir, hiçbir hardcoded string yoktur.
2. Layout birebir: 54px cam topbar (9 bileşen), 64px sürüklenebilir ikon rayı (10 bubble, doğru renkler), 256px alt menü, 860-902px kartlar, tüm hex token'lar doğru.
3. `start` sayfası: 10 bölümün tamamı, bölüm gezgini, Quick Access toggle'ları localStorage'da kalıcı.
4. `setup` sayfası: 14 alt bölümün tamamı, form validasyonları, mock "Test Bağlantısı" akışları.
5. `actionsandevents`: eylem editörü (20 tip), etkinlik editörü (15 tetikleyici + 6 rol), 4 tablo, Event Simulator mock olay üretir ve ekran kuyruğuna düşer.
6. `/widget/myactions?screen=N` mock aksiyonları render eder (metin/görsel/ses), kuyruk çalışır, offline/online durumu görünür.
7. Pro gating görsel olarak yerinde (limit sayaçları mock).
8. Lighthouse: Performance ≥ 90, A11y ≥ 95; `pnpm test` + `pnpm e2e` yeşil.

---

## Ek A — Orijinal Uygulama Referans Sabitleri

- App sürümü: 1.70.1 · API tabanı: `/api/` · Widget deseni: `/widget/<id>?cid=<channelId>`
- Orijinal servisler (klonda kendi eşdeğerleri yazılır): tts host, connector host (`cws-{instance}` sharding deseni), myinstants proxy, auth servisi, agency portalı
- Event API portu: `21213` · Üçüncü taraf API portu: `8832` · ServerTap portu: `4567`
- TikTok hediye ekonomisi referansı: 1 coin ≈ $0.0133; Rose=1, Panda=5, Perfume=20, I Love You=49, Confetti=100, Money Rain=500, Disco Ball=1000, Airplane=6000, Planet=15000, Lion=29999, Universe=44999.
- Bilinen event payload tipleri: `chat, gift, like, follow, share, member, subscribe, emote, envelope, roomUser`.
