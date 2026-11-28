-- Alkyon 1.14.93 · αναίρεση του sql/2026-11-20-ml-data.sql.
-- Χάνονται: οι ημερομηνίες δημιουργίας που γράφτηκαν στο μεταξύ και ΟΛΑ τα στιγμιότυπα του trip_snaps. Τίποτε άλλο δεν αλλάζει.
drop trigger if exists records_trip_snap_cleanup on public.records;
drop function if exists public.alk_trip_snap_cleanup();
drop table if exists public.trip_snaps;
drop trigger if exists records_created_at on public.records;
drop trigger if exists catch_obs_created_at on public.catch_obs;
drop function if exists public.alk_created_at();
alter table public.records   drop column if exists created_at;
alter table public.catch_obs drop column if exists created_at;
