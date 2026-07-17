# Entegrasyonlar — Merkezi Connector & MCP Haritası (TikFinity Klonu)

> **Tek başvuru noktası.** Hangi ajan hangi MCP connector'ünü / proje entegrasyonunu çağırır, hangi scope'la, hangi env ile — hepsi burada. Tüm ajanlar görev başında bunu okur. Yeni connector eklenince **buraya da yazılır**.
> Sistem: **34 uzman ajan** · Model: **katmanlı** (Opus 4.8 / Sonnet 4.6 — bkz. `_AJAN-STANDARDI.md`) · Proje spec'i: `PRD.md` §9 (üçüncü taraf entegrasyonlar).

## 🎯 Genel İlkeler
1. **Model katmanlama:** Ağır muhakeme → Opus 4.8; üretim/doğrulama → Sonnet 4.6. Detay `_AJAN-STANDARDI.md`.
2. **Auth yetkisi:** Hiçbir ajan `*_authenticate` çağrısını **kullanıcı onayı olmadan** yapmaz. ✅ işaretlenmemiş servis otomatik bağlanmaz.
3. **Scope minimumu (least privilege):** Her ajan yalnız rolüne ait scope'u talep eder.
4. **Sırlar:** Token/anahtar `.env.local` / Vercel env / Supabase Vault'ta; asla kodda. Yayıncı entegrasyon konfigleri (OBS şifresi, ServerTap şifresi, Spotify token) DB'de `integrations` tablosunda — sırlar Vault referanslı (PRD §7).
5. **Çakışma:** Aynı connector'ü iki ajan farklı kullanmak isterse `orkestrator` ortak nokta toplantısı düzenler.
6. **Faz disiplini:** Gerçek dış bağlantılar (TikTok connector, Supabase, Spotify…) **Faz 2+**'dadır; Faz 0-1'de tümü `lib/data/mock/` adapter'ıyla simüle edilir ("Test Bağlantısı" akışları dahil).

## 📊 Ajan ↔ Connector Matrisi

| Ajan | Model | Birincil Connector'ler | İkincil / Opsiyonel | Auth |
|------|-------|------------------------|---------------------|------|
| `orkestrator` | Opus | (hepsine erişir; tek başına çağırmaz) | — | n/a |
| `urun-yoneticisi` | Opus | `notion`, `atlassian`, `amplitude`, `pendo` | `hex`, `figma` | ⏳ |
| `mimar` | Opus | (okuma + WebSearch) | — | n/a |
| `hukuk-uyum-danismani` | Opus | (okuma + WebSearch) | `notion` (politika kayıtları) | ⏳ |
| `realtime-uzmani` | Opus | `supabase` (Realtime/Broadcast), WS Gateway (kod) | `github`, `vercel` | ⏳ |
| `tiktok-live-uzmani` | Opus | TikTok-Live-Connector sidecar (SDK, resmi MCP yok) | `github`, `supabase` (olay kalıcılığı) | 🔑 env |
| `overlay-widget-uzmani` | Sonnet | OBS WebSocket v5 (SDK), `figma` | `github`, `vercel` | 🔑 env |
| `on-yuz-gelistirici` | Sonnet | `figma`, `vercel` | — | ⏳ |
| `arka-yuz-gelistirici` | Opus | `supabase`, `github`, `vercel`, `pagerduty` | — | ⏳ |
| `supabase-uzmani` | Opus | `supabase` | `bigquery` (export) | ⏳ |
| `veritabani-mimari` | Opus | `supabase`, `bigquery` | `definite`, `hex` | ⏳ |
| `veri-muhendisi` | Sonnet | `bigquery`, `supabase`, `hex`, `definite` | `supermetrics`, `amplitude` | ⏳ |
| `api-entegratoru` | Sonnet | OBS-WS v5, Streamer.bot WS, Minecraft ServerTap, Voicemod, Spotify, MyInstants proxy (SDK/REST) + `github`, `slack`, `notion` | `intercom`, `atlassian`, `ms365`, `gmail`, `google-calendar`, `asana` | 🔑 env / ⏳ |
| `google-ads-uzmani` | Sonnet | `supermetrics`, `ahrefs`, `similarweb` | `klaviyo` | ⏳ |
| `reklam-uzmani` | Sonnet | `supermetrics`, `similarweb`, `klaviyo` | `apollo`, `clay`, `zoominfo`, `canva` | ⏳ |
| `growth-deney-uzmani` | Sonnet | `amplitude`, `pendo`, `posthog`, `supermetrics` | `hex`, `definite` | ⏳ |
| `analitik-uzmani` | Sonnet | `amplitude`, `pendo`, `definite`, `hex`, `bigquery` | `supermetrics`, `similarweb` | ⏳ |
| `seo-uzmani` | Sonnet | `ahrefs`, `similarweb`, `supermetrics` | `vercel` | ⏳ |
| `yerellestirme-uzmani` | Sonnet | (yerel dosya — `messages/*.json`) | — | n/a |
| `test-muhendisi` | Sonnet | `github`, `vercel` | — | ⏳ |
| `guvenlik-denetcisi` | Opus | `github`, `pagerduty`, `supabase` | — | ⏳ |
| `kod-inceleyici` | Sonnet | `github` | — | ⏳ |
| `performans-optimizasyoncusu` | Sonnet | `vercel`, `netlify`, `github` | `supabase` | ⏳ |
| `erisilebilirlik-denetcisi` | Sonnet | `figma`, `github` | — | ⏳ |
| `devops-muhendisi` | Sonnet | `github`, `vercel`, `netlify`, `supabase`, `pagerduty` | Fly.io/Railway (sidecar deploy, CLI) | ⏳ |
| `sre-gozlemlenebilirlik` | Opus | `pagerduty`, `vercel`, `supabase`, `github` | `slack` (alarm) | ⏳ |
| `dokumantasyon-yazari` | Sonnet | `github`, `notion`, `guru` | `figma` | ⏳ |
| `time-validator` | Sonnet | (yerel hesap) | `supabase` (örnekleme) | ⏳ |
| `ux-tasarimcisi` | Sonnet | `figma`, `canva` | — | ⏳ |
| `mobil-gelistirici` | Sonnet | `github`, `vercel`, `figma` | Electron Event API (Faz 8) | ⏳ |
| `odeme-entegratoru` | Opus | LemonSqueezy (SDK) veya `stripe` + `github`, `supabase`, `vercel` | Patreon OAuth (Pro eşleme) | 🔑 env / ⏳ |
| `e-posta-uzmani` | Sonnet | `klaviyo`, `gmail` | `intercom`, `hubspot`, `apollo` | ⏳ |
| `yapay-zeka-ml-muhendisi` | Opus | `supabase`, `github`, `vercel` + TTS sağlayıcı (SDK) | `definite`, `hex` | 🔑 env / ⏳ |
| `3d-animasyon-uzmani` | Sonnet | `figma`, `vercel` | `canva`, `github` | ⏳ |

