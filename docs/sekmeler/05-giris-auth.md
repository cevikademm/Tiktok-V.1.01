# 05 — Giriş / Kimlik Doğrulama (`login`)

- **PRD referansı:** §7 (Kimlik & Oturum), §8 (Auth sağlayıcıları), §12.3 (RLS)
- **Faz:** Faz 2 — **uygulandı** (e-posta onaylı kayıt + Google OAuth, cookie tabanlı SSR oturum)
- **Modül `pageId`:** `login` (navigasyon bubble'ı değil; `(auth)` route grubunda, SPA kabuğu dışında)

---

## Sekmenin amacı ve hedef kullanıcı

Kullanıcının panele erişmeden önce kimliğini doğruladığı **giriş kapısıdır**. İki yol
sunar: (1) e-posta + parola ile **onaylı** kayıt/giriş (Supabase e-posta doğrulama
bağlantısı), (2) **Google ile** tek tık OAuth. Sert kapı (hard gate) modeli: tüm panel
rotaları oturum ister; oturumsuz kullanıcı `/login`e yönlendirilir.

**Hedef kullanıcı:** Yeni ziyaretçi (hesap oluşturur) ve dönen kullanıcı (giriş yapar) —
PRD §3 "ücretsiz kullanıcı" ve üzeri.

---

## Bağlı route, dosya yolları, bileşenler

| Katman | Yol |
|---|---|
| Route (giriş) | `/<locale>/login` |
| Sayfa | `app/[locale]/(auth)/login/page.tsx` |
| Auth kabuğu | `app/[locale]/(auth)/layout.tsx` (chrome yok, ortalanmış kart) |
| Form bileşeni | `components/modules/auth/login-form.tsx` |
| Çıkış butonu | `components/modules/auth/sign-out-button.tsx` |
| OAuth/e-posta callback | `app/auth/callback/route.ts` (PKCE `?code=`) |
| E-posta OTP onayı | `app/auth/confirm/route.ts` (`?token_hash=&type=`) |
| Oturum yenileme | `middleware.ts` → `lib/supabase/middleware.ts` |
| Sunucu client | `lib/supabase/server.ts` |
| Tarayıcı client | `lib/supabase/client.ts` |
| Kullanıcı hook'u | `lib/supabase/use-user.ts` |
| Zod şeması | `lib/schemas/auth.ts` |
| DB migration | `supabase/migrations/0001_auth_profiles.sql` |

**Bileşen ağacı:**

```
(auth)/layout.tsx
└── login/page.tsx                app/[locale]/(auth)/login/page.tsx  (girişliyse → /start)
    └── LoginForm                 components/modules/auth/login-form.tsx
        ├── Google butonu (signInWithOAuth)
        ├── E-posta + Parola formu (RHF + Zod)
        └── "E-postanı kontrol et" durumu (onaylı kayıt sonrası)
```

Gate (sert kapı): `app/[locale]/(app)/layout.tsx` — `getUser()` yoksa `redirect('/login')`.
Topbar hesap menüsü: `components/layout/topbar.tsx` — kullanıcı e-postası + `SignOutButton`.

---

## API çağrıları ve veri şeması

Auth çağrıları Supabase Auth SDK üzerinden (HTTP → Supabase `/auth/v1`):

| Çağrı | Nerede | Ne yapar |
|---|---|---|
| `supabase.auth.signInWithPassword()` | `login-form.tsx` | E-posta + parola girişi |
| `supabase.auth.signUp({ options.emailRedirectTo })` | `login-form.tsx` | Onaylı kayıt (doğrulama e-postası) |
| `supabase.auth.signInWithOAuth({ provider: 'google' })` | `login-form.tsx` | Google OAuth başlatır |
| `supabase.auth.exchangeCodeForSession(code)` | `app/auth/callback/route.ts` | PKCE kodunu oturuma çevirir |
| `supabase.auth.verifyOtp({ token_hash, type })` | `app/auth/confirm/route.ts` | E-posta OTP onayı |
| `supabase.auth.getUser()` | middleware + `(app)` layout + `use-user` | Oturum doğrular / yeniler |
| `supabase.auth.signOut()` | `sign-out-button.tsx` | Oturumu kapatır |

**Zod şemaları:**

| Şema | Dosya | Not |
|---|---|---|
| `signInSchema` / `signUpSchema` | `lib/schemas/auth.ts` | `email` (email), `password` (6–72 char); hata mesajları i18n anahtarı |

**DB şeması (`public.profiles`):** `id` (uuid PK → `auth.users`), `email`, `full_name`,
`avatar_url`, `created_at`, `updated_at`. Yeni kullanıcı `on_auth_user_created` trigger'ı
ile otomatik oluşur (Google metadata'sından ad/avatar).

---

## State yönetimi

| Durum | Mekanizma | Kaynak |
|---|---|---|
| Oturum (server) | httpOnly çerezler (SSR) | `@supabase/ssr` — middleware yeniler |
| Form alanları | React Hook Form + Zod resolver | `login-form.tsx` |
| Mod (giriş/kayıt), pending, emailSent, hata | `useState` | `login-form.tsx` |
| İstemci kullanıcı | `useUser()` + `onAuthStateChange` | `lib/supabase/use-user.ts` |

**Kalıcılık:** Oturum, sunucunun da okuyabildiği çerezlerde tutulur (`createBrowserClient`);
`localStorage` kullanılmaz. Realtime overlay client'ı (`lib/supabase/browser.ts`) bilinçli
olarak ayrı ve oturumsuzdur (ADR-0003).

---

## Erişim kontrolü (RLS / role)

| Kontrol | Durum |
|---|---|
| Kimlik doğrulama | **E-posta (onaylı) + Google OAuth** — Supabase Auth |
| Gate | Sert kapı: `(app)` layout sunucuda `getUser()` yoksa `/login`e yönlendirir |
| Oturum güvenliği | httpOnly çerez, token yenilemesi yalnız middleware'de; anon key public, RLS aktif |
| Açık rotalar | `/widget/*` (OBS, oturumsuz), `/api/*`, `/auth/*` — middleware matcher hariç tutar |
| `profiles` RLS | Kullanıcı YALNIZ kendi satırını okur/günceller (`auth.uid() = id`) |
| Open-redirect | callback `next` yalnız site-içi göreli yola izin verir (`sanitizeNext`) |

**Not:** `overlay_configs` tablosu hâlâ service-role erişimlidir (ADR-0002/0003); auth'un
overlay hibrit mimarisine bağlanması ayrı bir iştir (bu sekme kapsamı dışı).

---

## Test senaryoları

**Runtime duman testi (bu teslimde el ile doğrulandı, `next start`):**

| Kontrol | Sonuç |
|---|---|
| `/start` (oturumsuz) | 307 → `/login` (gate çalışıyor) |
| `/login` | 200, Google butonu + e-posta/parola formu render |
| `/en/login` | 200, İngilizce metinler (i18n) |

**Otomatik:** `pnpm lint` (0 hata), `pnpm typecheck` (temiz), `pnpm test` (49/49),
`pnpm build` (başarılı), `pnpm i18n:check` (4 dil × 766 anahtar temiz).

**Kapsanmayan:** Login/kayıt/OAuth için otomatik E2E henüz yok (Playwright akışı gerçek
Supabase projesi + test kullanıcısı ister). Bir sonraki iş: `e2e/auth.spec.ts`.

---

## Bilinen sınırlamalar

1. **Dashboard konfigürasyonu manuel** — Google provider (Client ID/Secret), Redirect
   URL'leri ve e-posta onay ayarı Supabase Dashboard'da elle yapılır (bkz. README "Auth
   Kurulumu"). Bağlı proje (`pvaudeisyqaghwlxcwml`) MCP erişimimizde olmadığından kod
   tarafı hazır, panel adımları kullanıcıdadır.
2. **`profiles` migration'ı el ile çalıştırılır** — `supabase/migrations/0001_auth_profiles.sql`
   SQL Editor'de bir kez çalıştırılmalı.
3. **ToS / Gizlilik sayfaları yok** — yasal not metni var ama `/tos`, `/privacy` route'ları
   henüz yok (link değil, düz metin).
4. **Auth E2E testi yok** (yukarıda).

---

## Değişiklik geçmişi

| Tarih | Sürüm | Değişiklik | Faz |
|---|---|---|---|
| 2026-07-18 | 0.2.0 | E-posta onaylı + Google OAuth girişi, sert kapı, `profiles` + RLS, çıkış | Faz 2 |
