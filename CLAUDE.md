# CLAUDE.md — LiveKit (TikFinity Klonu) Proje Talimatları

> Bu dosya Claude Code'un bu projede nasıl çalışacağını tanımlar. Her oturumda önce bu dosya, sonra `PRD.md`, sonra ilgili `docs/sekmeler/*.md` okunur.

## 1. Proje Nedir

`tikfinity.zerody.one` (v1.70.1) uygulamasının **birebir klonu**: TikTok LIVE yayıncıları için sesli uyarılar, TTS, etkileşimli overlay'ler, chatbot, puan ekonomisi ve mini oyunlar. Tüm ürün gereksinimleri **`PRD.md`** dosyasındadır — UI ölçüleri, renk token'ları, enum listeleri (20 eylem tipi, 15 tetikleyici), widget envanteri ve faz planı oradadır. PRD ile çelişen hiçbir karar alınmaz; değişiklik gerekiyorsa önce `docs/ADR/` altına ADR yazılır.

**Mevcut faz:** Faz 0-1 (iskelet + start/setup/actionsandevents klonu, mock veri). **Veri bağlantısı (Supabase + TikTok connector) sonradan kurulacak** — tüm veri erişimi `lib/data/ports.ts` interface'leri üzerinden; şimdilik yalnız `lib/data/mock/` implementasyonu yazılır. Supabase'e özgü kod Faz 2 onayı olmadan yazılmaz.

## 2. Teknoloji Yığını

- **Next.js 15+ (App Router) + React 19 + TypeScript strict** — `any` yasak
- **Tailwind CSS v4** + shadcn/ui — tema token'ları `app/globals.css` içinde CSS değişkeni olarak (PRD §4.1 hex tablosu birebir)
- **next-intl** — diller: `tr` (varsayılan), `en`, `de`, `es`; mesajlar `messages/{locale}.json`, namespace şeması PRD §11
- **Zod** schema-first (FE/BE paylaşımlı, `lib/schemas/`)
- React Hook Form, TanStack Query + Table, Zustand
- Vitest + Playwright + Testing Library + MSW + axe
- **pnpm** (npm/yarn kullanma)

## 3. Komutlar

```bash
pnpm dev          # geliştirme sunucusu
pnpm build        # üretim derlemesi
pnpm lint         # eslint + prettier kontrol
pnpm typecheck    # tsc --noEmit
pnpm test         # vitest (unit)
pnpm e2e          # playwright
pnpm i18n:check   # eksik/hardcoded string denetimi
```

Her görev tesliminden önce: `pnpm lint && pnpm typecheck && pnpm test` yeşil olmalı. Kanıtsız "tamamdır" yok — komut çıktısı raporda gösterilir.

## 4. Klasör Yapısı

```
app/
  [locale]/                 # next-intl locale segmenti
    (app)/                  # giriş gerektiren SPA kabuğu (sidebar+topbar layout)
      start/  setup/  actionsandevents/  sounds/  tts/  chatbot/
      chatcommands/  overlays/  docks/  goals/  countdown-goals/
      user/  transactions/  wheel/  coindrop/  timer/  likeathon/
      challenge/  halving/  songrequests/  rtmpgen/  dapi/
      agencies/  ...        # her modül = bir route (PRD §2 envanteri)
    (auth)/login/
  widget/[widgetId]/        # OBS browser source — locale'siz, chrome'suz, şeffaf bg
  api/                      # Route Handlers
components/
  layout/                   # Topbar, IconRail, SubMenu, SectionNavigator, Banners
  ui/                       # shadcn türevleri + DxTable (TanStack), Toggle, Slider...
  modules/<modül>/          # modüle özel bileşenler
  widgets/<widgetId>/       # widget render bileşenleri
lib/
  schemas/                  # Zod: action.ts, event.ts, widget.ts, points.ts...
  data/
    ports.ts                # Repo/Service interface'leri (TEK erişim noktası)
    mock/                   # Faz 0-1 implementasyon + sahte olay üretici
    supabase/               # Faz 2 (şimdilik boş, dokunma)
  engine/                   # kural motoru: eşleştirme, cooldown, kuyruk (saf TS, UI'sız)
  i18n/
messages/tr.json en.json de.json es.json
docs/
  sekmeler/<sıra>-<ad>.md   # SEKME = DOSYA kuralı (zorunlu)
  ADR/
.claude/agents/             # proje ajanları (bkz. §6)
```

## 5. Kod Kuralları

