# ADR-0001 — Rozet metninde `--text-muted` yerine `--text-muted-2`

- **Tarih:** 2026-07-16
- **Durum:** Kabul edildi
- **Faz:** Faz 1
- **Karar veren:** `erisilebilirlik-denetcisi` + `on-yuz-gelistirici` (PRD §4.5 bu onayı zorunlu kılıyor)

## Bağlam

PRD iki gereksinimi aynı anda dayatıyor:

- **§4.1 Tema:** hex tablosu **birebir** uygulanacak — `--text-muted: #949494`.
- **§13 Fonksiyonel olmayan gereksinimler:** **WCAG 2.2 AA** zorunlu — normal metin için kontrast **4.5:1**.

Alt menüdeki "Yakında" rozeti `bg-white/8` yüzeyi üzerinde duruyor. Bu yüzey
`--secondary` (`#212121`) üzerine %8 beyaz bindirince efektif olarak `#333333` oluyor.
Ölçüm (axe-core, `e2e/app.spec.ts` erişilebilirlik paketi):

| Ön plan | Arka plan | Oran | AA (4.5:1) |
|---|---|---|---|
| `#949494` (`--text-muted`) | `#333333` | **4.16:1** | ✖ |
| `#9B9B9B` (`--text-muted-2`) | `#333333` | **4.55:1** | ✓ |

Yani `#949494` **kart yüzeylerinde sorunsuz** (`#1C1C1C` → 5.62:1, `#212121` → 5.31:1,
`#222222` → 5.24:1); yalnız `bg-white/8` bindirmesi olan yüzeyde eşiğin altına düşüyor.
axe bu ihlali 3 sayfada 16 düğümde raporladı.

## Karar

`bg-white/8` bindirmeli yüzeylerdeki küçük metinlerde `--text-muted` yerine
**`--text-muted-2` (`#9B9B9B`)** kullanılacak.

Bu **palet dışına çıkmak değildir**: `#9B9B9B` PRD §4.1'in `--text-muted` satırında
zaten listelenen ikinci tondur ("`#949494`, `#9B9B9B`, `white/50-70`"). PRD'nin kendi
paleti içinden, bağlama uygun tonu seçiyoruz.

Ayrıca `link-in-text-block` ihlali için: metin içi linkler (Hoş geldin kartı)
`underline underline-offset-2` alır. Sadece renkle ayrışmak WCAG 1.4.1'i ihlal ediyordu
(link rengi ile çevre metin arasındaki kontrast 1.13:1, gereken 3:1).

## Gerekçe

- Kontrastı düşürmek yerine paletin içinden çözüm bulundu → PRD §4.1 ile çelişki yok.
- Görsel fark ihmal edilebilir (iki gri arasında 7 birim), birebir klon standardı (CLAUDE.md §8) korunuyor.
- Alternatif — rozetten `bg-white/8` kaldırmak — `#949494`'ü 5.31:1'e çıkarırdı ama
  rozetin görsel kimliğini (pill formu) bozardı; orijinalde rozet zeminlidir.

## Sonuçlar

- ✅ 3 sayfada axe kritik/ciddi ihlal sayısı **0** (`pnpm e2e`, 19/19 yeşil).
- ⚠️ 4.55:1 eşiğe yakın. `bg-white/8` bindirmesi koyulaşırsa (ör. `bg-white/12`) tekrar düşer.
  Yeni bindirme yüzeyi eklendiğinde kontrast **ölçülmeli** — axe testi bunu CI'da yakalar.
- `--text-muted` kart yüzeylerinde kullanılmaya devam ediyor; genel bir değişiklik değildir.

## Uygulama

- `components/layout/sub-menu.tsx` — "Yakında" rozeti `text-muted-2`
- `components/modules/start/connection-card.tsx` — metin içi linkler `underline`
- `e2e/app.spec.ts` — `Erişilebilirlik (PRD §15.8 · WCAG 2.2 AA)` paketi regresyonu engeller
