# Admin — 🐞 Hata Bildirimleri (`error_reports`)

- **PRD referansı:** Yok (PRD dışı operasyonel/iç araç — Geçit KFZ referans modülünden uyarlandı).
- **Faz:** Faz 0-1 — uygulandı (Supabase'siz, localStorage kalıcılığı).
- **Modül `pageId`:** `errorReports` (route tabanlı; `lib/nav.ts` NAV dizisinde DEĞİL — admin-gated ayrı nav öğesi olarak `IconRail`'de render edilir).

---

## Sekmenin amacı ve hedef kullanıcı

Admin, uygulamayı kullanırken karşılaştığı bir hatayı sağ-alttaki WhatsApp FAB'ına
basarak ekran görüntüsü + açıklama + önem derecesiyle bildirir. Kayıt yerelde
saklanır ve WhatsApp destek hattına (`+905324961412`) önceden doldurulmuş metinle
iletilir. "🐞 Hata Bildirimleri" paneli tüm kayıtları liste/filtre/durum/zoom ile yönetir.

**Hedef kullanıcı:** Uygulamayı çalıştıran kişi (yerel tek-kullanıcılı araç; kimlik/rol
sistemi yok). Bu yüzden FAB + nav öğesi + panel **varsayılan olarak GÖRÜNÜR**; gizlemek
isteyen `localStorage.tikfinity_hata_admin = '0'` ile kapatabilir (opt-out).

---

## Bağlı route, dosya yolları, bileşenler

| Katman | Yol |
|---|---|
| Route | `/<locale>/hata-bildirimleri` (varsayılan `tr`'de prefix'siz) |
| Sayfa | `app/[locale]/(app)/hata-bildirimleri/page.tsx` |
| FAB + modal | `components/error-report/hata-bildir-widget.tsx` |
| Panel | `components/error-report/hata-bildirimleri-panel.tsx` |
| Tarayıcı yardımcıları | `lib/error-report/client.ts` (screenshot / WhatsApp / telefon / admin bayrağı) |
| Kalıcılık + hook'lar | `lib/error-report/store.ts` |
| Tipler | `lib/error-report/types.ts` |
| Mock store alanı | `lib/data/mock/store.ts` (`MockState.errorReports`) |

**Bileşen ağacı:**

```
app/[locale]/(app)/layout.tsx           → kabuk (Topbar + IconRail + SubMenu + main)
├── IconRail                            components/layout/icon-rail.tsx
│   └── 🐞 nav butonu (admin-gated + çözülmemiş rozeti)   icon-rail.tsx (Bug link → /hata-bildirimleri)
└── HataBildirWidget (FAB + modal)      components/error-report/hata-bildir-widget.tsx

app/[locale]/(app)/hata-bildirimleri/page.tsx
└── HataBildirimleriPanel               components/error-report/hata-bildirimleri-panel.tsx
```

**Nav kaydı:** Standart `lib/nav.ts` NAV dizisine EKLENMEDİ — çünkü NAV sunucuda
render edilir ve admin-gated değildir (feature herkese sızardı). Bunun yerine
`IconRail` içinde `useIsErrorAdmin()` ile client tarafında koşullu render edilir;
i18n etiketi `nav.errorReports` (4 dilde).

---

## API çağrıları ve veri şeması

> **Bu fazda Supabase/HTTP YOK.** Tüm veri erişimi mevcut mock store üzerinden gider
> (`lib/data/mock/store.ts`, `localStorage` anahtarı `livekit.mock.v1`). Faz 2'de
> `error_reports` tablosuna taşınabilir (alan adları birebir eşlenebilir).

**`ErrorReport` şeması** (`lib/error-report/types.ts`):

| Alan | Tip | Not |
|---|---|---|
| `id` | `string` | `err_<zaman36>_<rastgele>` |
| `reporterName` | `string` | Sabit `"Admin"` (kimlik sistemi yok) |
| `severity` | `"low" \| "normal" \| "high"` | Önem |
| `status` | `"new" \| "in_progress" \| "resolved"` | İş akışı |
| `description` | `string` | Zorunlu (boşsa gönderim engellenir) |
| `pageUrl` / `pagePath` | `string \| null` | Bildirim anındaki konum |
| `userAgent` / `screenSize` / `appVersion` | `string \| null` | Otomatik meta |
| `screenshotData` | `string \| null` | base64 **JPEG (kalite 0.7)** — Storage yok, kayda gömülü |
| `createdAt` / `resolvedAt` | `string \| null` | ISO 8601 |

**Kalıcılık çağrıları** (`lib/error-report/store.ts`):

| Fonksiyon | Ne yapar |
|---|---|
| `addErrorReport(rec)` | `mutate` ile başa ekler |
| `setErrorReportStatus(id, status)` | Durumu değiştirir; `resolved` ise `resolvedAt` damgalar |
| `removeErrorReport(id)` | Kaydı siler |
| `useErrorReports()` | En yeni önce sıralı liste |
| `useUnresolvedErrorCount()` | `new + in_progress` sayısı (nav rozeti) |

---

## State yönetimi

- Kalıcılık: mevcut mock store (`useSyncExternalStore` → `useMockStore`), ayrı depo açılmadı.
- Ekran görüntüsü: `html2canvas-pro` (viewport yakalama, 2–2.5x supersampling, JPEG q0.7).
  **Not:** orijinal `html2canvas@1.4.1`, Tailwind v4'ün `oklch()/oklab()/color-mix()`
  renklerinde "unsupported color function" atıp yakalamayı bozuyordu; bakımlı fork
  `html2canvas-pro@2` bunları destekler.
- Admin bayrağı: `useIsErrorAdmin()` → hidrasyon-güvenli `useLocalStorage`, sunucuda `false`.

---

## Erişim kontrolü (RLS / role)

- **Rol sistemi yok.** Görünürlük `localStorage.tikfinity_hata_admin` bayrağına bağlıdır
  (FAB, nav öğesi ve panel içeriği aynı kapıyı kullanır) ve **varsayılan GÖRÜNÜR**tür.
- Gizlemek: `localStorage.setItem('tikfinity_hata_admin','0')` → sayfayı yenile.
- Tekrar göstermek: `localStorage.removeItem('tikfinity_hata_admin')` → yenile.
- **Sağlamlık:** `useUnresolvedErrorCount` / `useErrorReports` ve mutasyonlar, alanı
  olmayan eski/kısmi localStorage kayıtlarına karşı `?? []` ile korunur (aksi halde
  `IconRail` → kabuk çöker). Bu yüzden modül eski verili tarayıcılarda da açılır.
- Numara override (koda dokunmadan): `localStorage.setItem('tikfinity_hata_admin_phone','905324961412')`
  veya `.env`: `NEXT_PUBLIC_HATA_ADMIN_PHONE=905324961412`.
- **Güvenlik notu:** Bu client-side bir görünürlük kapısıdır, güvenlik sınırı DEĞİLDİR.
  Veri yalnız kullanıcının kendi tarayıcısındadır (Supabase/sunucu yok), bu yüzden
  yetkisiz veri erişimi riski oluşturmaz. Faz 2'de sunucuya taşınırsa gerçek RLS gerekir.

---

## Test senaryoları

`e2e` (Playwright, prod build, gerçek Chrome) — 16/16 geçti:
FAB görünürlüğü (admin/non-admin çift yön), modal, +905324961412, otomatik screenshot
(html2canvas-pro), boş açıklama uyarısı, localStorage kayıt (severity/status/base64),
panel liste/rozet/zoom, durum→resolved + resolvedAt. Ayrıntı: aşağıdaki "Test checklist".

---

## Bilinen sınırlamalar

- **Ekran görüntüsü eki — iki yol:** Önce **Web Share API** (`navigator.share({ files })`)
  denenir; mobilde ve modern masaüstü Chromium'da görüntü mesaja **dosya olarak eklenir**
  (paylaşım ekranından WhatsApp seçilir). Bu yol belirli bir numaraya sabitlenemez —
  kullanıcı alıcıyı seçer. Desteklenmeyen tarayıcıda **yedek** olarak görüntü indirilir
  ve `wa.me/905324961412` deep-link'i açılır (deep-link dosya taşıyamaz → 📎 ile elle iliştirilir).
  Bkz. `shareReportWithScreenshot` · `lib/error-report/client.ts`.
- **localStorage kotası:** base64 JPEG kayıtlar `livekit.mock.v1` içinde birikir; çok
  sayıda büyük görüntü kota sınırına yaklaşabilir (kalite 0.7 ile hafifletildi).
- **Admin bayrağı aynı sekmede canlı değişmez:** konsoldan set edip sayfayı yenilemek gerekir
  (farklı sekmedeki değişiklik `storage` olayıyla yansır).
- Supabase yok → çoklu cihaz senkronu yok (Faz 2).

---

## Değişiklik geçmişi

| Tarih | Değişiklik |
|---|---|
| 2026-07-16 | Modül eklendi: FAB + modal + admin paneli, mock store kalıcılığı, admin-gated nav. `html2canvas-pro` (Tailwind v4 oklch uyumu). |
| 2026-07-17 | **Fix:** eski localStorage'da `errorReports` tanımsızken `IconRail` kabuğu çökmesi (`?? []` guard). Görünürlük varsayılan **GÖRÜNÜR** yapıldı (opt-out `'0'`). |
| 2026-07-17 | **Feat:** ekran görüntüsü artık **Web Share API** ile mesaja dosya olarak eklenir (`shareReportWithScreenshot`); wa.me yedek yola düşürüldü. |
