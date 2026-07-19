-- ───────────────────────────────────────────────────────────────────────────
-- 0008 — TAM KALICILIK: "her şeyi yükleyebilmek" için kalan tüm tablolar
--
-- Kurulum: Supabase Dashboard → SQL Editor → yapıştır → Run. (Idempotent —
-- birden çok kez çalıştırılabilir.) ÖNCE 0001 ve 0006 çalıştırılmış olmalıdır.
-- 0007 (.tfc içe aktarma) bağımsızdır; sırası önemli değil.
--
-- NEDEN: 0006 yalnızca "Eylemler" modülünü (actions/events/timers/screens/
-- settings) ve medya deposunu kalıcı hâle getirdi. Uygulamanın GERİ KALAN tüm
-- kullanıcı verisi hâlâ tarayıcı localStorage'ında (`livekit.mock.v1`) duruyor:
-- puanlar, izleyiciler, yayın profilleri, widget ayarları, ses uyarıları,
-- chatbot komutları, şarkı istekleri, hedefler, kısayollar, arayüz tercihleri.
-- Tarayıcı verisi silinince ya da cihaz değişince HEPSİ kayboluyordu.
-- Bu migration o boşluğu kapatır: yüklenen/oluşturulan her şeyin bir tablosu var.
--
-- GÜVENLİK: 0001/0006 ile aynı duruş — her tabloda RLS açık ve kullanıcı
-- kapsamlı ((select auth.uid()) = user_id). service_role (connector, yedek
-- route'ları) RLS'i baypas eder.
--
-- İSİMLENDİRME: kolonlar snake_case; uygulama tarafındaki camelCase alanlar
-- lib/schemas/*.ts içindeki Zod şemalarıyla birebir eşleşir (yorumlarda belirtildi).
-- ───────────────────────────────────────────────────────────────────────────

create extension if not exists pgcrypto;

-- 0006'daki yardımcı — burada da gerekli (bağımsız kurulum için yeniden tanımlanır).
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- ═══════════════════════════════════════════════════════════════════════════
-- 1) MEDYA KATALOĞU GENİŞLETMESİ
--
-- Kütüphanenin (components/modules/media/media-library.tsx) tür filtresini
-- istemcide MIME tahminiyle değil, veritabanında yapabilmesi için `kind`
-- üretilmiş (generated) kolon olarak eklenir — böylece indekslenebilir.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.media_assets
  add column if not exists updated_at  timestamptz not null default now(),
  add column if not exists folder      text        not null default '',
  add column if not exists duration_ms integer,     -- ses/video süresi (bilinirse)
  add column if not exists width       integer,     -- görsel/video boyutu
  add column if not exists height      integer,
  add column if not exists checksum    text;        -- aynı dosya iki kez mi yüklendi

-- MIME boş gelirse (bazı tarayıcılar) uzantıdan türet — IMMUTABLE ifade zorunlu.
alter table public.media_assets
  add column if not exists kind text
  generated always as (
    case
      when mime_type like 'audio/%' then 'audio'
      when mime_type like 'image/%' then 'image'
      when mime_type like 'video/%' then 'video'
      when lower(name) ~ '\.(mp3|wav|ogg|m4a|aac|flac)$'      then 'audio'
      when lower(name) ~ '\.(png|jpe?g|gif|webp|svg|avif)$'    then 'image'
      when lower(name) ~ '\.(mp4|webm|mov|mkv)$'               then 'video'
      else 'other'
    end
  ) stored;

create index if not exists media_assets_kind_idx
  on public.media_assets (user_id, kind, created_at desc);

-- Aynı dosya aynı yola iki kez yazılmasın.
create unique index if not exists media_assets_path_uniq
  on public.media_assets (storage_path);

drop trigger if exists media_assets_touch on public.media_assets;
create trigger media_assets_touch before update on public.media_assets
  for each row execute function public.touch_updated_at();


-- ═══════════════════════════════════════════════════════════════════════════
-- 2) PUAN SİSTEMİ — izleyiciler + defter (lib/schemas/points.ts)
--
-- `point_transactions` EKLE-ONLY bir defterdir; `viewers.points` onun türevi
-- (hızlı okuma için önbellek). `source_event_id` benzersizdir → aynı canlı
-- yayın olayı iki kez işlenirse puan İKİ KEZ yazılmaz (idempotency).
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.viewers (
  user_id             uuid        not null references auth.users(id) on delete cascade,
  viewer_user_id      text        not null,              -- viewerSchema.userId (TikTok)
  unique_id           text        not null default '',   -- @kullanıcıadı
  nickname            text        not null default '',
  profile_picture_url text,
  points              integer     not null default 0,
  level               integer     not null default 0 check (level >= 0),
  first_activity_ts   bigint      not null default 0,
  last_activity_ts    bigint      not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  primary key (user_id, viewer_user_id)
);

comment on table public.viewers is
  'İzleyici puan/seviye durumu. point_transactions defterinin özetlenmiş hâli.';

-- Kullanıcı listesi: sıralama (liderlik tablosu) ve arama.
create index if not exists viewers_points_idx on public.viewers (user_id, points desc);
create index if not exists viewers_unique_id_idx on public.viewers (user_id, lower(unique_id));

alter table public.viewers enable row level security;

drop policy if exists "viewers_select_own" on public.viewers;
create policy "viewers_select_own" on public.viewers
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "viewers_insert_own" on public.viewers;
create policy "viewers_insert_own" on public.viewers
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "viewers_update_own" on public.viewers;
create policy "viewers_update_own" on public.viewers
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "viewers_delete_own" on public.viewers;
create policy "viewers_delete_own" on public.viewers
  for delete to authenticated using ((select auth.uid()) = user_id);

drop trigger if exists viewers_touch on public.viewers;
create trigger viewers_touch before update on public.viewers
  for each row execute function public.touch_updated_at();


create table if not exists public.point_transactions (
  id              text        not null,                  -- transactionSchema.id
  user_id         uuid        not null references auth.users(id) on delete cascade,
  streamer        text        not null default '',
  viewer_user_id  text        not null default '',
  unique_id       text        not null default '',
  amount          integer     not null,                  -- + kazanç / − harcama
  description     text        not null default '',
  count_to_level  boolean     not null default true,
  ts              bigint      not null default 0,
  -- Hangi canlı olaydan üretildi — aynı olay tekrar gelirse yeniden yazılmaz.
  source_event_id text,
  -- earnSourceSchema: coin | share | chatMinute | subscriberBonus | manual | action
  source          text        not null default 'manual',
  created_at      timestamptz not null default now(),
  primary key (user_id, id)
);

comment on table public.point_transactions is
  'Ekle-only puan defteri. source_event_id ile idempotent (çift puan yazımı imkânsız).';

create index if not exists point_transactions_ts_idx
  on public.point_transactions (user_id, ts desc);
create index if not exists point_transactions_viewer_idx
  on public.point_transactions (user_id, viewer_user_id, ts desc);
-- Idempotency: aynı olay id'si kullanıcı başına en fazla bir kez.
create unique index if not exists point_transactions_source_uniq
  on public.point_transactions (user_id, source_event_id)
  where source_event_id is not null;

alter table public.point_transactions enable row level security;

drop policy if exists "point_transactions_select_own" on public.point_transactions;
create policy "point_transactions_select_own" on public.point_transactions
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "point_transactions_insert_own" on public.point_transactions;
create policy "point_transactions_insert_own" on public.point_transactions
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "point_transactions_update_own" on public.point_transactions;
create policy "point_transactions_update_own" on public.point_transactions
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "point_transactions_delete_own" on public.point_transactions;
create policy "point_transactions_delete_own" on public.point_transactions
  for delete to authenticated using ((select auth.uid()) = user_id);


-- ═══════════════════════════════════════════════════════════════════════════
-- 3) YAYIN PROFİLLERİ (lib/schemas/stream-profile.ts)
--
-- `settings` ve `auto_switch` jsonb: Zod şemaları sık genişliyor (11 ve 3 alan)
-- ve tamamı birlikte okunup birlikte yazılıyor — kolon başına ayrıştırmak
-- migration yükü getirir, sorgu faydası getirmezdi.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.stream_profiles (
  id          text        not null,                       -- streamProfileSchema.id
  user_id     uuid        not null references auth.users(id) on delete cascade,
  name        text        not null default '',
  emoji       text        not null default '🌹',
  auto_switch jsonb       not null default '{}'::jsonb,    -- autoSwitchRuleSchema
  settings    jsonb       not null default '{}'::jsonb,    -- profileSettingsSchema
  sort_order  integer     not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists stream_profiles_order_idx
  on public.stream_profiles (user_id, sort_order);

alter table public.stream_profiles enable row level security;

drop policy if exists "stream_profiles_select_own" on public.stream_profiles;
create policy "stream_profiles_select_own" on public.stream_profiles
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "stream_profiles_insert_own" on public.stream_profiles;
create policy "stream_profiles_insert_own" on public.stream_profiles
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "stream_profiles_update_own" on public.stream_profiles;
create policy "stream_profiles_update_own" on public.stream_profiles
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "stream_profiles_delete_own" on public.stream_profiles;
create policy "stream_profiles_delete_own" on public.stream_profiles
  for delete to authenticated using ((select auth.uid()) = user_id);

drop trigger if exists stream_profiles_touch on public.stream_profiles;
create trigger stream_profiles_touch before update on public.stream_profiles
  for each row execute function public.touch_updated_at();

-- MAX_STREAM_PROFILES = 10 — sınır uygulamada da var, burada da zorlanır
-- (API/SQL üzerinden atlatılamasın).
create or replace function public.enforce_stream_profile_limit()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if (select count(*) from public.stream_profiles where user_id = new.user_id) >= 10 then
    raise exception 'PROFILE_LIMIT: en fazla 10 yayın profili oluşturulabilir';
  end if;
  return new;
end;
$$;

drop trigger if exists stream_profiles_limit on public.stream_profiles;
create trigger stream_profiles_limit before insert on public.stream_profiles
  for each row execute function public.enforce_stream_profile_limit();


-- Kullanıcı başına TEK satır: hangi profil aktif + otomatik geçiş durumu.
create table if not exists public.profile_state (
  user_id              uuid        primary key references auth.users(id) on delete cascade,
  active_profile_id    text,
  auto_switch          jsonb       not null default '{}'::jsonb,  -- autoSwitchStateSchema
  game_signal          jsonb       not null default '{}'::jsonb,  -- gameSignalSchema
  last_switch_at       bigint      not null default 0,
  updated_at           timestamptz not null default now()
);

alter table public.profile_state enable row level security;

drop policy if exists "profile_state_select_own" on public.profile_state;
create policy "profile_state_select_own" on public.profile_state
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "profile_state_insert_own" on public.profile_state;
create policy "profile_state_insert_own" on public.profile_state
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "profile_state_update_own" on public.profile_state;
create policy "profile_state_update_own" on public.profile_state
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "profile_state_delete_own" on public.profile_state;
create policy "profile_state_delete_own" on public.profile_state
  for delete to authenticated using ((select auth.uid()) = user_id);

drop trigger if exists profile_state_touch on public.profile_state;
create trigger profile_state_touch before update on public.profile_state
  for each row execute function public.touch_updated_at();


-- ═══════════════════════════════════════════════════════════════════════════
-- 4) WIDGET AYARLARI (lib/schemas/widget.ts widgetSettingsSchema)
--
-- 0007 ile AYNI tanım — hangi migration önce çalışırsa çalışsın sorun olmasın
-- diye ikisinde de `if not exists` ile duruyor.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.widget_settings (
  user_id    uuid        not null references auth.users(id) on delete cascade,
  widget_id  text        not null,                      -- widgetIdSchema (26 değer)
  settings   jsonb       not null default '{}'::jsonb,  -- widgetSettingsSchema
  updated_at timestamptz not null default now(),
  primary key (user_id, widget_id)
);

alter table public.widget_settings enable row level security;

drop policy if exists "widget_settings_select_own" on public.widget_settings;
create policy "widget_settings_select_own" on public.widget_settings
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "widget_settings_insert_own" on public.widget_settings;
create policy "widget_settings_insert_own" on public.widget_settings
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "widget_settings_update_own" on public.widget_settings;
create policy "widget_settings_update_own" on public.widget_settings
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "widget_settings_delete_own" on public.widget_settings;
create policy "widget_settings_delete_own" on public.widget_settings
  for delete to authenticated using ((select auth.uid()) = user_id);

drop trigger if exists widget_settings_touch on public.widget_settings;
create trigger widget_settings_touch before update on public.widget_settings
  for each row execute function public.touch_updated_at();


-- ═══════════════════════════════════════════════════════════════════════════
-- 5) SES UYARILARI (Sesler sayfasındaki tablo)
--
-- `actions` tablosundan AYRI: ses uyarısı tek amaçlı, hafif bir kayıt (tetikleyici
-- + dosya + ses seviyesi + klavye kısayolu) ve kendi sayfasından yönetiliyor.
-- Dosya `media_assets`'e bağlanır → dosya silinirse bağ null'lanır (uyarı kalır).
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.sound_alerts (
  id                 text        not null,
  user_id            uuid        not null references auth.users(id) on delete cascade,
  enabled            boolean     not null default true,
  name               text        not null default '',
  -- sounds.triggers.*: gift | follow | subscribe | share | join | like | command | keyboard
  trigger            text        not null default 'gift',
  conditions         jsonb       not null default '{}'::jsonb,  -- eventConditionsSchema
  media_asset_id     uuid        references public.media_assets(id) on delete set null,
  media_url          text        not null default '',
  media_name         text        not null default '',
  volume             integer     not null default 50 check (volume between 0 and 100),
  cooldown_sec       integer     not null default 0 check (cooldown_sec >= 0),
  keyboard_shortcut  text        not null default '',
  sort_order         integer     not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists sound_alerts_order_idx on public.sound_alerts (user_id, sort_order);

alter table public.sound_alerts enable row level security;

drop policy if exists "sound_alerts_select_own" on public.sound_alerts;
create policy "sound_alerts_select_own" on public.sound_alerts
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "sound_alerts_insert_own" on public.sound_alerts;
create policy "sound_alerts_insert_own" on public.sound_alerts
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "sound_alerts_update_own" on public.sound_alerts;
create policy "sound_alerts_update_own" on public.sound_alerts
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "sound_alerts_delete_own" on public.sound_alerts;
create policy "sound_alerts_delete_own" on public.sound_alerts
  for delete to authenticated using ((select auth.uid()) = user_id);

drop trigger if exists sound_alerts_touch on public.sound_alerts;
create trigger sound_alerts_touch before update on public.sound_alerts
  for each row execute function public.touch_updated_at();


-- ═══════════════════════════════════════════════════════════════════════════
-- 6) CHATBOT — ayarlar, komutlar, kısa metinler (snippet), mesaj günlüğü
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.chatbot_settings (
  user_id             uuid        primary key references auth.users(id) on delete cascade,
  enabled             boolean     not null default false,
  -- { enabled, maxRepeat, cooldown, blockLinks, blockCaps }
  spam_protection     jsonb       not null default '{}'::jsonb,
  streamerbot_messages boolean    not null default false,
  updated_at          timestamptz not null default now()
);

alter table public.chatbot_settings enable row level security;

drop policy if exists "chatbot_settings_select_own" on public.chatbot_settings;
create policy "chatbot_settings_select_own" on public.chatbot_settings
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "chatbot_settings_insert_own" on public.chatbot_settings;
create policy "chatbot_settings_insert_own" on public.chatbot_settings
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "chatbot_settings_update_own" on public.chatbot_settings;
create policy "chatbot_settings_update_own" on public.chatbot_settings
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "chatbot_settings_delete_own" on public.chatbot_settings;
create policy "chatbot_settings_delete_own" on public.chatbot_settings
  for delete to authenticated using ((select auth.uid()) = user_id);

drop trigger if exists chatbot_settings_touch on public.chatbot_settings;
create trigger chatbot_settings_touch before update on public.chatbot_settings
  for each row execute function public.touch_updated_at();


create table if not exists public.chatbot_commands (
  id            text        not null,
  user_id       uuid        not null references auth.users(id) on delete cascade,
  -- Yerleşik komut anahtarı (help, getPoints, leaderboard, game, play, skip,
  -- gamble, duel, givePoints, watchtime) — özel komutlarda boş.
  builtin_key   text        not null default '',
  command       text        not null default '',          -- "!puan" (eventConditions.command)
  enabled       boolean     not null default true,
  response      text        not null default '',          -- placeholder'lar desteklenir
  -- triggerWhoSchema: any | followers | subscribers | moderators | topgifter | specific_user
  who           text        not null default 'any',
  cooldown_sec  integer     not null default 0 check (cooldown_sec >= 0),
  cost_points   integer     not null default 0 check (cost_points >= 0),
  sort_order    integer     not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (user_id, id)
);

-- Aynı komut iki kez tanımlanmasın (boş olanlar hariç).
create unique index if not exists chatbot_commands_cmd_uniq
  on public.chatbot_commands (user_id, lower(command))
  where command <> '';

alter table public.chatbot_commands enable row level security;

drop policy if exists "chatbot_commands_select_own" on public.chatbot_commands;
create policy "chatbot_commands_select_own" on public.chatbot_commands
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "chatbot_commands_insert_own" on public.chatbot_commands;
create policy "chatbot_commands_insert_own" on public.chatbot_commands
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "chatbot_commands_update_own" on public.chatbot_commands;
create policy "chatbot_commands_update_own" on public.chatbot_commands
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "chatbot_commands_delete_own" on public.chatbot_commands;
create policy "chatbot_commands_delete_own" on public.chatbot_commands
  for delete to authenticated using ((select auth.uid()) = user_id);

drop trigger if exists chatbot_commands_touch on public.chatbot_commands;
create trigger chatbot_commands_touch before update on public.chatbot_commands
  for each row execute function public.touch_updated_at();


create table if not exists public.chatbot_snippets (
  id          text        not null,
  user_id     uuid        not null references auth.users(id) on delete cascade,
  name        text        not null default '',
  content     text        not null default '',
  enabled     boolean     not null default true,
  -- Otomatik gönderim aralığı (dk) — 0 ise yalnız elle gönderilir.
  interval_minutes integer not null default 0 check (interval_minutes >= 0),
  sort_order  integer     not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.chatbot_snippets enable row level security;

drop policy if exists "chatbot_snippets_select_own" on public.chatbot_snippets;
create policy "chatbot_snippets_select_own" on public.chatbot_snippets
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "chatbot_snippets_insert_own" on public.chatbot_snippets;
create policy "chatbot_snippets_insert_own" on public.chatbot_snippets
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "chatbot_snippets_update_own" on public.chatbot_snippets;
create policy "chatbot_snippets_update_own" on public.chatbot_snippets
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "chatbot_snippets_delete_own" on public.chatbot_snippets;
create policy "chatbot_snippets_delete_own" on public.chatbot_snippets
  for delete to authenticated using ((select auth.uid()) = user_id);

drop trigger if exists chatbot_snippets_touch on public.chatbot_snippets;
create trigger chatbot_snippets_touch before update on public.chatbot_snippets
  for each row execute function public.touch_updated_at();


-- Gönderilen/yakalanan mesaj günlüğü (chatbot sayfasındaki tablo).
create table if not exists public.chatbot_messages (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  ts          bigint      not null default 0,
  unique_id   text        not null default '',            -- mesajı yazan izleyici
  message     text        not null default '',
  matched_command text    not null default '',
  response    text        not null default '',
  -- sent | blocked_spam | no_match | cooldown
  outcome     text        not null default 'sent',
  created_at  timestamptz not null default now()
);

create index if not exists chatbot_messages_ts_idx
  on public.chatbot_messages (user_id, ts desc);

alter table public.chatbot_messages enable row level security;

drop policy if exists "chatbot_messages_select_own" on public.chatbot_messages;
create policy "chatbot_messages_select_own" on public.chatbot_messages
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "chatbot_messages_insert_own" on public.chatbot_messages;
create policy "chatbot_messages_insert_own" on public.chatbot_messages
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "chatbot_messages_delete_own" on public.chatbot_messages;
create policy "chatbot_messages_delete_own" on public.chatbot_messages
  for delete to authenticated using ((select auth.uid()) = user_id);


-- ═══════════════════════════════════════════════════════════════════════════
-- 7) ŞARKI İSTEKLERİ — ayarlar + kuyruk/geçmiş
--
-- Spotify yenileme jetonu SIR: bu tabloda RLS ile korunur ve yalnız sunucu
-- tarafı okur. (İstemciye asla `select *` ile gönderilmemeli — veri erişim
-- katmanı yalnız gerekli kolonları seçer.)
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.song_request_settings (
  user_id               uuid        primary key references auth.users(id) on delete cascade,
  spotify_connected     boolean     not null default false,
  spotify_refresh_token text,                                   -- gizli
  spotify_playlist_id   text,
  play_enabled          boolean     not null default true,
  skip_enabled          boolean     not null default true,
  allow_explicit        boolean     not null default true,
  only_from_playlist    boolean     not null default false,
  play_cost             integer     not null default 0 check (play_cost >= 0),
  skip_cost             integer     not null default 0 check (skip_cost >= 0),
  revoke_cost           integer     not null default 0 check (revoke_cost >= 0),
  max_queue_length      integer     not null default 10 check (max_queue_length >= 1),
  max_song_duration_sec integer     not null default 360 check (max_song_duration_sec >= 1),
  updated_at            timestamptz not null default now()
);

alter table public.song_request_settings enable row level security;

drop policy if exists "song_request_settings_select_own" on public.song_request_settings;
create policy "song_request_settings_select_own" on public.song_request_settings
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "song_request_settings_insert_own" on public.song_request_settings;
create policy "song_request_settings_insert_own" on public.song_request_settings
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "song_request_settings_update_own" on public.song_request_settings;
create policy "song_request_settings_update_own" on public.song_request_settings
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "song_request_settings_delete_own" on public.song_request_settings;
create policy "song_request_settings_delete_own" on public.song_request_settings
  for delete to authenticated using ((select auth.uid()) = user_id);

drop trigger if exists song_request_settings_touch on public.song_request_settings;
create trigger song_request_settings_touch before update on public.song_request_settings
  for each row execute function public.touch_updated_at();


create table if not exists public.song_requests (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users(id) on delete cascade,
  requested_by  text        not null default '',        -- izleyici @kullanıcıadı
  track_id      text        not null default '',        -- Spotify track id/URI
  track_name    text        not null default '',
  artist        text        not null default '',
  duration_ms   integer     not null default 0,
  cost_points   integer     not null default 0,
  status        text        not null default 'queued'
                  check (status in ('queued', 'playing', 'played', 'skipped', 'revoked')),
  ts            bigint      not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists song_requests_queue_idx
  on public.song_requests (user_id, status, ts);

alter table public.song_requests enable row level security;

drop policy if exists "song_requests_select_own" on public.song_requests;
create policy "song_requests_select_own" on public.song_requests
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "song_requests_insert_own" on public.song_requests;
create policy "song_requests_insert_own" on public.song_requests
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "song_requests_update_own" on public.song_requests;
create policy "song_requests_update_own" on public.song_requests
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "song_requests_delete_own" on public.song_requests;
create policy "song_requests_delete_own" on public.song_requests
  for delete to authenticated using ((select auth.uid()) = user_id);


-- ═══════════════════════════════════════════════════════════════════════════
-- 8) HEDEFLER (goals) — actionConfig.goalId buraya işaret eder
--    (controlCustomGoal eylemi: add | set | reset)
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.goals (
  id            text        not null,                    -- actionConfig.goalId
  user_id       uuid        not null references auth.users(id) on delete cascade,
  name          text        not null default '',
  -- custom | gift | coin | follower | like | share | subscriber
  kind          text        not null default 'custom',
  target_value  integer     not null default 100,
  current_value integer     not null default 0,
  unit          text        not null default '',
  -- never | daily | weekly | monthly | perStream
  reset_period  text        not null default 'never',
  last_reset_at timestamptz,
  screen        integer     not null default 1 check (screen between 1 and 8),
  enabled       boolean     not null default true,
  style         jsonb       not null default '{}'::jsonb, -- renk/font/çubuk görünümü
  sort_order    integer     not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists goals_order_idx on public.goals (user_id, sort_order);

alter table public.goals enable row level security;

drop policy if exists "goals_select_own" on public.goals;
create policy "goals_select_own" on public.goals
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "goals_insert_own" on public.goals;
create policy "goals_insert_own" on public.goals
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "goals_update_own" on public.goals;
create policy "goals_update_own" on public.goals
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "goals_delete_own" on public.goals;
create policy "goals_delete_own" on public.goals
  for delete to authenticated using ((select auth.uid()) = user_id);

drop trigger if exists goals_touch on public.goals;
create trigger goals_touch before update on public.goals
  for each row execute function public.touch_updated_at();


-- ═══════════════════════════════════════════════════════════════════════════
-- 9) KLAVYE KISAYOLLARI — bir tuş kombinasyonu bir eylemi tetikler
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.keyboard_shortcuts (
  id         text        not null,
  user_id    uuid        not null references auth.users(id) on delete cascade,
  combo      text        not null default '',            -- "Ctrl+Shift+1"
  action_id  text        not null default '',            -- actions.id
  enabled    boolean     not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- Aynı kombinasyon iki eyleme bağlanmasın.
create unique index if not exists keyboard_shortcuts_combo_uniq
  on public.keyboard_shortcuts (user_id, lower(combo))
  where combo <> '';

alter table public.keyboard_shortcuts enable row level security;

drop policy if exists "keyboard_shortcuts_select_own" on public.keyboard_shortcuts;
create policy "keyboard_shortcuts_select_own" on public.keyboard_shortcuts
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "keyboard_shortcuts_insert_own" on public.keyboard_shortcuts;
create policy "keyboard_shortcuts_insert_own" on public.keyboard_shortcuts
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "keyboard_shortcuts_update_own" on public.keyboard_shortcuts;
create policy "keyboard_shortcuts_update_own" on public.keyboard_shortcuts
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "keyboard_shortcuts_delete_own" on public.keyboard_shortcuts;
create policy "keyboard_shortcuts_delete_own" on public.keyboard_shortcuts
  for delete to authenticated using ((select auth.uid()) = user_id);

drop trigger if exists keyboard_shortcuts_touch on public.keyboard_shortcuts;
create trigger keyboard_shortcuts_touch before update on public.keyboard_shortcuts
  for each row execute function public.touch_updated_at();


-- ═══════════════════════════════════════════════════════════════════════════
-- 10) ARAYÜZ TERCİHLERİ — şu ana kadar YALNIZ localStorage'daydı
--     (ikon rayı sırası, menü durumu, hızlı erişim, debug, master toggle)
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.ui_preferences (
  user_id            uuid        primary key references auth.users(id) on delete cascade,
  rail_order         text[]      not null default '{}',          -- livekit.railOrder.v1
  sub_menu_collapsed boolean     not null default false,         -- livekit.subMenuCollapsed.v1
  debug_mode         boolean     not null default false,         -- livekit.debugMode.v1
  actions_enabled    boolean     not null default true,          -- livekit.actionsEnabled.v1
  -- { tts, sounds, actions } — components/modules/start/quick-access.tsx
  quick_access       jsonb       not null default '{}'::jsonb,
  pwa_dismissed_at   bigint      not null default 0,
  locale             text        not null default 'tr',
  updated_at         timestamptz not null default now()
);

alter table public.ui_preferences enable row level security;

drop policy if exists "ui_preferences_select_own" on public.ui_preferences;
create policy "ui_preferences_select_own" on public.ui_preferences
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "ui_preferences_insert_own" on public.ui_preferences;
create policy "ui_preferences_insert_own" on public.ui_preferences
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "ui_preferences_update_own" on public.ui_preferences;
create policy "ui_preferences_update_own" on public.ui_preferences
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "ui_preferences_delete_own" on public.ui_preferences;
create policy "ui_preferences_delete_own" on public.ui_preferences
  for delete to authenticated using ((select auth.uid()) = user_id);

drop trigger if exists ui_preferences_touch on public.ui_preferences;
create trigger ui_preferences_touch before update on public.ui_preferences
  for each row execute function public.touch_updated_at();


-- ═══════════════════════════════════════════════════════════════════════════
-- 11) HAK/PLAN DURUMU (EntitlementsService)
--
-- `is_pro` ve limitler İSTEMCİDEN YAZILAMAZ: select politikası var, ancak
-- insert/update/delete politikası YOK → yalnız service_role (ödeme webhook'u)
-- değiştirebilir. Kullanıcı kendi planını yükseltemez.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.user_entitlements (
  user_id     uuid        primary key references auth.users(id) on delete cascade,
  is_pro      boolean     not null default false,
  plan        text        not null default 'free',
  channel_id  text        not null default '',
  -- { actions, sounds, ttsDaily, giftCounter, streamProfiles, socialRotator, pointsUsers }
  limits      jsonb       not null default '{}'::jsonb,
  valid_until timestamptz,
  updated_at  timestamptz not null default now()
);

alter table public.user_entitlements enable row level security;

-- Yalnız OKUMA politikası — yazma service_role'a bırakıldı (bilinçli).
drop policy if exists "user_entitlements_select_own" on public.user_entitlements;
create policy "user_entitlements_select_own" on public.user_entitlements
  for select to authenticated using ((select auth.uid()) = user_id);

drop trigger if exists user_entitlements_touch on public.user_entitlements;
create trigger user_entitlements_touch before update on public.user_entitlements
  for each row execute function public.touch_updated_at();


-- ═══════════════════════════════════════════════════════════════════════════
-- 12) HATA BİLDİRİMLERİ — tabloyu garanti et + sahibi bağla
--
-- supabase/schema.sql'de tanımlı ama bu projede henüz oluşturulmamıştı.
-- `user_id` eklenir ki bildirim kimden geldiği bilinsin (null = anonim).
-- RLS açık, politika yok → yalnız service_role (/api/error-reports) erişir.
-- ═══════════════════════════════════════════════════════════════════════════

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
  screenshot_data text,
  created_at      timestamptz not null default now(),
  resolved_at     timestamptz,
  backed_up_at    timestamptz not null default now()
);

alter table public.error_reports
  add column if not exists user_id uuid references auth.users(id) on delete set null;

create index if not exists error_reports_created_at_idx on public.error_reports (created_at desc);
create index if not exists error_reports_status_idx     on public.error_reports (status);
create index if not exists error_reports_user_idx       on public.error_reports (user_id);

alter table public.error_reports enable row level security;


-- ═══════════════════════════════════════════════════════════════════════════
-- 13) DEĞİŞİKLİK GÜNLÜĞÜ — "her yükleme ve değişiklik kaydedilsin"
--
-- Uygulama koduna güvenmeyen bir kayıt: tetikleyici seviyesinde çalışır, yani
-- kayıt SQL Editor'dan bile değiştirilse günlüğe düşer. Yanlış silmeleri geri
-- almak için eski satır (`before`) da saklanır.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.change_log (
  id         bigserial   primary key,
  user_id    uuid,                                   -- FK yok: kullanıcı silinse de iz kalsın
  table_name text        not null,
  row_id     text        not null default '',
  op         text        not null check (op in ('insert', 'update', 'delete')),
  before     jsonb,
  after      jsonb,
  at         timestamptz not null default now()
);

create index if not exists change_log_user_idx on public.change_log (user_id, at desc);
create index if not exists change_log_table_idx on public.change_log (table_name, at desc);

alter table public.change_log enable row level security;

-- Kullanıcı yalnız kendi geçmişini OKUR; yazım tetikleyiciye ait.
drop policy if exists "change_log_select_own" on public.change_log;
create policy "change_log_select_own" on public.change_log
  for select to authenticated using ((select auth.uid()) = user_id);


create or replace function public.log_change()
returns trigger
language plpgsql
security definer          -- RLS'e takılmadan günlüğe yazabilmeli
set search_path = public
as $$
declare
  rec       jsonb;
  row_ident text;
  owner     uuid;
  operation text := lower(tg_op);   -- TG_OP BÜYÜK harftir ('INSERT') — bir kez normalize et
begin
  rec := to_jsonb(coalesce(new, old));
  -- Birincil anahtar tablodan tabloya değişir: `id`, (user_id, widget_id),
  -- (user_id, screen), (user_id, viewer_user_id). İlk bulunanı kimlik say.
  row_ident := coalesce(
    rec ->> 'id', rec ->> 'widget_id', rec ->> 'screen', rec ->> 'viewer_user_id', ''
  );
  owner := nullif(rec ->> 'user_id', '')::uuid;

  insert into public.change_log (user_id, table_name, row_id, op, before, after)
  values (
    owner,
    tg_table_name,
    row_ident,
    operation,
    case when operation in ('update', 'delete') then to_jsonb(old) end,
    case when operation in ('insert', 'update') then to_jsonb(new) end
  );

  return coalesce(new, old);
end;
$$;

-- Günlüğe alınacak tablolar. Yüksek hacimli olanlar (stream_events,
-- point_transactions, chatbot_messages, change_log'un kendisi) BİLEREK dışarıda:
-- onlar zaten ekle-only ve saniyede yüzlerce satır üretebilir.
do $$
declare
  t text;
begin
  foreach t in array array[
    'media_assets', 'actions', 'stream_timers', 'overlay_screens', 'app_settings',
    'sound_alerts', 'goals', 'keyboard_shortcuts', 'stream_profiles',
    'chatbot_commands', 'chatbot_snippets', 'song_request_settings', 'widget_settings'
  ]
  loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists %I on public.%I', t || '_changelog', t);
      execute format(
        'create trigger %I after insert or update or delete on public.%I
           for each row execute function public.log_change()',
        t || '_changelog', t
      );
    end if;
  end loop;
end
$$;


-- ═══════════════════════════════════════════════════════════════════════════
-- 14) YENİ KULLANICI TOHUMLAMA — hesap açılınca tekil satırlar hazır olsun
--
-- 0001'deki `handle_new_user` profiles satırını açıyordu; burada onunla aynı
-- anda kalan tekil (kullanıcı başına tek satır) tabloları da tohumluyoruz ki
-- uygulama "satır yok" durumunu hiç görmesin.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.seed_user_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.ui_preferences        (user_id) values (new.id) on conflict do nothing;
  insert into public.profile_state         (user_id) values (new.id) on conflict do nothing;
  insert into public.chatbot_settings      (user_id) values (new.id) on conflict do nothing;
  insert into public.song_request_settings (user_id) values (new.id) on conflict do nothing;
  insert into public.user_entitlements     (user_id) values (new.id) on conflict do nothing;

  -- 8 overlay ekranı ("Ekran 1..8") — widget URL'leri ilk günden çalışsın.
  insert into public.overlay_screens (user_id, screen, name)
  select new.id, s, 'Ekran ' || s from generate_series(1, 8) as s
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_seed on auth.users;
create trigger on_auth_user_created_seed
  after insert on auth.users
  for each row execute function public.seed_user_defaults();

-- MEVCUT kullanıcılar için de aynı tohumlamayı geriye dönük uygula.
insert into public.ui_preferences        (user_id) select id from auth.users on conflict do nothing;
insert into public.profile_state         (user_id) select id from auth.users on conflict do nothing;
insert into public.chatbot_settings      (user_id) select id from auth.users on conflict do nothing;
insert into public.song_request_settings (user_id) select id from auth.users on conflict do nothing;
insert into public.user_entitlements     (user_id) select id from auth.users on conflict do nothing;

insert into public.overlay_screens (user_id, screen, name)
select u.id, s, 'Ekran ' || s
from auth.users u cross join generate_series(1, 8) as s
on conflict do nothing;
