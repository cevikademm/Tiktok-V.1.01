-- ───────────────────────────────────────────────────────────────────────────
-- 0006 — Eylemler modülü kalıcılığı + Medya deposu (Storage)
--
-- NEDEN: "Eylemler" alanındaki her yükleme ve değişiklik kalıcı olmalı.
--   1) Medya (ses/görsel/video) şu ana kadar `URL.createObjectURL()` ile
--      `blob:` URL'e dönüşüyordu — bu URL YALNIZ onu üreten sekmede geçerli,
--      sekme kapanınca ölür ve widget/OBS ondan medyayı OKUYAMAZ (sesin
--      çalmamasının sebebi buydu). Artık dosyalar Storage'a yüklenip kalıcı
--      public URL saklanır.
--   2) Eylem/etkinlik/zamanlayıcı/ekran/ayar verisi tarayıcı localStorage'ında
--      kalıyordu; bu tablolar onları kullanıcı hesabına bağlar (cihaz değişse
--      de kaybolmaz).
--
-- GÜVENLİK: Tüm tablolar RLS açık + kullanıcı-kapsamlı (auth.uid() = user_id),
-- `profiles` (0001) ile aynı desen. service_role (connector) RLS'i baypas eder.
-- ───────────────────────────────────────────────────────────────────────────


-- ═══════════════════════════════════════════════════════════════════════════
-- 1) MEDYA DEPOSU (Supabase Storage) — ses/görsel/video dosyaları
-- ═══════════════════════════════════════════════════════════════════════════

