# <Sıra> — <Sekme Adı> (`<pageId>`)

> **Şablon kullanımı:** Bu dosyayı `docs/sekmeler/<sıra>-<ad>.md` olarak kopyala, `<...>`
> yer tutucularını doldur ve **kodla doğrula**. CLAUDE.md §4 gereği aşağıdaki sekiz
> başlığın tamamı zorunludur; hiçbiri silinemez — içerik yoksa "Yok" yazılır ve nedeni
> belirtilir.
>
> **Kurallar:**
> - PRD'yi kopyalamak yetmez; doküman **gerçek koda** dayanmalı.
> - Kod referansları `path/to/file.tsx:42` biçiminde verilir.
> - Faz durumu dürüst yazılır (mock mu, gerçek mi, hangi faz).
> - Alt sekmeler tek dosyada `## Alt Bölüm: ...` başlıklarıyla listelenir (CLAUDE.md §4).

- **PRD referansı:** §<x.y>
- **Faz:** Faz <n> — <durum: uygulandı / kısmi / iskelet>
- **Modül `pageId`:** `<pageId>` (`lib/nav.ts` kayıt defterindeki değerle birebir)

---

## Sekmenin amacı ve hedef kullanıcı

<Sekme ne işe yarar, hangi kullanıcı problemini çözer — 2-4 cümle.>

**Hedef kullanıcı:** <ziyaretçi / ücretsiz kullanıcı / Pro kullanıcı / ajans üyesi — PRD §3>

---

## Bağlı route, dosya yolları, bileşenler

| Katman | Yol |
|---|---|
| Route | `/<locale>/<route>` |
| Sayfa | `app/[locale]/(app)/<route>/page.tsx` |
| Bileşenler | `components/modules/<modül>/<dosya>.tsx` |
| Şemalar | `lib/schemas/<dosya>.ts` |
| Veri portları | `lib/data/ports.ts` |

**Bileşen ağacı:**

```
<Sayfa>
├── <Bileşen A>          components/modules/<modül>/<a>.tsx:<satır>
└── <Bileşen B>          components/modules/<modül>/<b>.tsx:<satır>
```

<Navigasyon kaydı: `lib/nav.ts:<satır>` — bubble, faz, labelKey.>

---

## API çağrıları ve veri şeması

> **Faz 0-1'de gerçek HTTP çağrısı YOKTUR.** Tüm veri erişimi `lib/data/ports.ts`
> interface'leri üzerinden gider; implementasyon `lib/data/mock/` altındadır
> (in-memory + localStorage). Faz 2'de aynı imzalar `lib/data/supabase/` ile
> değiştirilecek (PRD §12, CLAUDE.md §7 — imza değişikliği ADR gerektirir).

| Port çağrısı | Nerede | Ne yapar |
|---|---|---|
| `backend.<repo>.<method>()` | `<dosya>:<satır>` | <açıklama> |

**Zod şemaları:**

| Şema | Dosya | Not |
|---|---|---|
| `<schema>` | `lib/schemas/<dosya>.ts:<satır>` | <alanlar / enum sayısı> |

---

## State yönetimi

| Durum | Mekanizma | Kaynak |
|---|---|---|
| <ad> | <useSyncExternalStore / useState / AppProvider context / RuleEngine singleton> | `<dosya>:<satır>` |

**Kalıcılık:** <localStorage anahtarı ve nedeni; yoksa "yok">

---

## Erişim kontrolü (RLS / role)

> **Faz 0-1'de kimlik doğrulama (auth) YOKTUR.** Giriş kapısı, oturum, kullanıcı
> ayrımı ve RLS politikaları **Faz 2** kapsamındadır (PRD §7, §12.3). Şu an tüm
> veri tarayıcıya ait tek bir localStorage kaydındadır; sunucu tarafı yetkilendirme
> yapılmaz.

| Kontrol | Faz 0-1 durumu | Faz 2 hedefi |
|---|---|---|
| Kimlik doğrulama | Yok | <e-posta + Google OAuth — PRD §8> |
| RLS | Yok (Postgres yok) | <`profile_id` bazlı politika — PRD §7> |
| Rol/limit gating | <mock / yok> | <sunucu tarafı doğrulama> |

---

## Test senaryoları

> Yalnız **gerçekten var olan** testler listelenir. Yeni test eklendiğinde bu tablo
> güncellenir.

**E2E — `e2e/app.spec.ts`:**

| Test | Doğrulanan |
|---|---|
| `"<test adı birebir>"` | <ne doğruluyor> |

**Birim — `tests/engine.test.ts`:**

| Test | Doğrulanan |
|---|---|
| `"<test adı birebir>"` | <ne doğruluyor> |

**Kapsanmayan:** <test edilmeyen alanlar dürüstçe.>

---

## Bilinen sınırlamalar

1. **<Başlık>** — <açıklama; hangi faza ait olduğu.>

---

## Değişiklik geçmişi

| Tarih | Sürüm | Değişiklik | Faz |
|---|---|---|---|
| <YYYY-AA-GG> | <x.y.z> | <değişiklik> | <Faz n> |
