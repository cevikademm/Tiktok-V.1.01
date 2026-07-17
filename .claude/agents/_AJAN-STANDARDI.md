# Ajan Standardı (v3 — TikFinity Klonu) — Tüm Ajanların Uyacağı Şablon

> Bu dosya **ajan kalite sözleşmesidir**. Her ajan dosyası bu yapıya, bu bölüm başlıklarına ve bu model katmanlamasına uyar. Yeni ajan eklerken veya mevcut ajanı düzenlerken **önce bu dosyayı oku**.
> Sürüm: v3 · Sistem: **34 uzman ajan** + merkezi entegrasyon haritası · Proje: LiveKit (TikFinity klonu) — bkz. `PRD.md` + `CLAUDE.md`.

---

## 1. Frontmatter Formatı (ZORUNLU)

Claude Code subagent'ları frontmatter'ı şu formatla okur. **`tools` virgülle ayrılmış string'dir — köşeli parantez/dizi DEĞİL.** Dizi formatı (`[Read, Write]`) parse edilmez ve ajan yanlışlıkla **tüm araçlara** erişebilir (scope açığı).

```yaml
---
name: ajan-adi                # kebab-case, dosya adıyla aynı
description: >-
  Ne zaman kullanılacağı. Net tetikleyiciler + "PROAKTİF kullanılır" + 1-2 örnek
  senaryo. Claude ajanı bu metne göre seçer; bu yüzden somut ve ayırt edici olmalı.
model: opus                   # veya: sonnet  (katmanlama tablosuna bak)
color: blue                   # red|blue|green|yellow|purple|orange|pink|cyan
tools: Read, Write, Edit, Glob, Grep, Bash
---
```

**Araç seçimi ilkesi (en az yetki):**
- Salt-okunur denetçiler (kod-inceleyici, guvenlik-denetcisi, mimar analiz modu, urun-yoneticisi analiz modu): `Read, Glob, Grep, Bash` (Write/Edit yok). Denetçi düzeltme **önerir**, uygulamayı üretici ajan yapar.
- Web bilgisi gereken ajanlar (güvenlik, ai-ml, seo, reklam, api, ödeme, hukuk, tiktok-live): `+ WebFetch, WebSearch`.
- Uygulama yazan ajanlar: `Read, Write, Edit, Glob, Grep, Bash`.
- Orkestrator: `+ Task, TodoWrite`.

---

## 2. Model Katmanlama (ZORUNLU)

Maliyet-kalite dengesi için **katmanlı model**. `model: opus` → güncel Opus (4.8); `model: sonnet` → güncel Sonnet (4.6). Frontmatter'da alias kullan; düzyazıda somut sürümü yaz.

### 🔴 Opus 4.8 — Ağır muhakeme / yüksek risk (13 ajan)
Hata pahalı, akıl yürütme derin: mimari, güvenlik, hukuk, para, veri modeli, AI, koordinasyon, gerçek-zamanlı dağıtık sistem, resmi-olmayan protokol tersine mühendisliği.

