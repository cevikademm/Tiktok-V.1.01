# ADR-0002 — Overlay hub: sunucu-otoriteli SSE köprüsü (BroadcastChannel yerine)

- **Tarih:** 2026-07-18
- **Durum:** Kabul edildi
- **Faz:** Faz 1.5 (gerçek OBS köprüsü — Faz 2 auth/Supabase'in önüne çekildi)
- **Karar veren:** `realtime-uzmani` + `overlay-widget-uzmani` + `tiktok-live-uzmani` (kullanıcı onayı ile)

## Bağlam

Kullanıcı gereksinimi: TikTok LIVE yayıncısı, OBS / TikTok LIVE Studio'ya **"Browser Source"**
olarak ekleyeceği şeffaf bir overlay sayfasına sahip olacak; her kullanıcı için **benzersiz URL**
(UUID `id`) üretilecek, hediye gelince backend kuralları **sunucu tarafında** eşleştirip komutu
**o kullanıcının** overlay'ine gerçek zamanlı gönderecek.

Mevcut mimari bunu **karşılamıyor**:

- Gerçek zamanlı dağıtım `BroadcastChannel("livekit.bus.v1")` ile yapılıyor
  (`lib/data/mock/index.ts:354-380`, `lib/tiktok/client.ts:167-191`). BroadcastChannel yalnız
  **aynı tarayıcı süreci** içindeki sekmeler arasında çalışır. OBS'in browser source'u **ayrı bir
  süreçtir** → overlay hiçbir olay almaz. (`docs/sekmeler/04-widget-myactions.md:186-190` bunu
  "OBS'te çalışmaz" olarak belgelemişti.)
- Kullanıcıya özel URL / kimlik yok: `cid` okunmuyor, `channelId` sabit `"demo-channel"`,
  `screen` (1-8) yalnız tek tarayıcı içinde yönlendiriyor.
- Eşleştirme istemci tarafında (widget kendi `RuleEngine`'ini kuruyor), kullanıcının istediği
  "backend eşleştirir ve komut gönderir" modeli değil.

Kablo protokolü (`widgetInboundSchema`/`widgetOutboundSchema`, `lib/schemas/widget.ts:137-169`)
ve `WidgetRepo.url()` üretici zaten tasarlanmıştı ama hiçbir taşıma katmanı onları kullanmıyordu.

## Karar

**1. Taşıma = SSE (Server-Sent Events).** Sunucu→overlay tek yönlü push için SSE kullanılır.
Next.js App Router özel sunucu olmadan WebSocket **sunucusu** barındıramaz; SSE zaten
`/api/tiktok/stream`'de kanıtlı ve `next dev`/`next start` ile çalışıyor. Overlay→sunucu yönü
(config sync) hafif POST ile.

**2. Sunucu-otoriteli hub.** `lib/server/overlay-hub.ts` — bellek içi registry
(`overlayId → {username, actions, events, screens, engine, subscribers}`) + `username` başına
**ref-count'lu tek** upstream EulerStream WS (`lib/server/eulerstream.ts`'e refactor edilen ortak
çekirdek). Kural motoru (`lib/engine`, saf TS) **sunucuda** çalışır; eşleşen action `widgetInbound`
"action" mesajı olarak doğru `screen`'in SSE abonelerine push edilir. Kalıcılık: bellek + JSON dosya
(`.data/overlays.json`) — tek uzun-ömürlü Node süreci varsayımı.

**3. Protokol genişletmesi — `animationId`.** `widgetInboundSchema` "action" payload'ına
`animationId?: string` eklendi (`lib/schemas/widget.ts`). `showAnimation` eylem tipi overlay'de
`canvas-confetti` ile render edilir (`confetti`/`hearts`/`fireworks`). Bu, `lib/data/ports.ts`
imzalarına **dokunmaz** (yalnız kablo protokolü şeması genişler — CLAUDE.md §7 gereği ADR ile).

**4. Overlay URL şeması.** `/widget/myactions?id=<uuid>&screen=N`. Mevcut widget route'u ve
şeffaf layout (`app/widget/layout.tsx`) yeniden kullanılır; `page.tsx` artık `id`'yi okur.

**5. Kimlik (şimdilik).** `overlayId` = `crypto.randomUUID()`, dashboard localStorage'ında saklanır
(`livekit.overlayId.v1`). Auth **yok** — overlay URL'i tahmin-edilemez UUID token ile korunur.

## Gerekçe

- **Yeniden kullanım maksimum:** engine, protokol şeması, şeffaf layout, render markup,
  URL üretici, upstream WS mantığı — hepsi mevcut; yalnız köprü + kimlik katmanı eklendi.
- SSE, Next App Router'da özel sunucu gerektirmez; WebSocket için `server.js`+`ws` veya harici
  servis gerekirdi (altyapı maliyeti, işlevsel kazanç yok).
- Sunucu-taraflı eşleştirme kullanıcının açık isteği; kurallar overlay URL'ine sızmaz.

## Sonuçlar / sınırlar

- ⚠️ **Serverless değil.** Bellek içi hub + uzun ömürlü SSE + upstream WS yalnız **tek uzun-ömürlü
  Node sürecinde** (yerel makine veya tek VPS'te `next start`) çalışır. Vercel çok-instance/serverless
  ortamında paylaşılmayan bellek nedeniyle çalışmaz.
- ⚠️ **Auth yok:** `overlayId`'yi bilen POST ile config'i ezebilir. Kabul edilebilir risk (UUID
  tahmin-edilemez); Faz 2 auth + RLS bunu kilitler.
- **EulerStream ücretsiz katman:** 25 eşzamanlı WS. `username` başına tek upstream (ref-count) bunu korur.

## Faz 2 yükseltme yolu

`lib/data/ports.ts` soyutlaması korunduğu için Supabase'e temiz geçiş: (1) `lib/data/supabase/`
adapter'ı aynı imzalarla; (2) Supabase Auth (e-posta/şifre → Google OAuth); (3) RLS'li tablolar
(`profiles`, `stream_profiles`, `actions`, `events`, `overlay_screens`, `overlays`); (4) hub config'i
JSON yerine Supabase'den (service role) okur, `overlayId` sunucu-sahipli/imzalı token olur (PRD §13);
(5) çok-instance ölçek için SSE fan-out yerine **Supabase Realtime** (yönetilen) — bu ADR'nin
"serverless değil" sınırını kaldırır.

## Uygulama

- `lib/server/eulerstream.ts` — upstream WS (route.ts'ten refactor, paylaşılan)
- `lib/server/overlay-hub.ts` — registry + sunucu engine + SSE fan-out + JSON persist
- `app/api/overlay/{stream,register,simulate}/route.ts` — SSE + config sync + test enjeksiyonu
- `lib/schemas/widget.ts` — `widgetInbound` action payload'a `animationId`
- `components/widgets/action-player.tsx` — paylaşılan render + konfeti (`canvas-confetti`)
- `components/widgets/remote-overlay.tsx` — SSE istemcisi
- `app/widget/[widgetId]/page.tsx` — `id` okuma + RemoteOverlay yönlendirmesi
- `lib/overlay/{identity,use-overlay-sync}.ts` — kimlik + dashboard→sunucu sync
- `components/modules/actions/actions-page.tsx` — `id`'li overlay linki + kopyala
