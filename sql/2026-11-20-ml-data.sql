-- Alkyon 1.14.93 · ML Data Foundation: ημερομηνία δημιουργίας εγγραφής (ώρα του server).
-- ΔΕΝ έχει εφαρμοστεί. Εφαρμόζεται μόνο με ρητή έγκριση.
-- Γιατί: οι πίνακες είχαν μόνο updated_at, άρα δεν αποδεικνυόταν ΠΟΤΕ γράφτηκε μια εγγραφή σε σχέση με το πότε συνέβη αυτό που περιγράφει.
-- Συμβατότητα: οι παλιές εκδόσεις της εφαρμογής δεν στέλνουν ούτε διαβάζουν τη στήλη. Οι υπάρχουσες γραμμές μένουν NULL = «πριν από τη στήλη, άγνωστο».
-- Η προσθήκη στήλης με προεπιλογή δεν ξαναγράφει τον πίνακα· οι πίνακες έχουν λίγες εκατοντάδες γραμμές.

alter table public.records   add column if not exists created_at timestamptz;
alter table public.catch_obs add column if not exists created_at timestamptz;

-- Η ώρα μπαίνει από τον server στην ΕΙΣΑΓΩΓΗ και δεν αλλάζει ποτέ μετά, ό,τι κι αν στείλει ο πελάτης.
-- Σε upsert (ON CONFLICT … DO UPDATE) τρέχει το σκέλος UPDATE, άρα κρατιέται η αρχική τιμή.
create or replace function public.alk_created_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
  else
    new.created_at := old.created_at;
  end if;
  return new;
end $$;

drop trigger if exists records_created_at on public.records;
create trigger records_created_at before insert or update on public.records
  for each row execute function public.alk_created_at();

drop trigger if exists catch_obs_created_at on public.catch_obs;
create trigger catch_obs_created_at before insert or update on public.catch_obs
  for each row execute function public.alk_created_at();

-- Αναίρεση: sql/2026-11-20-ml-data-rollback.sql