**Auth Anahtarı:** ✅ Bağlandı · ⏳ Beklemede (kullanıcı onayı) · ❌ Kullanılmayacak · 🔑 env — MCP değil, `.env`/Vault anahtarıyla SDK/REST (yine kullanıcı onayı şart)

## 🎮 Proje Entegrasyonları — TikFinity Klonu Connector Matrisi (PRD §9)

> Bunlar MCP değil, **ürünün kendi entegrasyonlarıdır**; kodda SDK/REST/WS istemcisi olarak yazılır. Sahip ajan uygular, `api-entegratoru` genel deseni (retry, timeout, hata sınıflandırma) korur, `guvenlik-denetcisi` sır/imza denetimi yapar.

| Entegrasyon | Protokol / Port | Sahip Ajan | Faz | Notlar |
|---|---|---|---|---|
| **TikTok-Live-Connector** (zerodytrash, MIT) | Node.js **sidecar servis** → TikTok Webcast (resmi olmayan) | `tiktok-live-uzmani` | 2 | `@uniqueId` ile bağlanır; olay tipleri: `chat, gift, like, follow, share, member/join, subscribe, emote, envelope, roomUser`; event-id dedup (idempotency) zorunlu; kırılgan upstream — sürüm sabitleme + hata bütçesi; deploy Fly.io/Railway |
| **OBS WebSocket v5** | WS, `127.0.0.1` + Port + Password (OBS 28+) | `api-entegratoru` (+ `overlay-widget-uzmani`) | 3-4 | Sahne/kaynak değiştirme (`switchObsScene`, `activateObsSource`); Setup §5.2/5'teki "Test Bağlantısı" akışı; şifre asla loglanmaz |
| **Streamer.bot** | WS (Address + Port + Endpoint) | `api-entegratoru` | 3+ | `setStreamerbotAction` eylemi; parametre seti: `%userId% %username% %nickname% %profilePicturUrl% %commandParams% %giftId% %giftName% %coins% %repeatCount% %likeCount% %totalLikeCount% %subMonth% %emoteId% %emoteImageUrl%`; ters kanal (mesaj push) desteklenir |
| **Minecraft ServerTap** | REST, port **4567** (veya Fabric mod) | `api-entegratoru` | 3+ | Player Name + IP + Port + Password; `triggerMcCmd` — çok satırlı komut + şablon paketleri + `delay <ms>` / `break_delays` / `skip_delays` helper'ları |
| **Voicemod Control API** | Yerel API | `api-entegratoru` | 6 | `setVoicemodVoice` — ses + süre + Test butonu |
| **Spotify** | OAuth 2.0 (PKCE) | `api-entegratoru` | 6 | `songrequests`: !play/!skip, puan bedeli, kuyruk limitleri, explicit toggle; refresh token Vault'ta |
| **MyInstants-tarzı ses kütüphanesi** | REST proxy (kendi eşdeğerimiz) | `api-entegratoru` (+ `arka-yuz-gelistirici`) | 3 | `sounds` + `playAudio` eyleminin arama modalı; telif/moderasyon filtresi; sonuçlar önbelleklenir, hotlink yerine kendi Storage'ımız |
| **LemonSqueezy / Stripe** | REST + webhook (imzalı) | `odeme-entegratoru` | 7 | Adapter deseni — tek sağlayıcı seçilir, arayüz `PaymentProvider` interface'i; webhook imza doğrulama + idempotency key; test: Stripe `4242…` / LS test mode |
| **Patreon** | OAuth | `odeme-entegratoru` | 7 | Pro erişim eşleme (Setup §5.2/10) |
| **Üçüncü taraf araç API'si** | Dış araç `http://127.0.0.1:8832` REST host eder | `api-entegratoru` | 8 | `GET /api/app/info`, `GET /api/features/categories`, `GET /api/features/actions?categoryId=`, `POST /api/features/actions/exec`; triggerTypeId haritası PRD §9; CORS `*` |
| **Event API (dapi)** | `ws://localhost:21213` push-only JSON | `tiktok-live-uzmani` (+ `mobil-gelistirici`) | 8 | Electron fazı; `{"event":"<tip>","data":{...,"uniqueId":"..."}}`; örnek paket `ws_api_example.zip` |
| **Webhook (giden)** | HTTP POST | `arka-yuz-gelistirici` | 3+ | `triggerWebhook` eylemi; imzalı payload + retry/backoff |
| **Supabase Realtime / WS Gateway** | Broadcast/Presence + ayrı Node WS servisi | `realtime-uzmani` | 2+ | Widget kanal modeli: `cid` bazlı oda, `action` / `widgetSettings` / `stateSync` / heartbeat mesajları; SharedWorker tek-bağlantı deseni |