-- Public bucket: widget/OBS kimlik doğrulamasız okuyabilmeli (URL sır değil,
-- ama yol kullanıcı UUID'si altında olduğu için tahmin edilemez).
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

-- Herkes OKUYABİLİR (widget/OBS için zorunlu).
drop policy if exists "media_public_read" on storage.objects;
create policy "media_public_read"
  on storage.objects for select
  using (bucket_id = 'media');

-- Giriş yapmış kullanıcı YALNIZ kendi klasörüne (<uid>/...) yazabilir.
drop policy if exists "media_insert_own" on storage.objects;
create policy "media_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "media_update_own" on storage.objects;
create policy "media_update_own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "media_delete_own" on storage.objects;
create policy "media_delete_own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );


-- Yüklenen dosyaların kataloğu (Sesler/Görseller kütüphanesi için).
create table if not exists public.media_assets (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users(id) on delete cascade,
  name          text        not null,                    -- orijinal dosya adı
  mime_type     text        not null default '',
  size_bytes    bigint      not null default 0,
  storage_path  text        not null,                    -- media bucket içindeki yol
  public_url    text        not null,                    -- widget'ın kullandığı URL
  created_at    timestamptz not null default now()
);

create index if not exists media_assets_user_idx on public.media_assets (user_id, created_at desc);

alter table public.media_assets enable row level security;

drop policy if exists "media_assets_select_own" on public.media_assets;
create policy "media_assets_select_own" on public.media_assets
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "media_assets_insert_own" on public.media_assets;
create policy "media_assets_insert_own" on public.media_assets
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "media_assets_update_own" on public.media_assets;
create policy "media_assets_update_own" on public.media_assets
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "media_assets_delete_own" on public.media_assets;
create policy "media_assets_delete_own" on public.media_assets
  for delete to authenticated using ((select auth.uid()) = user_id);


-- ═══════════════════════════════════════════════════════════════════════════
-- 2) EYLEMLER (actions) — lib/schemas/action.ts `actionSchema` ile birebir
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.actions (
  user_id              uuid        not null references auth.users(id) on delete cascade,
  id                   text        not null,             -- uygulama üretimi id
  name                 text        not null,
  enabled              boolean     not null default true,
  types                text[]      not null default '{}',-- actionTypeSchema değerleri
  config               jsonb       not null default '{}'::jsonb, -- actionConfigSchema
  duration_sec         numeric     not null default 5    check (duration_sec >= 0 and duration_sec <= 600),
  points_delta         integer     not null default 0,
  screen               smallint    not null default 1    check (screen between 1 and 8),
  volume               smallint    not null default 50   check (volume between 0 and 100),
  global_cooldown_sec  integer     not null default 0    check (global_cooldown_sec >= 0),
  user_cooldown_sec    integer     not null default 0    check (user_cooldown_sec >= 0),
  fade_in_ms           integer     not null default 200  check (fade_in_ms >= 0),
  fade_out_ms          integer     not null default 200  check (fade_out_ms >= 0),
  repeat_with_combos   boolean     not null default false,
  skip_on_next_action  boolean     not null default false,
  description          text        not null default '',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists actions_user_screen_idx on public.actions (user_id, screen);

alter table public.actions enable row level security;

drop policy if exists "actions_select_own" on public.actions;
create policy "actions_select_own" on public.actions
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "actions_insert_own" on public.actions;
create policy "actions_insert_own" on public.actions
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "actions_update_own" on public.actions;
create policy "actions_update_own" on public.actions
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "actions_delete_own" on public.actions;
create policy "actions_delete_own" on public.actions
  for delete to authenticated using ((select auth.uid()) = user_id);


-- ═══════════════════════════════════════════════════════════════════════════
-- 3) ETKİNLİKLER (stream_events) — `eventSchema` ile birebir
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.stream_events (
  user_id         uuid        not null references auth.users(id) on delete cascade,
  id              text        not null,
  active          boolean     not null default true,
  trigger         text        not null,                  -- triggerTypeSchema
  who             text        not null default 'any',    -- triggerWhoSchema
  conditions      jsonb       not null default '{}'::jsonb, -- eventConditionsSchema
  actions_all     text[]      not null default '{}',     -- action id'leri
  actions_random  text[]      not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists stream_events_user_trigger_idx on public.stream_events (user_id, trigger);

alter table public.stream_events enable row level security;

drop policy if exists "stream_events_select_own" on public.stream_events;
create policy "stream_events_select_own" on public.stream_events
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "stream_events_insert_own" on public.stream_events;
create policy "stream_events_insert_own" on public.stream_events
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "stream_events_update_own" on public.stream_events;
create policy "stream_events_update_own" on public.stream_events
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "stream_events_delete_own" on public.stream_events;
create policy "stream_events_delete_own" on public.stream_events
  for delete to authenticated using ((select auth.uid()) = user_id);


-- ═══════════════════════════════════════════════════════════════════════════
-- 4) ZAMANLAYICILAR (stream_timers) — `timerSchema` ile birebir (ADR-0005)
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.stream_timers (
  user_id          uuid        not null references auth.users(id) on delete cascade,
  id               text        not null,
  active           boolean     not null default true,
  interval_minutes integer     not null check (interval_minutes between 1 and 1440),
  action_id        text        not null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.stream_timers enable row level security;

drop policy if exists "stream_timers_select_own" on public.stream_timers;
create policy "stream_timers_select_own" on public.stream_timers
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "stream_timers_insert_own" on public.stream_timers;
create policy "stream_timers_insert_own" on public.stream_timers
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "stream_timers_update_own" on public.stream_timers;
create policy "stream_timers_update_own" on public.stream_timers
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "stream_timers_delete_own" on public.stream_timers;
create policy "stream_timers_delete_own" on public.stream_timers
  for delete to authenticated using ((select auth.uid()) = user_id);


-- ═══════════════════════════════════════════════════════════════════════════
-- 5) OVERLAY EKRANLARI (overlay_screens) — `overlayScreenSchema`
--    (`online` KAYDEDİLMEZ: canlı durum Realtime Presence'tan gelir — ADR-0003)
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.overlay_screens (
  user_id          uuid        not null references auth.users(id) on delete cascade,
  screen           smallint    not null check (screen between 1 and 8),
  name             text        not null default '',
  max_queue_length integer     not null default 10 check (max_queue_length between 1 and 100),
  updated_at       timestamptz not null default now(),
  primary key (user_id, screen)
);

alter table public.overlay_screens enable row level security;

drop policy if exists "overlay_screens_select_own" on public.overlay_screens;
create policy "overlay_screens_select_own" on public.overlay_screens
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "overlay_screens_insert_own" on public.overlay_screens;
create policy "overlay_screens_insert_own" on public.overlay_screens
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "overlay_screens_update_own" on public.overlay_screens;
create policy "overlay_screens_update_own" on public.overlay_screens
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "overlay_screens_delete_own" on public.overlay_screens;
create policy "overlay_screens_delete_own" on public.overlay_screens
  for delete to authenticated using ((select auth.uid()) = user_id);


-- ═══════════════════════════════════════════════════════════════════════════
-- 6) KURULUM AYARLARI (app_settings) — `setupSettingsSchema` bölümleri
--    Bölüm başına JSONB: şema Zod ile uygulamada doğrulanır (tek doğruluk kaynağı).
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.app_settings (
  user_id           uuid        primary key references auth.users(id) on delete cascade,
  tiktok            jsonb       not null default '{}'::jsonb,
  points            jsonb       not null default '{}'::jsonb,
  subscriber_bonus  jsonb       not null default '{}'::jsonb,
  levels            jsonb       not null default '{}'::jsonb,
  obs               jsonb       not null default '{}'::jsonb,
  streamerbot       jsonb       not null default '{}'::jsonb,
  minecraft         jsonb       not null default '{}'::jsonb,
  advanced          jsonb       not null default '{}'::jsonb,
  debug             jsonb       not null default '{}'::jsonb,
  updated_at        timestamptz not null default now()
);

alter table public.app_settings enable row level security;

drop policy if exists "app_settings_select_own" on public.app_settings;
create policy "app_settings_select_own" on public.app_settings
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "app_settings_insert_own" on public.app_settings;
create policy "app_settings_insert_own" on public.app_settings
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "app_settings_update_own" on public.app_settings;
create policy "app_settings_update_own" on public.app_settings
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "app_settings_delete_own" on public.app_settings;
create policy "app_settings_delete_own" on public.app_settings
  for delete to authenticated using ((select auth.uid()) = user_id);


-- ═══════════════════════════════════════════════════════════════════════════
-- 7) updated_at otomatik tazeleme (tüm tablolar)
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists actions_touch on public.actions;
create trigger actions_touch before update on public.actions
  for each row execute function public.touch_updated_at();

drop trigger if exists stream_events_touch on public.stream_events;
create trigger stream_events_touch before update on public.stream_events
  for each row execute function public.touch_updated_at();

drop trigger if exists stream_timers_touch on public.stream_timers;
create trigger stream_timers_touch before update on public.stream_timers
  for each row execute function public.touch_updated_at();

drop trigger if exists overlay_screens_touch on public.overlay_screens;
create trigger overlay_screens_touch before update on public.overlay_screens
  for each row execute function public.touch_updated_at();

drop trigger if exists app_settings_touch on public.app_settings;
create trigger app_settings_touch before update on public.app_settings
  for each row execute function public.touch_updated_at();
