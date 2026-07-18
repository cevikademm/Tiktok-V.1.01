-- ───────────────────────────────────────────────────────────────────────────
-- LiveKit — overlay_configs.timers kolonu (ADR-0005: Zamanlayıcı çalıştırıcı)
--
-- Kurulum: Supabase Dashboard → SQL Editor → bu dosyayı yapıştır → Run.
-- (Idempotent: tekrar çalıştırmak güvenlidir.)
--
-- Ne yapar:
--   Panel, kullanıcının zamanlayıcılarını (StreamTimer[]) /api/overlay/register
--   ile bu kolona yazar; connector worker aralıklı eylemleri buradan okuyup
--   yayın canlıyken her N dakikada bir tetikler (PRD §6.2 "Timer olayları").
--
-- Güvenlik: overlay_configs ile aynı duruş — RLS açık, politika YOK → yalnız
-- service_role (connector + register route) erişir.
-- ───────────────────────────────────────────────────────────────────────────

alter table public.overlay_configs
  add column if not exists timers jsonb not null default '[]'::jsonb;
