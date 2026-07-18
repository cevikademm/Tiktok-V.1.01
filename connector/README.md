# Overlay Connector Worker

Hibrit overlay mimarisinin **kalıcı** parçası (ADR-0003). Vercel'in yapamadığı tek şeyi
yapar: TikTok canlı bağlantısını (Euler Cloud WebSocket) sürekli açık tutmak, olayları
sunucu kural motorundan geçirmek ve eşleşen action'ı **Supabase Realtime** ile widget'lara
yayınlamak.

```
Panel (Vercel) ──POST /api/overlay/register──▶ Supabase: overlay_configs
                                                      │  (connector polling ile okur)
Connector (bu worker) ◀───────────────────────────────┘
   │  Euler Cloud WS (TikTok olayları)  →  RuleEngine  →  eşleşen action
   ▼
Supabase Realtime Broadcast  (overlay-<id>-<screen>)
   ▼
Widget /widget/myactions?id=…&screen=N  (OBS / TikTok LIVE Studio)  →  animasyon + ses
```

## Gerekli ortam değişkenleri

| Değişken | Açıklama |
|---|---|
| `SUPABASE_URL` | Supabase proje URL'i (`https://<ref>.supabase.co`) |
| `SUPABASE_SERVICE_ROLE_KEY` | **service_role** secret (Dashboard → Settings → API). Gizli. |
| `EULER_STREAM_API_KEY` | Euler Stream API anahtarı (https://www.eulerstream.com) |
| `CONNECTOR_POLL_MS` | (opsiyonel) config polling aralığı, varsayılan `3000` |

## Yerel çalıştırma (test)

Kök dizinde (`.env.local` yüklenir):

```bash
pnpm connector
```

`overlay_configs` boşsa sessiz bekler. Panelde bir yayına bağlanıp overlay linkini
kullandığında connector upstream'i açar ve logprovider.

## Deploy (Railway örneği — ücretsiz katman)

Bu **Next.js uygulamasıyla AYNI repo**, ayrı bir servis olarak çalışır (Node ≥ 22):

1. [railway.app](https://railway.app) → **New Project → Deploy from GitHub repo** → bu repo.
2. Root directory: `tikfinity-klon`.
3. **Settings → Deploy → Start Command:** `pnpm connector`
4. **Variables:** yukarıdaki 3 zorunlu env'i ekle (Vercel'dekiyle aynı Supabase + Euler).
5. Deploy. Loglarda `[connector] başladı` görünmeli.

> Not: Bu worker HTTP portu dinlemez (web servisi değil). Railway "no open ports"
> uyarısı verebilir — normaldir. Render'da "Background Worker" tipi seçilir.

Aynı repo Vercel'e web uygulaması olarak deploy edilir; Vercel connector'ı yok sayar
(sadece `connector/` klasörünü çalıştırmaz). İki servis aynı Supabase + Euler anahtarını
paylaşır.
