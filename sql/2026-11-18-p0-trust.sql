-- Alkyon 1.14.83 · P0 «Εμπιστοσύνη»: συγχρονισμός, ιδιωτικότητα, SOS, ρολόι, χρονοπρογραμματιστής.
-- Τρέχει μία φορά στο Supabase (SQL editor ή apply_migration). Είναι idempotent: μπορεί να ξανατρέξει χωρίς ζημιά.
-- Δεν σβήνει δεδομένα. Οι παλιές εκδόσεις της εφαρμογής συνεχίζουν να δουλεύουν (βλ. σχόλια ανά ενότητα).
-- Ελέγχεται με tests/sql/run.sh σε τοπικό Postgres με ψεύτικα σχήματα auth/storage (tests/sql/supabase-stub.sql).

begin;

-- ============================================================================================
-- 1) records: το DDL στο repo (μέχρι τώρα υπήρχε μόνο στη βάση) + ρολόι server + απόρριψη παλιότερης έκδοσης
-- ============================================================================================
create table if not exists public.records (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null,
  id text not null,
  data jsonb not null default '{}'::jsonb,
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, kind, id)
);
alter table public.records enable row level security;
drop policy if exists "own rows" on public.records;
create policy "own rows" on public.records for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists records_friends_read on public.records;
create policy records_friends_read on public.records for select to authenticated using (
  kind = any (array['bites','spots','trips'])
  and not coalesce(deleted, false)
  and coalesce((data->>'priv')::boolean, false) = false
  and exists (select 1 from public.friends f where f.owner = records.user_id and f.viewer = auth.uid() and f.share)
);
-- σταδιακή λήψη: user_id + (updated_at, kind, id)
create index if not exists records_sync on public.records (user_id, updated_at, kind, id);
-- η εφαρμογή (1.14.83+) ρωτά αυτή την έκδοση πριν χρησιμοποιήσει σταδιακή λήψη· χωρίς αυτήν κάνει πλήρη λήψη όπως πριν
create or replace function public.alkyon_sync_version() returns int language sql stable as $$ select 2 $$;
revoke all on function public.alkyon_sync_version() from public;
grant execute on function public.alkyon_sync_version() to authenticated;

-- αριθμός από jsonb (ή null αν δεν είναι αριθμός)
create or replace function public.alkyon_jnum(v jsonb) returns numeric
language sql immutable as $$ select case when jsonb_typeof(v) = 'number' then v::text::numeric else null end $$;

-- (α) updated_at = ρολόι του server σε κάθε εγγραφή (ό,τι κι αν στείλει ο client).
-- (β) αν η νέα έκδοση έχει μικρότερο data._u από την αποθηκευμένη, η αλλαγή αγνοείται (επιστρέφει null):
--     ένα παλιό κινητό ή ένα παλιό αντίγραφο ασφαλείας δεν μπορεί να πατήσει νεότερα δεδομένα.
--     Οι παλιές εκδόσεις της εφαρμογής ανεβάζουν ήδη μόνο ό,τι έχει μεγαλύτερο _u, οπότε δεν επηρεάζονται.
create or replace function public.records_touch() returns trigger
language plpgsql as $$
declare nu numeric; ou numeric;
begin
  if tg_op = 'UPDATE' then
    nu := public.alkyon_jnum(new.data->'_u'); ou := public.alkyon_jnum(old.data->'_u');
    if nu is not null and ou is not null and nu < ou then
      return null;
    end if;
    new.user_id := old.user_id;   -- ποτέ μετακίνηση γραμμής σε άλλον χρήστη
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists records_touch on public.records;
create trigger records_touch before insert or update on public.records for each row execute function public.records_touch();

