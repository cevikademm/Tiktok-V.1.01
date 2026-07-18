-- ───────────────────────────────────────────────────────────────────────────
-- LiveKit — Overlay hibrit mimarisi Supabase şeması (ADR-0003)
--
-- Kurulum: Supabase Dashboard → SQL Editor → bu dosyayı yapıştır → Run.
--
-- İki parça:
--   1) overlay_configs tablosu — panel kullanıcının kurallarını + bağlı TikTok
--      username'ini + ekran ayarlarını buraya yazar (service-role, /api/overlay/register).
--      Connector worker bu tabloyu okuyup hangi yayını dinleyeceğini ve kuralları öğrenir.
--   2) Realtime Broadcast — connector, eşleşen action'ı `overlay-<id>-<screen>`
--      kanalına yayınlar; widget (tarayıcı, anon key) o kanalı dinleyip oynatır.
--      Broadcast için TABLO GEREKMEZ; sadece Realtime açık olması yeterli.
--
-- Güvenlik (Faz 1.5 duruşu — ADR-0002/0003): auth yok; overlay UUID'si
-- tahmin-edilemez token. RLS açık ve politika YOK → anon/authenticated bu
-- tabloya erişemez; yalnız service_role (connector + register route) erişir.
-- Faz 2'de Supabase Auth + RLS bunu kullanıcıya kilitler.
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.overlay_configs (
  id          uuid        primary key,
  username    text        not null default '',
  actions     jsonb       not null default '[]'::jsonb,
  events      jsonb       not null default '[]'::jsonb,
  timers      jsonb       not null default '[]'::jsonb,
  screens     jsonb       not null default '[]'::jsonb,
  updated_at  timestamptz not null default now()
);

-- Mevcut tabloya (ADR-0005 öncesi kurulmuşsa) timers kolonunu ekle — additive.
alter table public.overlay_configs
  add column if not exists timers jsonb not null default '[]'::jsonb;

-- RLS açık, politika yok → yalnız service_role erişir (connector + register route).
alter table public.overlay_configs enable row level security;

-- Not: Broadcast kanalları (overlay-<id>-<screen>) PUBLIC'tir; kanal adındaki
-- UUID sır görevi görür. Realtime projede zaten açıktır (Dashboard → Realtime).
-- Config tablosunu connector polling ile okuduğu için tabloyu realtime
-- publication'a eklemek ZORUNLU değildir (opsiyonel — anlık config yayılımı için):
--   alter publication supabase_realtime add table public.overlay_configs;


-- ───────────────────────────────────────────────────────────────────────────
-- error_reports — Hata Bildirimleri yedeği (ADR-0004)
--
-- "Hata Bildir" modülünün (components/error-report) ürettiği kayıtlar yereldeki
-- mock store'da (localStorage) tutulur; bu tablo bunların SÜREKLİ YEDEĞİdir.
-- Panel her kayıt eklendiğinde/durum değiştiğinde/silindiğinde /api/error-reports
-- (service-role) bu tabloyu upsert/delete eder. Alanlar lib/error-report/types.ts
-- `ErrorReport` ile birebir (camelCase → snake_case).
--
-- Güvenlik: overlay_configs ile aynı duruş — RLS açık, politika YOK → yalnız
-- service_role (yedek route'u) erişir; anon/authenticated erişemez. Ekran görüntüsü
-- base64 JPEG olarak screenshot_data (text) içinde gömülüdür (Storage Faz 2).
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.error_reports (
  id              text        primary key,
  reporter_name   text        not null default 'Admin',
  severity        text        not null default 'normal'
                    check (severity in ('low', 'normal', 'high')),
  status          text        not null default 'new'
                    check (status in ('new', 'in_progress', 'resolved')),
  description     text        not null default '',
  page_url        text,
  page_path       text,
  user_agent      text,
  screen_size     text,
  app_version     text,
  screenshot_data text,        -- base64 data URL (image/jpeg)
  created_at      timestamptz not null default now(),
  resolved_at     timestamptz,
  backed_up_at    timestamptz not null default now()
);

-- Panel sıralaması/filtreleri (en yeni önce, duruma göre).
create index if not exists error_reports_created_at_idx
  on public.error_reports (created_at desc);
create index if not exists error_reports_status_idx
  on public.error_reports (status);

-- RLS açık, politika yok → yalnız service_role erişir (yedek route'u).
alter table public.error_reports enable row level security;
