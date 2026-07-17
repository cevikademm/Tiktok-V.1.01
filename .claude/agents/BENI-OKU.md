# Agents — Claude Code Bağımsız Ajan Klasörü (TR) · v3 (TikFinity Klonu)

Bu klasör, Claude Code için **34 uzman ajandan** oluşan, üst düzey bir geliştirme ekibini içerir ve **LiveKit (TikFinity klonu)** projesine özel geliştirilmiştir (bkz. `PRD.md` + `CLAUDE.md`). Sistem **katmanlı model** kullanır: ağır muhakeme/yüksek-risk ajanları **Opus 4.8**, üretim/doğrulama ajanları **Sonnet 4.6**. Tüm dosya isimleri Türkçedir. Kalite sözleşmesi `_AJAN-STANDARDI.md`'dedir.

## 🆕 v3'te Ne Değişti?
- **3 yeni proje-kritik ajan:** `realtime-uzmani` (WS kanal modeli, ekran kuyrukları), `tiktok-live-uzmani` (TikTok-Live-Connector sidecar + olay/hediye domain'i), `overlay-widget-uzmani` (OBS widget/overlay render, `/widget/*`).
- **Proje bağlamı bloğu:** her ajanda zorunlu `## 📌 Proje Bağlamı — TikFinity Klonu` bölümü (sorumlu PRD bölümleri + faz disiplini + dosya haritası).
- **Yapısal JSON handoff:** her ajan raporunun sonunda zorunlu JSON bloğu (`_AJAN-STANDARDI.md` §3.2) — orkestrator eksikse geri gönderir.
- **Faz kapıları:** orkestrator PRD §2'deki Faz 0-8 planını kapı kapı yönetir; aktif faz dışına kod yazılmaz.
- v2'den devralınanlar: katmanlı model, `tools` string frontmatter düzeltmesi, Girdi Kontratı / DoD / Öz-Doğrulama Rubriği, `_AJAN-STANDARDI.md` kalite şablonu.

## 📦 İçindekiler (34 Ajan + 2 Sistem Dosyası)

### 🔴 Opus 4.8 — Ağır Muhakeme / Yüksek Risk (13)
| Ajan | Görev |
|------|-------|
| `orkestrator` | Baş yönetici — parçalar, dağıtır, hakemlik eder, faz kapılarını korur |
| `mimar` | Sistem mimarisi + ADR |
| `urun-yoneticisi` | PRD, önceliklendirme (RICE), başarı metrikleri, roadmap |
| `hukuk-uyum-danismani` | KVKK/GDPR/EU AI Act/DSA/ToS/çerez/sözleşme + klon riski |
| `veritabani-mimari` | Postgres veri modeli, indeks, ER, puan ledger'ı |
| `supabase-uzmani` | Supabase (DB/Auth/RLS/Edge/Storage/Realtime) — Faz 2+ |
| `arka-yuz-gelistirici` | API, Server Actions, kural motoru (`lib/engine/`) |
| `odeme-entegratoru` | LemonSqueezy/Stripe, abonelik, Pro gating (Faz 7) |
| `yapay-zeka-ml-muhendisi` | LLM / TTS-AI sesleri / chatbot AI / guardrail |
| `guvenlik-denetcisi` | OWASP (Web/API/LLM) / tehdit modelleme / RLS+widget token |
| `sre-gozlemlenebilirlik` | SLO/SLI, error budget, incident, on-call |
| `realtime-uzmani` | **YENİ** — WebSocket gateway, widget kanal modeli (cid), 8 ekran kuyruğu, cooldown/idempotency, olay dedup |
| `tiktok-live-uzmani` | **YENİ** — TikTok-Live-Connector sidecar servisi, Webcast olay tipleri (chat/gift/like/follow/share/subscribe/join/raid/emote/envelope/roomUser), hediye ekonomisi (coin, combo/streak, top gifter), `dapi` Event API |

### 🟢 Sonnet 4.6 — Üretim / Doğrulama / İçerik (21)
| Ajan | Görev |
|------|-------|
| `on-yuz-gelistirici` | Next.js 15 / React 19 / Tailwind v4 / shadcn — layout + sayfa klonları |
| `overlay-widget-uzmani` | **YENİ** — OBS browser source widget'ları (`/widget/*`), widget galerisi, `widgetSettings` canlı push, 60fps animasyon bütçesi, şeffaf arka plan |
| `ux-tasarimcisi` | User flow + wireframe + microcopy (piksel-birebir klon onayı) |
| `3d-animasyon-uzmani` | Three.js / R3F / GSAP / Lottie / Rive (Gift Cannon, Firework…) |
| `mobil-gelistirici` | Expo / React Native / PWA / Electron sarmalayıcı (Faz 8) |
| `api-entegratoru` | OBS-WS v5, Streamer.bot, Minecraft ServerTap, Voicemod, Spotify, Patreon, webhook |
| `veri-muhendisi` | Warehouse, dbt, ELT, data quality |
| `analitik-uzmani` | GA4 / GTM / Mixpanel / Amplitude / PostHog |
| `growth-deney-uzmani` | A/B test, CRO, aktivasyon, funnel |
| `seo-uzmani` | Teknik SEO + structured data |
| `google-ads-uzmani` | Google Ads strateji + API |
| `reklam-uzmani` | Meta / TikTok / LinkedIn / X / programatik |
| `e-posta-uzmani` | Resend / Klaviyo / deliverability / push |
| `yerellestirme-uzmani` | i18n / next-intl / ICU — TR/EN/DE/ES, ~1000 anahtar |
| `test-muhendisi` | Vitest + Playwright + MSW + axe |
| `kod-inceleyici` | Kod kalitesi (salt-okunur) |
| `performans-optimizasyoncusu` | Core Web Vitals / bundle / widget 60fps / olay gecikmesi |
| `erisilebilirlik-denetcisi` | WCAG 2.2 AA (koyu tema kontrastı dahil) |
| `devops-muhendisi` | CI/CD / Vercel / sidecar deploy (Fly.io-Railway) / secret |
| `dokumantasyon-yazari` | Sekme dokümanı (`docs/sekmeler/`) + README + ADR |
| `time-validator` | Saat/süre doğrulayıcı (subathon timer, cooldown, timezone, DST; ±2dk) |

### ⚙️ Sistem Dosyaları
| Dosya | Görev |
|-------|-------|
| `_AJAN-STANDARDI.md` | ⭐ Ajan kalite sözleşmesi (şablon + model katmanlama + JSON handoff + proje bağlamı bloğu) |
| `entegrasyonlar.md` | ⭐ Merkezi connector & MCP haritası (TikTok/OBS/Streamer.bot/Minecraft/Voicemod/Spotify dahil) |

## 🚀 Yeni Projede Kullanım

### Windows PowerShell
```powershell
cd "D:\Yeni-Projem"
New-Item -ItemType Directory -Force -Path ".claude\agents"
Copy-Item "$env:USERPROFILE\Desktop\Agents\*.md" ".claude\agents\"
```
### Mac / Linux
```bash
mkdir -p .claude/agents && cp ~/Desktop/Agents/*.md .claude/agents/
```

> Bu depoda ajanlar zaten `/home/claude/tikfinity-klon/.claude/agents/` altındadır — kopyalama gerekmez.

## 📋 Master Prompt (ilk konuşmaya yapıştır)
```
Sen bu projedeki ORKESTRATOR ajanısın. Görevin LiveKit'i (TikFinity klonu)
baştan sona, ekip halinde, planlı ve FAZ FAZ inşa etmek.

GENEL KURALLAR:
1. Sistem KATMANLI model kullanır: ağır muhakeme ajanları Opus 4.8, üretim/
   doğrulama ajanları Sonnet 4.6. Detay: _AJAN-STANDARDI.md.
2. Önce CLAUDE.md + PRD.md + _AJAN-STANDARDI.md + entegrasyonlar.md +
   tüm .claude/agents/*.md oku.
3. Hiçbir kodu kendin yazma. İşi parçala, uygun ajanlara Task ile delege et;
   her delegasyonda EKSİKSİZ girdi kontratı ver (hedef, kapsam, dosyalar +
   PRD bölüm referansı, bağımlı çıktılar, kabul kriteri).
4. Her ajan sadece kendi uzmanlık alanında çalışır (PRD §14 matrisi).
5. Test edilmemiş/doğrulanmamış kodu "tamamlandı" sayma; her ajan çıktısı
   sonunda zorunlu JSON handoff bloğu ister (_AJAN-STANDARDI.md §3.2).
6. Yanıtlar Türkçe. Çakışmada ortak nokta toplantısı + ADR.

ZORUNLU İŞ AKIŞI — TikFinity Klonu Faz Planı (PRD §2, kapı kapı):
0. FAZ 0 — İskelet: tema token'ları (PRD §4.1), layout (54px topbar + 64px
   ikon rayı + 256px alt menü), i18n altyapısı (TR/EN/DE/ES), mock adapter
   (lib/data/ports.ts + lib/data/mock/).
   [mimar + on-yuz-gelistirici + yerellestirme-uzmani + ux-tasarimcisi]
1. FAZ 1 — MVP: start, setup, actionsandevents sayfalarının birebir klonu
   (20 eylem tipi, 15 tetikleyici, 4 tablo, Event Simulator). Kapı: PRD §15.
   [on-yuz-gelistirici + arka-yuz-gelistirici + test-muhendisi]
2. FAZ 2 — Veri bağlantısı: Supabase şeması + Auth + RLS, gerçek TikTok
   connector sidecar'ı, dapi. [supabase-uzmani + veritabani-mimari +
   tiktok-live-uzmani + realtime-uzmani]
3. FAZ 3 — Ses/sohbet: sounds, tts, chatbot, chatcommands.
   [arka-yuz-gelistirici + yapay-zeka-ml-muhendisi + api-entegratoru]
4. FAZ 4 — Overlay: obsoverlays + /widget/* render altyapısı + obsdocks.
   [overlay-widget-uzmani + realtime-uzmani + 3d-animasyon-uzmani]
5. FAZ 5 — Puan + hedefler: user, transactions, goals, countdowngoals,
   followercounter, lastx, giftoverlays, graphicoverlays.
   [veritabani-mimari + overlay-widget-uzmani + arka-yuz-gelistirici]
6. FAZ 6 — Oyunlar/araçlar: wheel, coindrop, timer, likeathon, challenge,
   halving, songrequests, rtmpgen. [overlay-widget-uzmani + api-entegratoru]
7. FAZ 7 — Monetizasyon: Pro/ödeme (LemonSqueezy/Stripe), agencyregistry,
   agencyapplications, christmasevent. [odeme-entegratoru +
   hukuk-uyum-danismani (klon-risk raporu ZORUNLU)]
8. FAZ 8 — Genişleme: Electron sarmalayıcı (ws://localhost:21213 Event API),
   üçüncü taraf API (:8832). [mobil-gelistirici + tiktok-live-uzmani]

Her fazda sürekli: test-muhendisi, kod-inceleyici, guvenlik-denetcisi,
erisilebilirlik-denetcisi, performans-optimizasyoncusu, dokumantasyon-yazari.
FAZ KAPISI: önceki fazın kabul kriterleri kanıtlanmadan sonraki faz başlamaz;
aktif faz dışı modüle yalnız route iskeleti + "yakında" durumu yazılır.

SEKME DOKÜMANTASYON KURALI:
Her sekme/route/page için docs/sekmeler/<sıra>-<ad>.md. Alt panel'ler AYNI
dosyada "## Alt Bölüm: <ad>" altında. Tek sekme = tek dosya.

TEKNOLOJİ (PRD §1 — KESİN KARAR):
- Next.js 15 (App Router) + React 19 + TypeScript strict + Tailwind v4 + shadcn/ui
- Supabase (Faz 2; Postgres + RLS HER TABLO + Auth + Realtime) · mock adapter önce
- TikTok-Live-Connector (Node sidecar) · Test: Vitest + Playwright + MSW + axe
- Paket: pnpm · i18n: next-intl (TR varsayılan, EN/DE/ES) · Zod schema-first

İLK GÖREV: Aktif fazı CLAUDE.md'den doğrula → en fazla 5 kritik soru sor →
faz planına göre ilk ajan setini paralel çağır → plan onayı al → başla.
```

## 🎯 Çekirdek Kurallar
- **Tek sekme = tek dosya** (`docs/sekmeler/`).
- **Katmanlı model** — `_AJAN-STANDARDI.md`'deki tabloya uy.
- **Doğrulama zinciri** — her çıktı `kod-inceleyici` + ilgili denetçiden geçer.
- **Girdi kontratı** — eksikse iş başlamaz; **JSON handoff** — eksikse çıktı kabul edilmez.
- **Faz disiplini** — PRD §2 kapıları orkestrator onayı olmadan geçilmez.

## ⚙️ Ajan Eklemek
1. `<yeni-ajan>.md`'yi `_AJAN-STANDARDI.md`'ye göre oluştur (doğru model katmanı + frontmatter + Proje Bağlamı bloğu + JSON handoff).
2. `orkestrator.md` Karar Matrisi'ne ekle.
3. `entegrasyonlar.md` matrisine ekle.
4. `BENI-OKU.md` tablosunu güncelle.
5. `_AJAN-STANDARDI.md` katmanlama tablosuna ekle.
6. PRD §14 matrisiyle tutarlılığı doğrula.

## 📝 Notlar
- Bu klasör **bağımsızdır** — başka kuruluma bağlı değil; ancak bu sürüm TikFinity klonu projesine özelleştirilmiştir (`PRD.md` + `CLAUDE.md` okunmadan kullanılmamalı).
- 34 ajan projenin tüm faz ihtiyaçlarını (Faz 0-8) kapsar.
- Anthropic/Google ile resmi bağı olmayan, kullanıcı tarafından oluşturulmuş şablondur.
