-- Alkyon 1.14.93 · αναίρεση του sql/2026-11-20-ml-data.sql. Χάνονται οι ημερομηνίες δημιουργίας που γράφτηκαν στο μεταξύ· τίποτε άλλο δεν αλλάζει.
drop trigger if exists records_created_at on public.records;
drop trigger if exists catch_obs_created_at on public.catch_obs;
drop function if exists public.alk_created_at();
alter table public.records   drop column if exists created_at;
alter table public.catch_obs drop column if exists created_at;
