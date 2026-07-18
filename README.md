# LiveKit — TikFinity Klonu

TikTok LIVE yayıncıları için etkileşim stüdyosu: hediye/beğeni/takip/yorum olaylarını
sesli uyarı, overlay, chatbot, puan ekonomisi ve oyun eylemlerine bağlar.

> **Mevcut faz: Faz 0-1.** Arayüz ve kural motoru çalışıyor; veri **mock** katmandan geliyor.
> Supabase, gerçek TikTok connector ve auth **Faz 2**'de gelecek (bkz. `PRD.md` §12).
> Ürün gereksinimleri `PRD.md`, çalışma kuralları `CLAUDE.md` içindedir.

## Hızlı başlangıç

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

Uygulama kökü `/start`'a yönlenir. Diller: `/start` (tr, varsayılan), `/en/start`, `/de/start`, `/es/start`.

## Komutlar

| Komut | Ne yapar |
|---|---|
| `pnpm dev` | Geliştirme sunucusu (Turbopack) |
| `pnpm build` | Üretim derlemesi (122 statik sayfa) |
| `pnpm start` | Üretim sunucusu |
| `pnpm lint` | ESLint (React Compiler kuralları dahil) |
| `pnpm typecheck` | `tsc --noEmit` (strict) |
| `pnpm test` | Vitest — kural motoru birim testleri |
| `pnpm e2e` | Playwright — uçtan uca + axe erişilebilirlik |
| `pnpm i18n:check` | 4 dilde anahtar/placeholder paritesi |

`pnpm e2e` sistemde kurulu **Chrome**'u kullanır (`channel: "chrome"`) — Playwright'ın
kendi Chromium'unu indiremeyen kısıtlı ağlarda da çalışır.

## Sayfalar (Faz 1'de uygulanan)

| Rota | Modül | İçerik |
|---|---|---|
| `/start` | `start` | 10 bölüm: promo, hoş geldin, bağlantı, Hızlı Erişim, ajanslar, kanal, haberler, PRO, nasıl kullanılır, SSS |
| `/setup` | `setup` | 14 alt bölüm: TikTok bağlantısı, puan sistemi, seviyeler, OBS/Streamer.bot/Minecraft, Pro, hesap, gelişmiş, debug |
| `/actionsandevents` | `actionsandevents` | Otomasyon çekirdeği: 20 eylem tipi, 15 tetikleyici, 4 tablo, Event Simulator |
| `/widget/myactions?cid=…&screen=1-8` | widget | OBS browser source — şeffaf, chrome'suz |

Diğer 26 modül route iskeleti + "yakında" durumunda (CLAUDE.md §7 faz disiplini).

## Mimari

```
Olay kaynağı (Faz 1: mock simülatör · Faz 2: TikTok connector)
        ↓
   RealtimeBus  ──→  RuleEngine (lib/engine — saf TS, UI'sız)
                       ├─ dedup (idempotency)
                       ├─ eşleştirme (tetikleyici + koşul + rol)
                       ├─ cooldown (global + kullanıcı)
                       └─ ekran kuyrukları (8 × FIFO + heartbeat)
                              ↓
                     /widget/* (OBS browser source)
```

**Veri erişimi tek noktadan:** `lib/data/ports.ts` interface'leri. Faz 1 `lib/data/mock/`,
Faz 2 `lib/data/supabase/` aynı imzalarla gelir — UI değişmez.

```
app/[locale]/(app)/…   SPA kabuğu (topbar 54px + ikon rayı 64px + alt menü 256px)
app/widget/[widgetId]/ OBS yüzeyi (locale'siz, şeffaf)
components/            layout · ui · modules/<modül> · widgets
lib/                   schemas (Zod) · data (ports+mock) · engine · i18n · nav
messages/              tr.json en.json de.json es.json  (506 anahtar × 4)
docs/sekmeler/         her sekme = ayrı dosya (CLAUDE.md §4 — zorunlu)
docs/ADR/              mimari kararlar
```

## Faz 0-1 durumu (PRD §15 kabul kriterleri)

