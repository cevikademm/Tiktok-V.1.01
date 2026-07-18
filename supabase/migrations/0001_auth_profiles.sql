-- ───────────────────────────────────────────────────────────────────────────
-- LiveKit — Auth: public.profiles tablosu + RLS + yeni-kullanıcı trigger'ı
--
-- Kurulum: Supabase Dashboard → SQL Editor → bu dosyayı yapıştır → Run.
-- (Idempotent: tekrar çalıştırmak güvenlidir.)
--
-- Ne yapar:
--   1) auth.users'a 1-1 bağlı public.profiles tablosu (kullanıcı profil verisi).
--   2) RLS: her kullanıcı YALNIZ kendi profilini görür/günceller.
--   3) Trigger: yeni kullanıcı kaydında profil satırı otomatik oluşur
--      (e-posta + Google OAuth metadata'sından ad/avatar doldurulur).
--
-- Güvenlik notu: trigger SECURITY DEFINER'dır ve search_path='' ile sabitlenir
-- (şema-ele geçirme / search_path saldırılarına karşı — Supabase önerisi).
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.profiles (
  id          uuid        primary key references auth.users (id) on delete cascade,
  email       text,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is 'Kullanıcı profilleri — auth.users ile 1-1, RLS ile kendi satırına kilitli.';

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;

-- Kendi profilini oku
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

-- Kendi profilini güncelle
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Kendi profilini ekle (trigger dışı manuel senaryolar için; trigger zaten ekler)
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = id);

-- ── updated_at otomatik güncelleme ──────────────────────────────────────────
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

-- ── Yeni kullanıcı → profil satırı ──────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name'
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
