-- Alkyon 1.14.93 · ML Data Foundation: (α) ημερομηνία δημιουργίας εγγραφής (ώρα του server), (β) προσωπικός πίνακας trip_snaps.
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


-- ---------------------------------------------------------------------------------------------------------------------
-- trip_snaps: το παγωμένο στιγμιότυπο της πρόγνωσης μιας εξόδου (snapshot.js), σε ΔΙΚΟ ΤΟΥ πίνακα.
-- Γιατί όχι μέσα στην έξοδο (records): οι έξοδοι διαβάζονται και από φίλους (records_friends_read). Εδώ υπάρχει ΕΝΑ όριο πρόσβασης:
-- μόνο ο ιδιοκτήτης. Κανένας κανόνας για φίλους ή για ανώνυμους, και τίποτα δεν κληρονομείται από τον records.
-- Αμετάβλητο: επιτρέπεται εισαγωγή, ανάγνωση και διαγραφή· ΟΧΙ ενημέρωση (το στιγμιότυπο γράφεται μία φορά).
-- Ο συγχρονισμός της εφαρμογής δεν ξέρει τον πίνακα: η εφαρμογή μόνο ανεβάζει (μία κατεύθυνση).
create table if not exists public.trip_snaps (
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  trip_id    text not null check (char_length(trip_id) between 1 and 80),
  snap       jsonb not null check (jsonb_typeof(snap) = 'object' and pg_column_size(snap) <= 24000),
  created_at timestamptz not null default now(),
  primary key (user_id, trip_id)
);
alter table public.trip_snaps enable row level security;
revoke all on public.trip_snaps from anon, authenticated;
grant select, insert, delete on public.trip_snaps to authenticated;

drop policy if exists trip_snaps_own_read   on public.trip_snaps;
drop policy if exists trip_snaps_own_insert on public.trip_snaps;
drop policy if exists trip_snaps_own_delete on public.trip_snaps;
create policy trip_snaps_own_read   on public.trip_snaps for select to authenticated using (user_id = auth.uid());
create policy trip_snaps_own_insert on public.trip_snaps for insert to authenticated with check (user_id = auth.uid());
create policy trip_snaps_own_delete on public.trip_snaps for delete to authenticated using (user_id = auth.uid());

drop trigger if exists trip_snaps_created_at on public.trip_snaps;
create trigger trip_snaps_created_at before insert or update on public.trip_snaps
  for each row execute function public.alk_created_at();

-- Όταν σβηστεί μια έξοδος (σημάδι deleted ή πραγματική διαγραφή), σβήνεται και το στιγμιότυπό της.
-- Τρέχει με τα δικαιώματα αυτού που σβήνει την έξοδο: ο ιδιοκτήτης μπορεί να σβήσει μόνο τα δικά του στιγμιότυπα.
create or replace function public.alk_trip_snap_cleanup() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.kind = 'trips' then
      delete from public.trip_snaps where user_id = old.user_id and trip_id = old.id;
    end if;
    return old;
  end if;
  if new.kind = 'trips' and coalesce(new.deleted, false) and not coalesce(old.deleted, false) then
    delete from public.trip_snaps where user_id = new.user_id and trip_id = new.id;
  end if;
  return new;
end $$;

drop trigger if exists records_trip_snap_cleanup on public.records;
create trigger records_trip_snap_cleanup after update or delete on public.records
  for each row execute function public.alk_trip_snap_cleanup();

-- Αναίρεση: sql/2026-11-20-ml-data-rollback.sql
