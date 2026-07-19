-- ───────────────────────────────────────────────────────────────────────────
-- 0007 — TikFinity (.tfc) içe aktarma: denetim kaydı + toplu geri alma (ADR-0007)
--
-- Kurulum: Supabase Dashboard → SQL Editor → yapıştır → Run. (Idempotent.)
-- ÖNCE 0001 ve 0006 çalıştırılmış olmalıdır.
--
-- NEDEN BU TASARIM:
--   0006 zaten eylem/etkinlik/zamanlayıcı/ekran/ayar tablolarını KULLANICI
--   bazında kuruyor. .tfc içe aktarması için ikinci bir profil boyutu açmak
--   yerine (iki ayrı "profil" kavramı kullanıcıyı şaşırtırdı — `stream_profiles`
--   bu projede OYUN profili demek) mevcut tablolara ADDITIVE bir `import_id`
--   etiketi eklenir:
--
--     • İçe aktarılan kayıtlar mevcut verinin YANINA eklenir (hiçbir şey ezilmez;
--       eylem id'leri uygulama tarafında yeniden üretilir).
--     • Her kayıt hangi içe aktarmadan geldiğini bilir → tek çağrıyla topluca
--       GERİ ALINABİLİR (`undo_tfc_import`).
--     • Tekil (kullanıcı başına tek satır) olan ayar/ekran/widget tabloları
--       üzerine yazılır; ÖNCEKİ hâlleri `settings_imports.previous_state`
--       içinde saklandığı için geri alma onları da eski hâline döndürür.
--
-- GÜVENLİK: 0006 ile aynı duruş — RLS açık, `auth.uid() = user_id`.
-- ───────────────────────────────────────────────────────────────────────────

create extension if not exists pgcrypto;


-- ═══════════════════════════════════════════════════════════════════════════
-- 1) İÇE AKTARMA DENETİM KAYDI
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.settings_imports (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        not null references auth.users(id) on delete cascade,
  label          text        not null default '',   -- kullanıcının verdiği ad
  file_name      text        not null default '',
  file_size      integer     not null default 0,
  -- lib/tfc/container.ts çıktısı: json | gzip | deflate | deflate-raw | zip | base64
  container      text        not null default 'json',
  source_version text,                              -- dosyadaki TikFinity sürümü
  checksum       text,                              -- sha256 — aynı dosya iki kez mi?
  -- Sayaçlar + warnings/skipped listeleri (lib/tfc/types.ts ImportPlan raporu)
  summary        jsonb       not null default '{}'::jsonb,
  -- Üzerine yazılan tekil tabloların içe aktarma ÖNCESİ hâli (geri alma için):
  --   { "appSettings": {...}, "overlayScreens": [...], "widgetSettings": {...} }
  previous_state jsonb       not null default '{}'::jsonb,
  status         text        not null default 'ok'
                   check (status in ('ok', 'partial', 'failed', 'reverted')),
  created_at     timestamptz not null default now(),
  reverted_at    timestamptz
);

comment on table public.settings_imports is
  'TikFinity .tfc içe aktarma geçmişi. import_id ile etiketlenen kayıtlar topluca geri alınabilir.';

create index if not exists settings_imports_user_idx
  on public.settings_imports (user_id, created_at desc);

alter table public.settings_imports enable row level security;

drop policy if exists "settings_imports_select_own" on public.settings_imports;
create policy "settings_imports_select_own" on public.settings_imports
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "settings_imports_insert_own" on public.settings_imports;
create policy "settings_imports_insert_own" on public.settings_imports
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "settings_imports_update_own" on public.settings_imports;
create policy "settings_imports_update_own" on public.settings_imports
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "settings_imports_delete_own" on public.settings_imports;
create policy "settings_imports_delete_own" on public.settings_imports
  for delete to authenticated using ((select auth.uid()) = user_id);