## 🧰 MCP Araç Referansları (oturuma bağlı sunucular)

> Bu araçlar oturumda mevcutsa ajanlar doğrudan çağırabilir. Auth gerektiren çağrılar **kullanıcı onayı sonrası**.

| MCP Sunucusu | Tipik Araçlar | Kullanan Ajanlar |
|--------------|---------------|------------------|
| **Supabase** | `list_tables`, `apply_migration`, `execute_sql`, `get_advisors`, `deploy_edge_function`, `generate_typescript_types`, `get_logs`, `list_migrations`, `create_branch` | supabase-uzmani, veritabani-mimari, arka-yuz-gelistirici, realtime-uzmani, guvenlik-denetcisi, veri-muhendisi, devops-muhendisi |
| **Vercel** | `deploy_to_vercel`, `list_deployments`, `get_deployment_build_logs`, `get_runtime_logs`, `get_project` | devops-muhendisi, on-yuz-gelistirici, performans-optimizasyoncusu, sre-gozlemlenebilirlik |
| **Netlify** | deploy/extension/project reader+updater | devops-muhendisi, performans-optimizasyoncusu |
| **Figma** | `get_design_context`, `get_screenshot`, `get_variable_defs`, `get_metadata`, `get_code_connect_map` | ux-tasarimcisi, on-yuz-gelistirici, overlay-widget-uzmani, erisilebilirlik-denetcisi, mobil-gelistirici, dokumantasyon-yazari, 3d-animasyon-uzmani |
| **Canva** | `generate-design`, `export-design`, `get-design`, `list-brand-kits` | ux-tasarimcisi, reklam-uzmani |
| **Stripe** | authenticate + ödeme yönetimi | odeme-entegratoru |
| **Gmail / Calendar / Drive** | draft/search/label, events, file read/create | api-entegratoru, e-posta-uzmani, urun-yoneticisi |
| **n8n** | otomasyon akışları | api-entegratoru |