1. **Server Components first**; `'use client'` yalnız yaprak bileşenlerde.
2. **Hardcoded string YASAK** — tüm UI metni `useTranslations()` / `getTranslations()`; yeni metin eklerken 4 dilin dördüne de anahtar eklenir (çeviri bilinmiyorsa `en` değeriyle doldur + `// TODO(i18n)` işaretle, `pnpm i18n:check` yakalar).
3. **Tema:** hex değerleri bileşenlere gömme; yalnız `globals.css` token'ları (`--primary: #D43555` vb.) ve Tailwind semantic sınıfları. PRD §4 ölçüleri (54px topbar, 64px ray, 256px alt menü, 860-902px kartlar) sabittir.
4. **Enum'lar tek kaynaktan:** eylem/tetikleyici/widget tipleri `lib/schemas/` içindeki Zod enum'larından türetilir; PRD'deki enum adları (`showText`, `gift_min`, `topgifter`…) birebir korunur — UI etiketi i18n'den gelir.
5. **Kural motoru saf TypeScript** (`lib/engine/`) — DOM/framework bağımlılığı yok, %95+ test kapsamı hedefi.
6. **Puan işlemleri:** tamsayı, append-only ledger deseni; float yasak.
7. Formlar: RHF + Zod resolver; her sayfa 4 durum (loading / empty / error / success).
8. Erişilebilirlik baştan: modal focus trap, klavye navigasyonu, `prefers-reduced-motion`, kontrast.
9. Commit: Conventional Commits, atomik. Sırlar asla kodda (`.env.local`).
10. Widget sayfaları (`/widget/*`) şeffaf arka plan, harici font yüklemesi optimize, 60fps animasyon bütçesi.

## 6. Çok-Ajanlı Çalışma Düzeni

Ajanlar `.claude/agents/` altındadır ve **bu projeye özel geliştirilmiş** sürümlerdir. Kurallar:

- Karmaşık/çok adımlı işler **orkestrator** üzerinden planlanır; orkestrator kod yazmaz, delege eder.
- Her delegasyonda girdi kontratı verilir: HEDEF / KAPSAM SINIRI / İLGİLİ DOSYALAR / KABUL KRİTERİ / BEKLENEN ÇIKTI.
- Her kod çıktısı **kod-inceleyici**'den; güvenlik dokunuşu olanlar **guvenlik-denetcisi**'nden; UI işleri **erisilebilirlik-denetcisi**'nden geçer.
- Yeni sekme/modül işi bittiğinde **dokumantasyon-yazari** `docs/sekmeler/<sıra>-<ad>.md` dosyasını günceller (sekme = dosya kuralı çiğnenemez).
- Proje-kritik ajanlar: `realtime-uzmani`, `tiktok-live-uzmani`, `overlay-widget-uzmani` (yeni eklenenler), `on-yuz-gelistirici`, `arka-yuz-gelistirici`, `supabase-uzmani` (Faz 2+), `yerellestirme-uzmani`, `test-muhendisi`.
- Ajan seçim matrisi: PRD §14.

## 7. Faz Disiplini

- Aktif faz dışındaki modüller için **route iskeleti + "yakında" durumu** dışında kod yazılmaz.
- Faz geçişi = orkestrator onayı + önceki fazın kabul kriterlerinin (PRD §15) kanıtlanması.
- Mock adapter'daki interface imzaları değişecekse ADR gerekir (Faz 2 Supabase geçişini kırmamak için).

## 8. Birebir Klon Standardı

- Referans ekran görüntüleri/HTML: kullanıcının `tinkifity` klasöründeki kayıtlı sayfalar ((2) TikFinity.html = setup, Anasayfa.html = start, eylemler.html = actionsandevents). Görsel karşılaştırmada bu kaynaklar esas alınır.
- Metinlerin kaynak dili EN (orijinal i18n dump'ı); TR metinler orijinal Türkçe çevirilerle uyumlu (ör. "Kurmak", "Katmanlar", "Eylemler ve Etkinlikler", "TikTok LIVE'a bağlanın", "Hızlı Erişim", "Maceranıza başlayalım!").
- Marka adı klonda **"LiveKit"** olarak parametriktir (`NEXT_PUBLIC_APP_NAME`); TikFinity logo/varlıkları kopyalanmaz, eşdeğer özgün varlıklar üretilir. *(Hukuki not: birebir ticari kopya riskleri için hukuk-uyum-danismani raporu Faz 7 öncesi zorunlu.)*

## 9. Tanımlar

- **Eylem (Action):** tetiklenince olan şey (medya, TTS, OBS, webhook… — 20 tip).
- **Etkinlik (Event):** tetikleyici kuralı (15 tip + 6 rol filtresi + koşullar).
- **Ekran (Screen):** 8 bağımsız overlay kuyruğu (`/widget/myactions?screen=N`).
- **Widget:** OBS browser source olarak eklenen render sayfası (PRD §5.4 envanteri).
- **Profil (Stream Profile):** kullanıcı başına ayrı ayar seti (Free 1 / Pro 10).