| # | Kriter | Durum |
|---|---|---|
| 1 | `pnpm dev` açılır, 4 dil çalışır, hardcoded string yok | ✅ `pnpm i18n:check` |
| 2 | Layout birebir (54/64/256px, token'lar) | ✅ e2e ölçüm testi |
| 3 | `start` 10 bölüm + gezgin + kalıcı toggle | ✅ |
| 4 | `setup` 14 bölüm + validasyon + mock test akışı | ✅ |
| 5 | `actionsandevents` editörler + 4 tablo + simülatör | ✅ |
| 6 | `/widget/myactions` render + kuyruk | ✅ |
| 7 | Pro gating görünür | ✅ (limit sayaçları mock) |
| 8 | `pnpm test` + `pnpm e2e` yeşil, A11y | ✅ 42 unit + 19 e2e, axe kritik/ciddi ihlal 0 |
| 8 | Lighthouse ≥ 90 | ⏳ ölçülmedi |

## Widget'ı deneme

1. `/actionsandevents` → **Yeni Eylem Oluştur** (ör. "Show Alert" + metin `{username} geldi!`)
2. **Yeni Etkinlik Oluştur** → tetikleyici **Takip** → eylemi bağla
3. Widget URL'sini kopyala (Overlay Ekran Ayarları tablosu) → **ayrı sekmede** aç
4. Uygulama sekmesinde **Takip Simüle Et** → metin widget sekmesinde belirir

Olaylar sekmeler arasında `BroadcastChannel` ile taşınır (`lib/data/mock/index.ts`).
`?preview=1` eklersen widget kendi demo akışını üretir.

## Bilinen sınırlamalar (Faz 1)

- **Gerçek TikTok bağlantısı yok** — "Bağlan" mock durum makinesi (Disconnected → Connecting → LIVE).
- **Auth yok** — giriş kapısı Faz 2. Şu an tüm sayfalar açık.
- **Widget OBS'te olay almaz.** OBS'in browser source'u ayrı bir tarayıcı sürecidir;
  `BroadcastChannel` yalnız aynı origin'deki sekmelere ulaşır. Gerçek OBS akışı için
  PRD §6.3'teki **WS gateway** gerekir → Faz 2.
- **`cid` parametresi henüz yok sayılıyor** — tek kanal varsayımı. Çok kanallı oda
  modeli (PRD §6.3) Faz 2'de gelir.
- **Kalıcılık localStorage'da** — tarayıcı temizlenince veri gider.
- Medya yüklemeleri `URL.createObjectURL` ile yalnız oturum içinde geçerli.
- Sticker/emote seçici modalları düz input olarak yapıldı (PRD §5.3 grid seçici bekliyor).
- TTS/ses/chatbot/overlay galerisi vb. faz dışı (route iskeleti mevcut).

## Fontlar

Outfit ve Inter `app/fonts/` altında **self-host** edilir (`next/font/local`).
`next/font/google` bilinçli olarak kullanılmıyor: derleme/dev sırasında
fonts.gstatic.com'a bağlanır ve ağın kısıtlı olduğu ortamda dev sunucusu istek başına
dakikalarca askıda kalır. Self-host derlemeyi ağdan bağımsız ve deterministik yapar.

## Marka notu

Marka adı `NEXT_PUBLIC_APP_NAME` ile parametriktir (varsayılan "LiveKit").
TikFinity logo/varlıkları kopyalanmaz; eşdeğer özgün varlıklar üretilir (CLAUDE.md §8).
Ticari kopya riskleri için `hukuk-uyum-danismani` raporu Faz 7 öncesi zorunludur.

## Auth Kurulumu (Supabase Dashboard)

Kod tarafı hazır (e-posta onaylı giriş + Google OAuth + sert kapı). Aşağıdaki panel
adımları **Supabase Dashboard'da bir kez** yapılır (bağlı proje MCP dışı olduğu için elle):

1. **profiles tablosu** — SQL Editor → `supabase/migrations/0001_auth_profiles.sql` yapıştır → Run.
2. **E-posta onayı** — Authentication → Sign In / Providers → Email:
   - "Enable Email provider" açık, **"Confirm email" AÇIK** (onaylı giriş için).
3. **Google OAuth** — Authentication → Sign In / Providers → Google → Enable:
   - Google Cloud Console → APIs & Services → Credentials → OAuth Client ID (Web).
   - Authorized redirect URI: `https://<ref>.supabase.co/auth/v1/callback`
   - Alınan **Client ID** ve **Client Secret**'ı Supabase Google provider ekranına yapıştır.
4. **URL Configuration** — Authentication → URL Configuration:
   - **Site URL:** `http://localhost:3000` (üretimde gerçek alan adı).
   - **Redirect URLs** (Add URL): `http://localhost:3000/**` ve üretim alan adı için
     `https://<alan-adi>/**`. (Uygulama callback'i `/auth/callback` yolunu kullanır.)
5. **E-posta şablonu (opsiyonel)** — varsayılan şablon `?code=` ile `/auth/callback`'e
   döner (desteklenir). `{{ .TokenHash }}` kullanan özel şablon `/auth/confirm`'e döner
   (o da desteklenir) — ikisi de çalışır.

Env değişkenleri (`.env.local`): `NEXT_PUBLIC_SUPABASE_URL` ve
`NEXT_PUBLIC_SUPABASE_ANON_KEY` yeterlidir (Auth bunları kullanır).