## 🔌 Connector Kataloğu (özet)

**Geliştirme & Operasyon:** GitHub (repo/PR/issues), Vercel (deploy/logs), Netlify, Supabase (db/auth/storage/edge/realtime), PagerDuty (incident), Fly.io/Railway (sidecar — CLI).
**Ürün entegrasyonları (SDK/REST/WS):** TikTok-Live-Connector, OBS-WS v5, Streamer.bot, Minecraft ServerTap (4567), Voicemod, Spotify, MyInstants-tarzı ses kütüphanesi, LemonSqueezy/Stripe, Patreon.
**Tasarım & İçerik:** Figma, Canva.
**Analitik & Veri:** Amplitude, Pendo, PostHog, BigQuery, Definite, Hex, Supermetrics.
**Pazarlama & Büyüme:** Ahrefs, SimilarWeb, Klaviyo.
**Satış & CRM:** Apollo, Clay, Close, ZoomInfo, HubSpot.
**İletişim & Destek:** Slack, Intercom, Atlassian (Jira/Confluence), Notion, Guru, MS365, Gmail, Google Calendar.
**Operasyon:** Asana, n8n.

## 🔐 Auth Akışı
1. Görevden önce `entegrasyonlar.md` oku, gerekli connector'lerin durumunu kontrol et.
2. Eksik olanlar için **AskUserQuestion** ile açık onay al.
3. Onaylanınca `*_authenticate` → `*_complete_authentication`. (🔑 env entegrasyonlarında: anahtarı kullanıcıdan iste → `.env.local`/Vault'a koydur → koda asla yazma.)
4. Bağlanınca burada ✅ işaretle (`dokumantasyon-yazari` günceller).

## 🧪 Test / Sandbox Modları
| Servis | Sandbox | Not |
|--------|---------|-----|
| Supabase | ✅ Branch/shadow DB | her şema değişikliğinde branch |
| TikTok-Live-Connector | ✅ Mock olay üretici (`lib/data/mock/`) | Faz 0-1'de tek kaynak; Faz 2'de kayıtlı olay replay'i + Event Simulator |
| OBS WebSocket v5 | ✅ Yerel OBS + sahte WS sunucu (test) | "Test Bağlantısı" e2e'si mock sunucuyla |
| Streamer.bot / ServerTap / Voicemod | ✅ Sahte REST/WS stub (MSW / test sunucusu) | gerçek kurulum gerekmeden CI'da doğrulanır |
| Spotify | ✅ Developer app (kısıtlı) | test hesabı + düşük kotalar |
| Stripe | ✅ Test mode | `4242 4242 4242 4242` |
| LemonSqueezy | ✅ Test mode | webhook imza testi dahil |
| iyzico | ✅ Sandbox | `sandbox-api.iyzipay.com` (kullanılırsa) |
| Vercel | ✅ Preview | her PR otomatik |
| Klaviyo | ✅ Test list | gerçek listeye dokunmadan |

## 📝 Eklenmesi Planlanan / SDK ile Çalışanlar (resmi MCP yok)
- TikTok-Live-Connector, OBS-WS v5, Streamer.bot, ServerTap, Voicemod, Spotify Web API, LemonSqueezy (yukarıdaki proje matrisi) · iyzico, Paytr (TR ödeme) · Sentry, Axiom, Better Stack (gözlemlenebilirlik) · Resend (e-posta) · Meta/TikTok/LinkedIn/X Ads (Marketing API'leri) · dbt/Airbyte (veri pipeline)

## 🚦 Bağlantı Önceliği
1. **Geliştirme:** GitHub → Supabase → Vercel
2. **Proje çekirdeği (Faz 2+):** TikTok-Live-Connector sidecar → WS Gateway → OBS-WS v5
3. **Tasarım & doküman:** Figma → Notion
4. **Operasyon:** PagerDuty → Slack
5. **Pazarlama:** GA4 (kod) → Supermetrics → Klaviyo
6. **Monetizasyon (Faz 7):** LemonSqueezy/Stripe → Patreon

## 🔗 İlgili Dosyalar
- `PRD.md` §9 — üçüncü taraf entegrasyon spec'i (tek gerçek kaynak)
- `_AJAN-STANDARDI.md` — ajan şablonu + model katmanlama + JSON handoff
- `orkestrator.md` — koordinasyon + karar matrisi + faz kapıları
- `BENI-OKU.md` — kullanım kılavuzu
- `docs/ADR/` — entegrasyon kararları geçmişi