-- ============================================================================================
-- 2) Φωτογραφίες: οι φίλοι βλέπουν μόνο φωτογραφίες ψαριών που ΔΕΝ είναι ιδιωτικά (priv)
--    Όνομα αρχείου: photos/<uid>/<biteId>.jpg ή <biteId>~<n>.jpg
-- ============================================================================================
drop policy if exists photos_friends_read on storage.objects;
create policy photos_friends_read on storage.objects for select to authenticated using (
  bucket_id = 'photos'
  and exists (select 1 from public.friends f where f.owner::text = (storage.foldername(objects.name))[1] and f.viewer = auth.uid() and f.share)
  and exists (
    select 1 from public.records r
    where r.user_id::text = (storage.foldername(objects.name))[1]
      and r.kind = 'bites'
      and r.id = regexp_replace(storage.filename(objects.name), '(~[0-9]+)?\.jpg$', '')
      and not r.deleted
      and coalesce((r.data->>'priv')::boolean, false) = false
  )
);

-- ============================================================================================
-- 3) Αναφορές θάλασσας: ήδη έτσι στη βάση (επιβεβαιώθηκε 18/11/2026), γράφεται εδώ ώστε να υπάρχει στο repo.
--    Ο πίνακας: μόνο ο ίδιος. Οι άλλοι βλέπουν μόνο το view (χωρίς user_id, θέση στρογγυλεμένη 0,015° από τον trigger, μόνο 6 ώρες).
-- ============================================================================================
drop policy if exists "sea read" on public.sea_reports;
create policy "sea read" on public.sea_reports for select to authenticated using (user_id = auth.uid());
create or replace view public.sea_reports_pub with (security_invoker = false) as
  select id, lat, lon, state, wind, note, created_at, (user_id = auth.uid()) as mine
  from public.sea_reports
  where auth.uid() is not null and (created_at > now() - interval '6 hours' or user_id = auth.uid());
revoke all on public.sea_reports_pub from anon;
grant select on public.sea_reports_pub to authenticated;

-- ============================================================================================
-- 4) SOS: ποιος βλέπει ένα ενεργό SOS το αποφασίζει ο server.
--    Ο ίδιος · οι φίλοι του (όπου κι αν είναι, όπως ως τώρα) · όποιος έχει θέση στον server (ζωντανή έξοδος ή έξοδος με ασφάλεια
--    της τελευταίας ώρας) σε απόσταση έως 20 ναυτικά μίλια (37,04 km). Η θέση του αναγνώστη δεν έρχεται από τον client.
--    Οι παλιές εκδόσεις της εφαρμογής διαβάζουν τον ίδιο πίνακα, οπότε παίρνουν αυτόματα το ίδιο φίλτρο.
-- ============================================================================================
create or replace function public.alkyon_km(a double precision, b double precision, c double precision, d double precision) returns double precision
language sql immutable as $$
  select 12742 * asin(sqrt(power(sin(radians(c - a) / 2), 2) + cos(radians(a)) * cos(radians(c)) * power(sin(radians(d - b) / 2), 2)))
$$;
create or replace function public.sos_can_see(p_owner uuid, p_lat double precision, p_lon double precision) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    auth.uid() = p_owner
    or exists (select 1 from public.friends f where f.owner = p_owner and f.viewer = auth.uid() and f.share)
    or exists (select 1 from public.trip_live t where t.user_id = auth.uid() and t.active and t.at > now() - interval '60 minutes'
               and t.lat is not null and t.lon is not null and public.alkyon_km(t.lat, t.lon, p_lat, p_lon) <= 37.04)
    or exists (select 1 from public.safety_trips s where s.user_id = auth.uid() and s.status in ('active','alerted') and s.last_at > now() - interval '60 minutes'
               and s.last_lat is not null and s.last_lon is not null and public.alkyon_km(s.last_lat, s.last_lon, p_lat, p_lon) <= 37.04)
  )
