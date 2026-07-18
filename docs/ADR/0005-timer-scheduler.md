# ADR-0005 — Zamanlayıcı (Timer) çalıştırıcısı: overlay runtime'ında aralıklı eylem

- **Tarih:** 2026-07-18
- **Durum:** Kabul edildi
- **Faz:** Faz 1.5 (ADR-0002/0003 overlay runtime'ını genişletir)
- **Karar veren:** kullanıcı onayı (hata bildirimi `err_mrpf0bnq_fpx164` — "Timer'ları çalıştır")

## Bağlam

`actionsandevents` sayfasındaki **Zamanlayıcılar** bölümü (aralık dakikası + bağlı eylem)
tanımlanabiliyor, listeleniyor ve siliniyordu; ama **hiçbir yerde ateşlenmiyordu** —
`timers` ne `/api/overlay/register`'a gidiyordu, ne `overlay_configs`'te tutuluyordu, ne
de bir zamanlayıcı vardı (bkz. `docs/sekmeler/03` eski sınırlama #8). Beklenen davranış
(PRD §6.2 "Timer olayları" + hata bildirimi): *yayın canlıyken backend her N dakikada bir
bağlı eylemi ilgili ekrana tetikler ("Timer yayına girdiğinizde başlar").*

Etkinliklerden (Events) farkı: timer'ın **tetikleyicisi/olayı yoktur** — eylemi doğrudan
`actionId` ile adlar. Kullanıcı bağlamı da yoktur (`{username}` gibi placeholder'lar boş).

## Karar

**Zamanlayıcı, mevcut overlay runtime'ının içinde çalışır — yeni bir taşıma/altyapı yok.**

**1. Doğrudan çalıştırma — `RuleEngine.fireAction(actionId, ev)`.** Eylemi tetikleyici
eşleştirmesi (matcher) OLMADAN kuyruğa alır. Kullanıcı/genel **cooldown uygulanmaz**
(aralığın kendisi hız sınırı), **dedup uygulanmaz** (her atış kasıtlı). Kuyruk kapasitesi /
offline ekran / geçersiz ekran reddi korunur → çağıran taraf mevcut "queued → teslim et →
auto-dequeue" döngüsünü BİREBİR yeniden kullanır (`lib/engine/index.ts`).

**2. Saf-TS zamanlayıcı çalıştırıcısı — `lib/overlay/timer-runner.ts`.**
`createTimerRunner({ getTimers, fire })`: her AKTİF timer için `intervalMinutes` aralığında
`fire(timer)` çağırır; `sync()` CRUD değişimlerini uzlaştırır (ekle/çıkar/aralık-güncelle);
`start()/stop()` canlılık sınırını yönetir. `setInterval`/`clearInterval` enjekte edilebilir
(fake timers testi). Atış anında güncel timer taze okunur (aralık değişmeden `actionId`
değişse bile doğru çalışır).

**3. Sentetik "sistem" olayı — `systemLiveEvent()`.** `buildActionMessage` bir `LiveEvent`
ister; timer'ın kullanıcısı olmadığından boş `user`'lı `type:"timer"` bir olay üretilir
(`lib/schemas/live.ts`). Placeholder'larda kullanıcı alanları boş çözülür.

**4. İki runtime'a da bağlı (BİREBİR aynı desen).**
- **SSE hub** (`lib/server/overlay-hub.ts`, yerel/tek-süreç): her overlay entry'sine bir
  `timerRunner`; **ilk abone** gelince `start()`, **son abone** gidince `stop()`.
  Yani "canlılık = widget (OBS kaynağı) açık". TikTok bağlantısı gerektirmez.
- **Connector** (`connector/index.ts`, Vercel-dışı kalıcı worker): upstream (username)
  açıkken `start()`, kapanınca `stop()`. Yani "canlılık = yayın bağlı".

**5. Config taşıma — `overlay_configs`'e `timers jsonb` kolonu.** actions/events/screens
ile AYNI yol: panel `useOverlaySync` → `/api/overlay/register` → Supabase upsert (hibrit) VEYA
bellek hub. Connector poll'da `timers`'ı da okur. (`supabase/migrations/0005_overlay_timers.sql`.)

## Gerçekleşen alternatifler / neden JSONB kolon (normalize tablo değil)

Kullanıcı "normalize tablolar" tercihini belirtti; ancak yalnız timers'ı normalize etmek
mimariyi yarı-göçmüş bırakırdı: (a) tüm boru hattı **tek `overlay_configs` satırı**
etrafında (connector tek `select`); (b) yerel hub **Supabase'siz** çalışır (`.data/overlays.json`)
— ayrı tablo hub yolunda işe yaramaz; (c) actions/events hâlâ JSONB. Bu yüzden timers da
JSONB kolon olarak eklendi (additive, güvenli). **Tam normalize** (actions/events/timers ayrı
tablolar + `lib/data/supabase/` adaptörü) Faz 2 "Gerçek DB kalıcılığı" işiyle **birlikte**
yapılacaktır.

## Sonuçlar / sınırlar

- **Cooldown yok:** timer atışları global/user cooldown'a takılmaz; aralık tek hız sınırıdır.
- **"Canlılık" tanımı transport'a göre farklı:** hub'da abone (widget), connector'da upstream
  (username). İkisi de "yayına girince başlar"ın makul karşılığıdır. Connector'da "gerçekten
  canlı mı" bilgisi Euler `onStatus`'tan gelir; MVP username+config yeterli sayar, ileride
  `onStatus === live`'a daraltılabilir.
- **Placeholder:** timer eylemindeki `{username}` vb. boş çözülür (beklenen; timer metinleri
  genelde statiktir — ör. "Instagram'ı takip edin").
- **Additive:** `ports.ts` / `TimersRepo` imzaları ve mevcut event akışı değişmedi → regresyon
  yüzeyi dar.

## Uygulama

- `lib/schemas/live.ts` — `liveEventTypeSchema`'ya `"timer"`; `systemLiveEvent()`
- `lib/engine/index.ts` — `RuleEngine.fireAction`; `lib/engine/matcher.ts` — `timer: []`
- `lib/overlay/timer-runner.ts` — çalıştırıcı (yeni)
- `lib/overlay/use-overlay-sync.ts` + `app/api/overlay/register/route.ts` — `timers` taşıma
- `lib/supabase/admin.ts` (`OverlayConfigRow.timers`) + `supabase/schema.sql` + `migrations/0005_*`
- `lib/server/overlay-hub.ts` + `connector/index.ts` — `timerRunner` + `fireTimer` + `deliver` refactor
- `components/providers/app-provider.tsx` — `timers` context; `components/modules/actions/actions-page.tsx` — timer create+edit UI
- Testler: `tests/timer-runner.test.ts`, `tests/engine.test.ts` (`fireAction`), `tests/overlay-hub.test.ts` (timer teslimatı)

## Etkinleştirme (canlıda)

1. Supabase SQL Editor'da `supabase/migrations/0005_overlay_timers.sql` çalıştır (kolon eklenir).
2. Vercel'e deploy + connector worker'ı güncel kodla yeniden başlat.