| Ajan | Neden Opus |
|------|-----------|
| `orkestrator` | Çok ajanlı koordinasyon + hakemlik + faz kapıları |
| `mimar` | Sistem tasarımı, geri dönüşü zor kararlar |
| `guvenlik-denetcisi` | Tehdit modelleme, exploit muhakemesi |
| `hukuk-uyum-danismani` | KVKK/GDPR/AI Act yorumu, yasal risk (+ klon riski) |
| `veritabani-mimari` | Veri modeli — baştan yanlışsa yıllarca acı (puan ledger'ı!) |
| `odeme-entegratoru` | Para hatası = doğrudan zarar |
| `yapay-zeka-ml-muhendisi` | LLM mimarisi, guardrail, maliyet |
| `arka-yuz-gelistirici` | Karmaşık iş mantığı, tutarlılık, idempotency (kural motoru) |
| `supabase-uzmani` | RLS = güvenlik-kritik yetkilendirme |
| `sre-gozlemlenebilirlik` | Incident muhakemesi, SLO trade-off |
| `urun-yoneticisi` | Önceliklendirme, kapsam, başarı tanımı |
| `realtime-uzmani` | **YENİ** — WS kanal modeli, ekran kuyrukları, backpressure, olay sıralama/dedup; dağıtık gerçek-zaman hataları en pahalı hata sınıfıdır |
| `tiktok-live-uzmani` | **YENİ** — TikTok-Live-Connector sidecar, resmi-olmayan Webcast protokolü, olay şeması + hediye ekonomisi; kırılgan dış bağımlılık muhakemesi |

### 🟢 Sonnet 4.6 — Üretim / Doğrulama / İçerik (21 ajan)
İyi yapılandırılmış, üretim-yoğun veya ölçüm-temelli işler. Sonnet 4.6 bu işlerde hızlı ve güçlü.

`on-yuz-gelistirici`, `overlay-widget-uzmani` (**YENİ** — OBS widget/overlay render, `/widget/*`, 60fps animasyon bütçesi), `kod-inceleyici`, `test-muhendisi`, `performans-optimizasyoncusu`, `erisilebilirlik-denetcisi`, `devops-muhendisi`, `dokumantasyon-yazari`, `ux-tasarimcisi`, `yerellestirme-uzmani`, `seo-uzmani`, `analitik-uzmani`, `google-ads-uzmani`, `reklam-uzmani`, `e-posta-uzmani`, `mobil-gelistirici`, `api-entegratoru`, `3d-animasyon-uzmani`, `veri-muhendisi`, `growth-deney-uzmani`, `time-validator`

> **Eskalasyon kuralı:** Sonnet ajanı işin beklenenden çok daha karmaşık/riskli olduğunu görürse orkestrator'a "bu görev Opus muhakemesi istiyor" notu düşer; orkestrator gerekirse görevi ilgili Opus ajanına veya Opus alt-göreve yönlendirir. (Örn. `overlay-widget-uzmani` kanal protokolü değişikliği gerektiğinde `realtime-uzmani`'na eskalasyon yapar.)

---

## 3. Standart Bölüm Yapısı (ZORUNLU SIRA)

Her ajan dosyası tam olarak bu başlıkları, bu sırada içerir:

```markdown
---
<frontmatter>
---

# <Emoji + Başlık> — <Rol Tanımı>

<2-3 cümle: kimlik, misyon, değer.>

> **Model:** <Opus 4.8 | Sonnet 4.6> · **Katman:** <Ağır muhakeme | Üretim/Doğrulama> · **Rapor:** orkestrator

## 📌 Proje Bağlamı — TikFinity Klonu     (ZORUNLU — aşağıda §3.1)

## 🎯 Ne Zaman Devreye Girerim
- ✅ <bana ait senaryolar>
- ❌ <bana ait olmayan → doğru ajan>

## 🧠 Uzmanlık & Stack            (modern, güncel sürümler)

## 📥 Girdi Kontratı               (orkestratörden ne beklerim)
Görev gelirken şunları içermeli: hedef, kapsam sınırı, ilgili dosya yolları,
bağımlı ajan çıktıları, kabul kriteri. Eksikse iş başlamadan sorarım.

## 🛠️ Çalışma Kuralları / Yöntem

## <Alan-özel bölümler: kod şablonları, checklist'ler, tablolar — MODERN>

## ✅ Definition of Done
- [ ] <ölçülebilir bitti kriterleri; doğrulama dahil>

## 🔬 Öz-Doğrulama Rubriği         (teslimden önce kendime sorarım)
- [ ] <kanıt-temelli kontroller; "çalıştı varsaydım" değil "çalıştırdım/ölçtüm">

## 📤 Çıktı Formatı (Handoff Raporu)      (serbest rapor + ZORUNLU JSON — §3.2)

## 🔗 Skill & MCP Referansları

## 🤝 Büyük Proje Protokolü
### Orkestrator Koordinasyonu
### Doğrulama Zinciri
### Entegrasyon Erişimi

## 🚫 Yasaklar (Anti-pattern'ler)

<güçlü kapanış cümlesi>
```

### 3.1 Proje Bağlamı Bloğu (ZORUNLU)

Her ajan dosyası, 🎯 bölümünden hemen önce **`## 📌 Proje Bağlamı — TikFinity Klonu`** bölümü içerir. İçeriği:

1. **Proje özeti** (1 paragraf): `tikfinity.zerody.one` v1.70.1'in birebir klonu "LiveKit" — TikTok LIVE olaylarıyla tetiklenen uyarılar, TTS, overlay'ler, chatbot, puan ekonomisi, mini oyunlar.
2. **Sorumlu PRD bölümleri/modülleri** (somut liste): bu ajanın sahiplendiği PRD §'leri ve modül adları.
3. **Teknoloji yığını satırı:** Next.js 15 + React 19 + TS strict + Tailwind v4 + next-intl (TR/EN/DE/ES) + Zod + Supabase (Faz 2) + mock adapter `lib/data/ports.ts`.
4. **Faz disiplini notu:** "Aktif faz dışı modüle kod yazma" (faz planı PRD §2; geçiş onayı orkestrator'dan).
5. **Dosya haritası:** bu ajanın dokunduğu klasörler.

### 3.2 Yapısal JSON Handoff (ZORUNLU)

Her ajan, 📤 Çıktı Formatı'ndaki serbest markdown raporunun **sonuna** şu JSON bloğunu ekler; orkestrator bu blok eksikse çıktıyı **geri gönderir**:

```json
{
  "ajan": "<name>",
  "durum": "tamam|bloklu|kismi",
  "degisen_dosyalar": [],
  "testler": { "lint": "?", "typecheck": "?", "test": "?" },
  "riskler": [],
  "sonraki_ajan_onerisi": ""
}
```

Kurallar: `testler` alanları gerçek komut sonucudur (`gecti`/`kaldi`/`calistirilmadi` + gerekçe) — beyan değil kanıt; `durum: "bloklu"` ise `riskler` blokaj nedenini içerir; `sonraki_ajan_onerisi` doğrulama zincirindeki bir sonraki ajanı önerir (örn. üretici → `kod-inceleyici`).

---

## 4. Tüm Ajanlar İçin Ortak İlkeler

1. **Plan → Doğrula → Uygula → Test → Belgele.** Doğrulamasız "tamamdır" yok; kanıt (komut çıktısı, ölçüm, test) göster.
2. **Girdi kontratı eksikse başlama.** Belirsizliği orkestrator'a geri sor.
3. **Handoff zinciri:** Her çıktı `kod-inceleyici` + ilgili denetçiden (güvenlik / a11y / performans / hukuk) geçer ve §3.2 JSON bloğuyla teslim edilir.
4. **Atomik commit:** Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`).
5. **Sır yönetimi:** API anahtarı asla kodda; `.env.local` / Vercel env / Supabase Vault.
6. **Sekme = dosya kuralı:** Her route/page için `docs/sekmeler/<sıra>-<ad>.md`; alt panel'ler aynı dosyada `## Alt Bölüm:` altında.
7. **Çakışma:** İki ajan çelişirse orkestrator "ortak nokta" toplantısı düzenler; karar `docs/ADR/` altına yazılır.
8. **Erişilebilirlik & i18n & güvenlik & gizlilik** bir "faz 2" değil; baştan içeride.
9. **Proje sadakati:** PRD enum adları (`showText`, `gift_min`, `topgifter`…) birebir korunur; UI metni yalnız i18n'den gelir (hardcoded string yasak, 4 dile anahtar eklenir); tema hex'leri yalnız `globals.css` token'larından; faz disiplini (CLAUDE.md §7) çiğnenmez.
10. **Puan işlemleri:** tamsayı + append-only ledger; float ve yerinde güncelleme yasak.

## 5. Skill & MCP Kataloğu (ajanların atıfta bulunacağı)

**Claude Code Skill'leri:** `tdd` (RED-GREEN-REFACTOR), `code-review`, `security-review`, `verify` (gerçek çalıştırıp doğrulama), `simplify`, `deep-research`, `update-config`, `skill-creator`.

**MCP Sunucuları (oturuma bağlıysa):** Supabase MCP (`apply_migration`, `execute_sql`, `get_advisors`, `list_tables`, `deploy_edge_function`, `generate_typescript_types`), Vercel MCP (`deploy_to_vercel`, `get_deployment_build_logs`, `get_runtime_logs`), Netlify MCP, Figma MCP (`get_design_context`, `get_screenshot`, `get_variable_defs`), Canva MCP, Gmail / Google Calendar / Drive MCP, Stripe MCP, n8n MCP. Auth gerektiren çağrılar kullanıcı onayı olmadan yapılmaz (bkz. `entegrasyonlar.md`).

---

## 6. Yeni Ajan Ekleme Kontrol Listesi
1. `<ajan>.md` dosyasını bu standartla oluştur (doğru model katmanı + frontmatter + §3.1 Proje Bağlamı bloğu + §3.2 JSON handoff).
2. `orkestrator.md` Karar Matrisi'ne satır ekle (+ gerekiyorsa faz kapısı eşlemesi).
3. `entegrasyonlar.md` Ajan↔Connector matrisine ekle.
4. `BENI-OKU.md` ajan tablosunu güncelle.
5. Bu dosyadaki model katmanlama tablosuna ekle.
6. PRD §14 Ajan Eşleme Matrisi ile tutarlılığı doğrula.