$$;
revoke all on function public.sos_can_see(uuid, double precision, double precision) from public, anon;
grant execute on function public.sos_can_see(uuid, double precision, double precision) to authenticated;
drop policy if exists sos_read_active on public.sos_alerts;
create policy sos_read_active on public.sos_alerts for select to authenticated using (
  user_id = auth.uid()
  or (status = 'active' and at > now() - interval '6 hours' and public.sos_can_see(user_id, lat, lon))
);
-- notified / created_at: μόνο ο server. Ο client δεν μπορεί να μηδενίσει το notified για να ξαναστείλει push στο ίδιο SOS.
-- Νέο SOS = νέο id ΚΑΙ notified 0 (η εφαρμογή στέλνει notified μόνο όταν ξεκινά νέο SOS). Επιτρέπεται αν το προηγούμενο τελείωσε
-- («Είμαι καλά», πριν από 30″+) ή ξεκίνησε πριν από 10′+. Οι ενημερώσεις θέσης ενός ενεργού SOS δεν αγγίζουν το notified.
-- Έλεγχος 18/11 (hardening): αν κάποιος πατήσει «Είμαι καλά» κατά λάθος και ξαναπατήσει SOS αμέσως, το SOS ΠΡΕΠΕΙ να ξαναφύγει.
-- Γι' αυτό μετά από «Είμαι καλά» αρκεί το προηγούμενο SOS να είχε ξεκινήσει πριν από 15″+ (όριο κατάχρησης: έως 4 νέα SOS το λεπτό).
create or replace function public.sos_alerts_guard() returns trigger
language plpgsql as $$
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;   -- service_role (Edge Function) ελεύθερα
  if tg_op = 'INSERT' then
    new.notified := 0; new.created_at := now(); new.at := now(); return new;
  end if;
  new.user_id := old.user_id; new.at := now();
  if new.id is distinct from old.id and new.notified = 0
     and ((old.status = 'ok' and (old.at < now() - interval '30 seconds' or old.created_at < now() - interval '15 seconds'))
          or old.created_at < now() - interval '10 minutes') then
    new.notified := 0; new.created_at := now();
  else
    new.id := old.id; new.notified := old.notified; new.created_at := old.created_at;
  end if;
  return new;
end $$;
drop trigger if exists sos_alerts_guard on public.sos_alerts;
create trigger sos_alerts_guard before insert or update on public.sos_alerts for each row execute function public.sos_alerts_guard();

-- ============================================================================================
-- 5) Κωδικοί ρολογιού: λήξη (180 μέρες χωρίς χρήση, ανανεώνεται σε κάθε χρήση), ανάκληση, όριο αποτυχημένων προσπαθειών
-- ============================================================================================
alter table public.watch_links add column if not exists expires_at timestamptz;
alter table public.watch_links add column if not exists revoked_at timestamptz;
alter table public.watch_links add column if not exists last_used_at timestamptz;
alter table public.watch_links alter column expires_at set default now() + interval '180 days';
update public.watch_links set expires_at = now() + interval '180 days' where expires_at is null;   -- τα ρολόγια που ήδη δουλεύουν δεν κόβονται
create table if not exists public.watch_auth_fail (
  ip text not null,
  at timestamptz not null default now()
);
create index if not exists watch_auth_fail_ip_at on public.watch_auth_fail (ip, at);
alter table public.watch_auth_fail enable row level security;   -- χωρίς πολιτικές: μόνο η Edge Function (service_role)
revoke all on public.watch_auth_fail from anon, authenticated;

-- ============================================================================================
-- 6) Χρονοπρογραμματιστής ασφάλειας: πότε έτρεξε τελευταία φορά με επιτυχία κάθε βήμα (όχι «ακριβές λεπτό»)
-- ============================================================================================
create table if not exists public.job_state (
  name text primary key,
  last_ok timestamptz,
  last_try timestamptz,
  info jsonb not null default '{}'::jsonb
);
alter table public.job_state enable row level security;   -- χωρίς πολιτικές: μόνο service_role
revoke all on public.job_state from anon, authenticated;

-- ============================================================================================
-- 7) Παλμός εξόδου από το native GPS (κινητό με σβηστή οθόνη): κλειδί ανά έξοδο, χωρίς token χρήστη
-- ============================================================================================
alter table public.safety_trips add column if not exists hb_key text;
alter table public.safety_trips add column if not exists hb_src text;

-- καθάρισμα: παλιές αποτυχημένες προσπάθειες ρολογιού (μία φορά τη μέρα από το alkyon-cleanup ή εδώ)
delete from public.watch_auth_fail where at < now() - interval '1 day';

commit;
