# ADR-0003 — Overlay hibrit taşıma: Supabase Realtime + kalıcı connector (Vercel uyumu)

- **Tarih:** 2026-07-18
- **Durum:** Kabul edildi
- **Faz:** Faz 1.5 (ADR-0002'nin "serverless değil" sınırını kaldırır)
- **Karar veren:** kullanıcı onayı ile (Vercel'de kalma tercihi)

## Bağlam

ADR-0002'deki overlay hub (bellek-içi registry + uzun-ömürlü SSE + upstream WS)
**yalnız tek uzun-ömürlü Node sürecinde** çalışır. Uygulama **Vercel'e** (serverless)
deploy edildi; çok-instance/ephemeral model nedeniyle hub çalışmaz → tüm ekranlar
"Çevrimdışı", olaylar widget'lara ulaşmaz.

Araştırma bulgusu (kanıtlı): TikTok canlı olayları **kalıcı bir WebSocket** ister ve
hiçbir serverless platform bunu tutamaz. Euler Stream'in webhook "Alerts" ürünü yalnız
**canlı/çevrimdışı durum** bildirir, gift/chat/like **olay akışını değil**
(`CreateAlertRequest` yalnız `unique_id` alır; olay akışı sadece Cloud WebSocket'te).
Dolayısıyla **tam-serverless imkânsız** — bir yerde kalıcı bir süreç zorunlu.

## Karar

**Hibrit mimari.** Kullanıcı Vercel'de kalmayı seçti; tek kalıcı parça küçük bir
worker'a indirgenir:

**1. Taşıma = Supabase Realtime Broadcast.** Widget (tarayıcı) doğrudan Supabase
Realtime'a bağlanır (`overlay-<id>-<screen>` kanalı) — yönetilen WebSocket, serverless
uyumlu. SSE hub'ın yaptığı fan-out'u Supabase üstlenir. Kanal adındaki UUID sır görevi
görür (public kanal; auth Faz 2).

**2. Kalıcı connector worker** (`connector/index.ts`). Vercel DIŞINDA (Railway/Render/Fly
ücretsiz katman) çalışan tek süreç. `overlay_configs` tablosunu polling ile okur; her
username için **ref-count'lu tek** Euler Cloud WS tutar; kural motoru (`lib/engine`,
saf TS) **connector'da** çalışır; eşleşen action Supabase Realtime HTTP broadcast ile
ilgili kanala yayınlanır.

**3. Config depolama = Supabase `overlay_configs`.** Panel `/api/overlay/register`
(Vercel serverless, kısa-ömürlü) ile service-role üzerinden bu tabloya yazar; connector
okur. RLS açık, politika yok → yalnız service_role erişir (`supabase/schema.sql`).

**4. Feature flag ile geri-uyum.** `NEXT_PUBLIC_SUPABASE_URL` tanımlıysa hibrit yol
(Realtime + Supabase); tanımsızsa ADR-0002'nin SSE hub'ı (yerel `next start`). Widget
(`remote-overlay.tsx`) ve register route ikisini de destekler; **tek satır bile
silinmedi** — iki taşıma katmanı BİREBİR aynı `widgetInbound` "action" mesajını üretir
(`lib/overlay/action-message.ts` paylaşılan yardımcı).

## Gerekçe

- **Reuse maksimum:** engine, event-mapper, eulerstream core, widget render, kablo
  protokolü — hepsi paylaşılır. Connector, hub mantığının broadcast varyantıdır.
- Supabase Realtime yönetilen → widget fan-out için sunucu tutmaya gerek yok.
- Kalıcı süreç TikTok WS için zorunlu (araştırma ile kanıtlı); connector onu minimuma
  indirir (panel + widget + config Vercel/Supabase'de kalır).

## Sonuçlar / sınırlar

- **3 parça:** Vercel (web) + Supabase (Realtime + config) + connector (Railway/Render).
- ⚠️ **Auth yok** (ADR-0002 ile aynı): `overlay_configs` service-role kilitli; broadcast
  kanalları public (UUID sır). Faz 2 Supabase Auth + Realtime RLS bunu kilitler.
- **Euler ücretsiz katman:** 25 eşzamanlı WS. `username` başına tek upstream (ref-count).
- Connector'da online-ekran takibi yok → `requireOnlineScreen: false` (her zaman yayınla;
  kimse dinlemiyorsa no-op).

## Uygulama

- `supabase/schema.sql` — `overlay_configs` tablosu + RLS
- `lib/supabase/{browser,admin}.ts` — anon (widget) + service-role (server) client'lar
- `lib/overlay/realtime.ts` — kanal isimlendirme + `isSupabaseConfigured` flag
- `lib/overlay/action-message.ts` — paylaşılan action→mesaj (hub + connector)
- `connector/index.ts` (+ `README.md`) — kalıcı worker
- `app/api/overlay/register/route.ts` — Supabase upsert (flag-gated, hub fallback)
- `components/widgets/remote-overlay.tsx` — Supabase Realtime abonesi (flag-gated, SSE fallback)
- `lib/server/overlay-hub.ts` — `buildActionMessage` ortak yardımcıya refactor

## Faz 2 yükseltme yolu

Supabase Auth + `overlay_configs`/broadcast'a RLS; `overlayId` sunucu-sahipli/imzalı
token; connector'ın polling'i Postgres Realtime aboneliğine; connector'ın kendisi
yönetilen bir servise (ör. Supabase Edge yerine kalıcı worker host'u) taşınabilir.