-- ═══════════════════════════════════════════════════════════════════════════
-- 2) MEVCUT TABLOLARA `import_id` ETİKETİ (additive — 0006'yı bozmaz)
--
-- `on delete set null`: denetim kaydı silinse bile veri KALIR, sadece etiketi
-- düşer. Veri kaybı riski yoktur.
-- `external_id`: kaynak dosyadaki orijinal TikFinity id — yeniden dışa
-- aktarmada geri yazılır, böylece TikFinity tarafında kayıtlar eşleşir.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.actions
  add column if not exists import_id  uuid references public.settings_imports(id) on delete set null,
  add column if not exists external_id text;

alter table public.stream_events
  add column if not exists import_id  uuid references public.settings_imports(id) on delete set null,
  add column if not exists external_id text;

alter table public.stream_timers
  add column if not exists import_id  uuid references public.settings_imports(id) on delete set null,
  add column if not exists external_id text;

-- Geri alma sorgusu (user_id + import_id) bu indeksleri kullanır.
create index if not exists actions_user_import_idx
  on public.actions (user_id, import_id) where import_id is not null;
create index if not exists stream_events_user_import_idx
  on public.stream_events (user_id, import_id) where import_id is not null;
create index if not exists stream_timers_user_import_idx
  on public.stream_timers (user_id, import_id) where import_id is not null;


-- ═══════════════════════════════════════════════════════════════════════════
-- 3) WIDGET AYARLARI — 0006'da yok, .tfc içe aktarması bunu da taşıyor
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.widget_settings (
  user_id    uuid        not null references auth.users(id) on delete cascade,
  widget_id  text        not null,                      -- widgetIdSchema
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


-- ═══════════════════════════════════════════════════════════════════════════
-- 4) ATOMİK İÇE AKTARMA
--
-- Tek transaction: eylemler yazılıp etkinlikler patlarsa TAMAMI geri alınır —
-- yarım içe aktarma oluşamaz.
--
-- SECURITY INVOKER: RLS çağıranın kimliğiyle uygulanır (yetki aşımı yok).
--
-- `payload` = lib/tfc/types.ts `ImportPlan` (camelCase JSON). Eylem id'leri
-- UYGULAMA TARAFINDA yeniden üretilmiştir (act_xxx) ve etkinlik referansları
-- zaten o id'lere işaret eder; burada ek eşleme gerekmez.
--   { label, settings, actions[], events[], timers[], screens[], widgetSettings{} }
-- `meta` = { fileName, fileSize, container, sourceVersion, checksum, summary }
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.import_tfc(payload jsonb, meta jsonb default '{}'::jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_import_id uuid;
  v_previous  jsonb;
begin
  if v_uid is null then
    raise exception 'auth required' using errcode = '42501';
  end if;

  -- Üzerine yazılacak TEKİL tabloların mevcut hâlini yedekle (geri alma için).
  select jsonb_build_object(
    'appSettings',
      (select to_jsonb(a) from public.app_settings a where a.user_id = v_uid),
    'overlayScreens',
      coalesce((select jsonb_agg(to_jsonb(s))
                  from public.overlay_screens s where s.user_id = v_uid), '[]'::jsonb),
    'widgetSettings',
      coalesce((select jsonb_object_agg(w.widget_id, w.settings)
                  from public.widget_settings w where w.user_id = v_uid), '{}'::jsonb)
  )
  into v_previous;

  insert into public.settings_imports (
    user_id, label, file_name, file_size, container,
    source_version, checksum, summary, previous_state
  ) values (
    v_uid,
    coalesce(nullif(payload ->> 'label', ''), 'TikFinity'),
    coalesce(meta ->> 'fileName', ''),
    coalesce((meta ->> 'fileSize')::integer, 0),
    coalesce(meta ->> 'container', 'json'),
    meta ->> 'sourceVersion',
    meta ->> 'checksum',
    coalesce(meta -> 'summary', '{}'::jsonb),
    v_previous
  )
  returning id into v_import_id;

  -- ── Eylemler ──
  insert into public.actions (
    user_id, id, import_id, external_id, name, enabled, types, config,
    duration_sec, points_delta, screen, volume, global_cooldown_sec,
    user_cooldown_sec, fade_in_ms, fade_out_ms, repeat_with_combos,
    skip_on_next_action, description
  )
  select
    v_uid,
    a ->> 'id',
    v_import_id,
    a ->> 'externalId',
    a ->> 'name',
    coalesce((a ->> 'enabled')::boolean, true),
    coalesce(array(select jsonb_array_elements_text(a -> 'types')), '{}'),
    coalesce(a -> 'config', '{}'::jsonb),
    coalesce((a ->> 'durationSec')::numeric, 5),
    coalesce((a ->> 'pointsDelta')::integer, 0),
    coalesce((a ->> 'screen')::smallint, 1),
    coalesce((a ->> 'volume')::smallint, 50),
    coalesce((a ->> 'globalCooldownSec')::integer, 0),
    coalesce((a ->> 'userCooldownSec')::integer, 0),
    coalesce((a ->> 'fadeInMs')::integer, 200),
    coalesce((a ->> 'fadeOutMs')::integer, 200),
    coalesce((a ->> 'repeatWithCombos')::boolean, false),
    coalesce((a ->> 'skipOnNextAction')::boolean, false),
    coalesce(a ->> 'description', '')
  from jsonb_array_elements(coalesce(payload -> 'actions', '[]'::jsonb)) a
  -- id çakışması teorik (uygulama yeni id üretir) ama PK ihlali tüm içe
  -- aktarmayı düşürmesin: çakışan kayıt sessizce atlanır.
  on conflict (user_id, id) do nothing;

  -- ── Etkinlikler ──
  insert into public.stream_events (
    user_id, id, import_id, external_id, active, trigger, who,
    conditions, actions_all, actions_random
  )
  select
    v_uid,
    e ->> 'id',
    v_import_id,
    e ->> 'externalId',
    coalesce((e ->> 'active')::boolean, true),
    e ->> 'trigger',
    coalesce(e ->> 'who', 'any'),
    coalesce(e -> 'conditions', '{}'::jsonb),
    coalesce(array(select jsonb_array_elements_text(e -> 'actionsAll')), '{}'),
    coalesce(array(select jsonb_array_elements_text(e -> 'actionsRandom')), '{}')
  from jsonb_array_elements(coalesce(payload -> 'events', '[]'::jsonb)) e
  on conflict (user_id, id) do nothing;

  -- ── Zamanlayıcılar ──
  insert into public.stream_timers (
    user_id, id, import_id, external_id, active, interval_minutes, action_id
  )
  select
    v_uid,
    t ->> 'id',
    v_import_id,
    t ->> 'externalId',
    coalesce((t ->> 'active')::boolean, true),
    (t ->> 'intervalMinutes')::integer,
    t ->> 'actionId'
  from jsonb_array_elements(coalesce(payload -> 'timers', '[]'::jsonb)) t
  on conflict (user_id, id) do nothing;

  -- ── Kurulum ayarları (tekil — üzerine yazılır, öncesi yedeklendi) ──
  if payload ? 'settings' then
    insert into public.app_settings (
      user_id, tiktok, points, subscriber_bonus, levels,
      obs, streamerbot, minecraft, advanced, debug, updated_at
    ) values (
      v_uid,
      coalesce(payload -> 'settings' -> 'tiktok', '{}'::jsonb),
      coalesce(payload -> 'settings' -> 'points', '{}'::jsonb),
      coalesce(payload -> 'settings' -> 'subscriberBonus', '{}'::jsonb),
      coalesce(payload -> 'settings' -> 'levels', '{}'::jsonb),
      coalesce(payload -> 'settings' -> 'obs', '{}'::jsonb),
      coalesce(payload -> 'settings' -> 'streamerbot', '{}'::jsonb),
      coalesce(payload -> 'settings' -> 'minecraft', '{}'::jsonb),
      coalesce(payload -> 'settings' -> 'advanced', '{}'::jsonb),
      coalesce(payload -> 'settings' -> 'debug', '{}'::jsonb),
      now()
    )
    on conflict (user_id) do update set
      tiktok           = excluded.tiktok,
      points           = excluded.points,
      subscriber_bonus = excluded.subscriber_bonus,
      levels           = excluded.levels,
      obs              = excluded.obs,
      streamerbot      = excluded.streamerbot,
      minecraft        = excluded.minecraft,
      advanced         = excluded.advanced,
      debug            = excluded.debug,
      updated_at       = now();
  end if;

  -- ── Overlay ekranları (tekil) ──
  insert into public.overlay_screens (user_id, screen, name, max_queue_length, updated_at)
  select
    v_uid,
    (s ->> 'screen')::smallint,
    coalesce(s ->> 'name', ''),
    coalesce((s ->> 'maxQueueLength')::integer, 10),
    now()
  from jsonb_array_elements(coalesce(payload -> 'screens', '[]'::jsonb)) s
  on conflict (user_id, screen) do update set
    name             = excluded.name,
    max_queue_length = excluded.max_queue_length,
    updated_at       = now();

  -- ── Widget ayarları (tekil) — { "goal": {...}, "wheel": {...} } ──
  insert into public.widget_settings (user_id, widget_id, settings, updated_at)
  select v_uid, w.key, w.value, now()
    from jsonb_each(coalesce(payload -> 'widgetSettings', '{}'::jsonb)) w
  on conflict (user_id, widget_id) do update set
    settings   = excluded.settings,
    updated_at = now();

  return v_import_id;
end;
$$;

revoke all on function public.import_tfc(jsonb, jsonb) from public;
grant execute on function public.import_tfc(jsonb, jsonb) to authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- 5) TOPLU GERİ ALMA
--
-- Etiketli kayıtları siler ve üzerine yazılan tekil tabloları içe aktarma
-- öncesi hâline döndürür. İçe aktarmadan SONRA elle eklenen kayıtlar
-- (import_id = null) etkilenmez.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.undo_tfc_import(p_import_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_previous jsonb;
begin
  if v_uid is null then
    raise exception 'auth required' using errcode = '42501';
  end if;

  select previous_state into v_previous
    from public.settings_imports
   where id = p_import_id and user_id = v_uid and status <> 'reverted';

  -- Kayıt yok / başkasına ait / zaten geri alınmış → sessizce çık (idempotent).
  if v_previous is null then
    return;
  end if;

  -- Sıra önemli: zamanlayıcı → etkinlik → eylem (referans yönünün tersi).
  delete from public.stream_timers where user_id = v_uid and import_id = p_import_id;
  delete from public.stream_events where user_id = v_uid and import_id = p_import_id;
  delete from public.actions       where user_id = v_uid and import_id = p_import_id;

  -- Kurulum ayarlarını eski hâline döndür (öncesi yoksa satırı tamamen sil).
  if v_previous -> 'appSettings' is null or v_previous -> 'appSettings' = 'null'::jsonb then
    delete from public.app_settings where user_id = v_uid;
  else
    update public.app_settings set
      tiktok           = coalesce(v_previous -> 'appSettings' -> 'tiktok', '{}'::jsonb),
      points           = coalesce(v_previous -> 'appSettings' -> 'points', '{}'::jsonb),
      subscriber_bonus = coalesce(v_previous -> 'appSettings' -> 'subscriber_bonus', '{}'::jsonb),
      levels           = coalesce(v_previous -> 'appSettings' -> 'levels', '{}'::jsonb),
      obs              = coalesce(v_previous -> 'appSettings' -> 'obs', '{}'::jsonb),
      streamerbot      = coalesce(v_previous -> 'appSettings' -> 'streamerbot', '{}'::jsonb),
      minecraft        = coalesce(v_previous -> 'appSettings' -> 'minecraft', '{}'::jsonb),
      advanced         = coalesce(v_previous -> 'appSettings' -> 'advanced', '{}'::jsonb),
      debug            = coalesce(v_previous -> 'appSettings' -> 'debug', '{}'::jsonb),
      updated_at       = now()
    where user_id = v_uid;
  end if;

  -- Ekranlar: önceki satırları geri yaz (içe aktarmada olmayan ekran kalmasın).
  delete from public.overlay_screens where user_id = v_uid;
  insert into public.overlay_screens (user_id, screen, name, max_queue_length, updated_at)
  select
    v_uid,
    (s ->> 'screen')::smallint,
    coalesce(s ->> 'name', ''),
    coalesce((s ->> 'max_queue_length')::integer, 10),
    now()
  from jsonb_array_elements(coalesce(v_previous -> 'overlayScreens', '[]'::jsonb)) s;

  -- Widget ayarları: aynı mantık.
  delete from public.widget_settings where user_id = v_uid;
  insert into public.widget_settings (user_id, widget_id, settings, updated_at)
  select v_uid, w.key, w.value, now()
    from jsonb_each(coalesce(v_previous -> 'widgetSettings', '{}'::jsonb)) w;

  update public.settings_imports
     set status = 'reverted', reverted_at = now()
   where id = p_import_id and user_id = v_uid;
end;
$$;

revoke all on function public.undo_tfc_import(uuid) from public;
grant execute on function public.undo_tfc_import(uuid) to authenticated;
