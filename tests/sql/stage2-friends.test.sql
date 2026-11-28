-- Έλεγχοι του sql/2026-11-28-stage2-friends.sql (φίλοι B + C, ζωντανή θέση μόνο ενεργή, search_path). Κάθε αποτυχία σταματά με error.
\set ON_ERROR_STOP 1
create or replace function pg_temp.ok(c boolean, msg text) returns void language plpgsql as $$ begin if not coalesce(c,false) then raise exception 'FAIL: %', msg; end if; raise notice 'ok   %', msg; end $$;
create or replace function pg_temp.as_user(u text) returns void language plpgsql as $$ begin perform set_config('test.uid', u, false); end $$;

-- P: ψαράς · Q: φίλος του P (μοιράζονται και οι δύο) · R: άγνωστος · S: γράφει κωδικό του P
\set P '''00000000-0000-0000-0000-0000000005a1'''
\set Q '''00000000-0000-0000-0000-0000000005b2'''
\set R '''00000000-0000-0000-0000-0000000005c3'''
\set S '''00000000-0000-0000-0000-0000000005d4'''
reset role;
insert into auth.users values (:P), (:Q), (:R), (:S) on conflict do nothing;
insert into public.friends (owner, viewer, share) values (:P, :Q, true), (:Q, :P, true);
insert into storage.objects (bucket_id, name) values ('photos', '00000000-0000-0000-0000-0000000005a1/sb1.jpg');

set role authenticated; select pg_temp.as_user(:P);
insert into public.records (kind, id, data) values
  ('bites', 'sb1', '{"species":"Συναγρίδα","cnt":2,"kg":3.4,"len":61,"date":"2026-11-20","time":"07:15","lat":34.71234,"lon":32.40111,"place":"Ξέρα Πωμού","notes":"μυστικό","photo":"sb1.jpg","scoreH":[[1,70]],"tk":["x"],"_u":1}'),
  ('bites', 'sb2', '{"species":"Ροφός","date":"2026-11-19","priv":true,"_u":1}'),
  ('bites', 'sb3', '{"species":"Χαμένο","date":"2026-11-18","miss":true,"_u":1}'),
  ('bites', 'sb4', '{"species":"Σβησμένο","date":"2026-11-17","_u":1}'),
  ('trips', 'st1', '{"startMs":1,"endMs":2,"track":[[34.7,32.4]],"notes":"x","_u":1}'),
  ('spots', 'ss1', '{"name":"Σημείο","lat":34.7,"lon":32.4,"_u":1}');
update public.records set deleted = true, data = '{"species":"Σβησμένο","_u":2}' where id = 'sb4';
select pg_temp.ok((select count(*) = 6 from public.records where user_id = :P), 'owner still sees all of their own records');

-- ---------- B: ο φίλος δεν διαβάζει πια απευθείας ----------
select pg_temp.as_user(:Q);
select pg_temp.ok((select count(*) = 0 from public.records where user_id = :P), 'friend can no longer read the owner''s records directly');
select pg_temp.ok((select count(*) = 0 from storage.objects where name like '00000000-0000-0000-0000-0000000005a1/%'), 'friend can no longer read the owner''s photos');

-- ---------- B: friend_view = μόνο τα επιτρεπτά πεδία ----------
create temp table fv as select public.friend_view(:P)::jsonb as j;
select pg_temp.ok((select jsonb_array_length(j->'bites') = 1 from fv), 'friend sees only the shareable catch (not private, lost or deleted)');
select pg_temp.ok((select (j->'bites'->0) = '{"species":"Συναγρίδα","cnt":2,"kg":3.4,"len":61,"date":"2026-11-20","time":"07:15"}'::jsonb from fv), 'friend gets exactly species, count, kg, length, date and time');
select pg_temp.ok((select j::text !~ '(lat|lon|place|notes|photo|scoreH|track|"tk")' from fv), 'no location, place name, notes, photo, scores, track or gear in what the friend gets');
select pg_temp.ok((select (j->>'trips')::int = 1 and (j->>'spots')::int = 1 from fv), 'trips and spots only as counts');

-- άγνωστος και κλειστή κοινή χρήση: τίποτα
select pg_temp.as_user(:R);
select pg_temp.ok((select public.friend_view(:P)::jsonb = '{"bites":[],"trips":0,"spots":0}'::jsonb), 'a stranger gets nothing');
reset role; update public.friends set share = false where owner = :P and viewer = :Q;   -- (στο stub δεν υπάρχει η πολιτική fr_upd της παραγωγής)
set role authenticated; select pg_temp.as_user(:Q);
select pg_temp.ok((select public.friend_view(:P)::jsonb = '{"bites":[],"trips":0,"spots":0}'::jsonb), 'with sharing turned off the friend gets nothing');
reset role; update public.friends set share = true where owner = :P and viewer = :Q;
do $$ begin set local role anon; perform public.friend_view('00000000-0000-0000-0000-0000000005a1'); raise exception 'FAIL: anon can call friend_view'; exception when insufficient_privilege then raise notice 'ok   anon cannot call friend_view'; end $$;

-- ---------- C: ο κωδικός ανοίγει την κοινή χρήση μόνο από τη μεριά αυτού που τον έστειλε ----------
insert into public.friend_invites (code, owner, name) values ('STG2AB', :P, 'Ψαράς');
set role authenticated; select pg_temp.as_user(:S);
select public.redeem_friend('stg2-ab', 'Νέος');
reset role;
select pg_temp.ok((select share from public.friends where owner = :P and viewer = :S), 'C: the one who sent the code shares with the one who used it');
select pg_temp.ok((select not share from public.friends where owner = :S and viewer = :P), 'C: the one who used the code does not share until they choose to');
select pg_temp.ok((select count(*) = 0 from public.friend_invites where code = 'STG2AB'), 'the code is used once');
select pg_temp.ok((select share from public.friends where owner = :P and viewer = :Q) and (select share from public.friends where owner = :Q and viewer = :P), 'existing friendships are not changed');

-- ---------- ζωντανή θέση μόνο όσο η έξοδος είναι ενεργή ----------
insert into public.trip_live (user_id, name, lat, lon, active) values (:P, 'Ψαράς', 34.7, 32.4, true);
set role authenticated; select pg_temp.as_user(:Q);
select pg_temp.ok((select count(*) = 1 from public.trip_live where user_id = :P), 'friend sees the live position while the trip is active');
reset role; update public.trip_live set active = false where user_id = :P;
set role authenticated; select pg_temp.as_user(:Q);
select pg_temp.ok((select count(*) = 0 from public.trip_live where user_id = :P), 'friend no longer sees the last position after the trip ends');
select pg_temp.as_user(:P);
select pg_temp.ok((select count(*) = 1 from public.trip_live where user_id = :P), 'the owner still sees their own row');
reset role;

-- ---------- search_path ----------
select pg_temp.ok((select bool_and(exists (select 1 from unnest(p.proconfig) c where c = 'search_path=public')) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in ('alkyon_jnum', 'alkyon_km', 'alkyon_sync_version', 'records_touch', 'sos_alerts_guard')), 'fixed search_path on the functions that had none');
select pg_temp.ok((select prosecdef and exists (select 1 from unnest(proconfig) c where c = 'search_path=public') from pg_proc where proname = 'friend_view'), 'friend_view is security definer with a fixed search_path');
