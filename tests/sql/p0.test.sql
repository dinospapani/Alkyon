-- Έλεγχοι του sql/2026-11-18-p0-trust.sql (τρέχουν μετά το supabase-stub.sql και το migration). Κάθε αποτυχία σταματά με error.
\set ON_ERROR_STOP 1
create or replace function pg_temp.ok(c boolean, msg text) returns void language plpgsql as $$ begin if not coalesce(c,false) then raise exception 'FAIL: %', msg; end if; raise notice 'ok   %', msg; end $$;
create or replace function pg_temp.as_user(u text) returns void language plpgsql as $$ begin perform set_config('test.uid', u, false); end $$;

-- χρήστες: A (ψαράς με SOS/ψάρια), B κοντά, C μακριά, D φίλος του A (μακριά), E χωρίς θέση
\set A '''00000000-0000-0000-0000-00000000000a'''
\set B '''00000000-0000-0000-0000-00000000000b'''
\set C '''00000000-0000-0000-0000-00000000000c'''
\set D '''00000000-0000-0000-0000-00000000000d'''
\set E '''00000000-0000-0000-0000-00000000000e'''
\set F '''00000000-0000-0000-0000-00000000000f'''
\set G '''00000000-0000-0000-0000-000000000010'''
insert into auth.users values (:A), (:B), (:C), (:D), (:E), (:F), (:G);
insert into public.friends (owner, viewer) values (:A, :D);

-- ---------- 1) records: ρολόι server και απόρριψη παλιότερης έκδοσης ----------
set role authenticated; select pg_temp.as_user(:A);
insert into public.records (kind, id, data, updated_at) values ('bites', 'b1', '{"species":"v2","_u":2000}', '2001-01-01');
select pg_temp.ok((select updated_at > now() - interval '1 minute' from public.records where id = 'b1'), 'updated_at comes from the server clock, not the client');
-- upsert με παλιότερο _u (όπως παλιό αντίγραφο): αγνοείται, δεν επιστρέφει γραμμή
with up as (insert into public.records (kind, id, data) values ('bites', 'b1', '{"species":"old","_u":1000}')
  on conflict (user_id, kind, id) do update set data = excluded.data, deleted = excluded.deleted returning id)
select pg_temp.ok((select count(*) = 0 from up), 'stale upsert returns no row');
select pg_temp.ok((select data->>'species' = 'v2' from public.records where id = 'b1'), 'stale version did not overwrite newer data');
-- διαγραφή με παλιότερο _u: αγνοείται
update public.records set deleted = true, data = '{"_u":1500}' where id = 'b1';
select pg_temp.ok((select not deleted from public.records where id = 'b1'), 'stale tombstone does not delete newer data');
-- νεότερη έκδοση: περνά
with up as (insert into public.records (kind, id, data) values ('bites', 'b1', '{"species":"v3","_u":3000}')
  on conflict (user_id, kind, id) do update set data = excluded.data returning id)
select pg_temp.ok((select count(*) = 1 from up), 'newer upsert is applied');
select pg_temp.ok((select data->>'species' = 'v3' from public.records where id = 'b1'), 'newer data stored');
-- ίδια έκδοση ξανά (επανάληψη αποστολής): περνά, idempotent
update public.records set data = '{"species":"v3","_u":3000}' where id = 'b1';
select pg_temp.ok((select data->>'species' = 'v3' from public.records where id = 'b1'), 'same version resend is accepted');
-- εγγραφή χωρίς _u (π.χ. ρυθμίσεις παλιάς μορφής): περνά
insert into public.records (kind, id, data) values ('settings', 'main', '{"x":1}') on conflict (user_id, kind, id) do update set data = excluded.data;
update public.records set data = '{"x":2}' where kind = 'settings';
select pg_temp.ok((select data->>'x' = '2' from public.records where kind = 'settings'), 'rows without numeric _u are not blocked');
-- ο A δεν μπορεί να γράψει γραμμή άλλου χρήστη
do $$ begin
  begin insert into public.records (user_id, kind, id, data) values ('00000000-0000-0000-0000-00000000000b', 'bites', 'x', '{}'); raise exception 'FAIL: wrote another user row';
  exception when insufficient_privilege then raise notice 'ok   cannot write rows of another user'; end;
end $$;
-- ιδιωτικό ψάρι και φωτογραφίες
insert into public.records (kind, id, data) values ('bites', 'pub1', '{"_u":1}'), ('bites', 'priv1', '{"_u":1,"priv":true}'), ('bites', 'gone1', '{"_u":1}');
update public.records set deleted = true, data = '{"_u":5}' where id = 'gone1';
reset role;
insert into storage.objects (bucket_id, name) values
  ('photos', '00000000-0000-0000-0000-00000000000a/pub1.jpg'),
  ('photos', '00000000-0000-0000-0000-00000000000a/pub1~1.jpg'),
  ('photos', '00000000-0000-0000-0000-00000000000a/priv1.jpg'),
  ('photos', '00000000-0000-0000-0000-00000000000a/priv1~2.jpg'),
  ('photos', '00000000-0000-0000-0000-00000000000a/gone1.jpg');

-- ---------- 2) φωτογραφίες ----------
set role authenticated; select pg_temp.as_user(:D);   -- φίλος του A
select pg_temp.ok((select count(*) = 2 from storage.objects where name like '%/pub1%'), 'friend sees photos of a public catch (main + extra)');
select pg_temp.ok((select count(*) = 0 from storage.objects where name like '%/priv1%'), 'friend does NOT see photos of a private catch');
select pg_temp.ok((select count(*) = 0 from storage.objects where name like '%/gone1%'), 'friend does NOT see photos of a deleted catch');
select pg_temp.ok((select count(*) = 0 from public.records where id = 'priv1'), 'friend does not see the private catch record');
select pg_temp.as_user(:B);   -- όχι φίλος
select pg_temp.ok((select count(*) = 0 from storage.objects), 'a non-friend sees no photos');
select pg_temp.as_user(:A);
select pg_temp.ok((select count(*) = 5 from storage.objects), 'owner sees all own photos');

-- ---------- 3) SOS ----------
-- θέσεις: ο A στις (34.60, 32.90). B 10 km μακριά σε ζωντανή έξοδο. C 100 km. D φίλος 300 km. E χωρίς θέση. B2: παλιά θέση (2 ώρες).
reset role;
insert into public.trip_live (user_id, lat, lon, active, at) values (:B, 34.69, 32.90, true, now());
insert into public.safety_trips (id, user_id, due_at, last_lat, last_lon, last_at, status) values ('c1', :C, now() + interval '2 hours', 35.50, 32.90, now(), 'active');
insert into public.trip_live (user_id, lat, lon, active, at) values (:D, 37.30, 32.90, true, now());
set role authenticated; select pg_temp.as_user(:A);
insert into public.sos_alerts (user_id, id, name, lat, lon, status, notified, created_at) values (:A, 'sos-1', 'A', 34.60, 32.90, 'active', 99, '2001-01-01');
select pg_temp.ok((select notified = 0 and created_at > now() - interval '1 minute' from public.sos_alerts), 'client cannot set notified/created_at on insert');
reset role; update public.sos_alerts set notified = 3;   -- η Edge Function (service) στέλνει push
set role authenticated; select pg_temp.as_user(:A);
update public.sos_alerts set notified = 0 where user_id = :A;
select pg_temp.ok((select notified = 3 from public.sos_alerts), 'client cannot reset notified to re-send pushes');
update public.sos_alerts set id = 'sos-2', notified = 0 where user_id = :A;   -- «νέο» SOS αμέσως
select pg_temp.ok((select id = 'sos-1' and notified = 3 from public.sos_alerts), 'a new SOS id within 10 minutes does not reset notified');
update public.sos_alerts set lat = 34.601, lon = 32.901 where user_id = :A;
select pg_temp.ok((select lat = 34.601 from public.sos_alerts), 'owner can still update the position');

select pg_temp.as_user(:B);
select pg_temp.ok((select count(*) = 1 from public.sos_alerts), 'B (10 km, live trip) sees the SOS');
select pg_temp.as_user(:C);
select pg_temp.ok((select count(*) = 0 from public.sos_alerts), 'C (100 km) does NOT see the SOS');
select pg_temp.as_user(:D);
select pg_temp.ok((select count(*) = 1 from public.sos_alerts), 'D (friend, 300 km) sees the SOS');
select pg_temp.as_user(:E);
select pg_temp.ok((select count(*) = 0 from public.sos_alerts), 'E (no server-known position) does NOT see the SOS');
-- όριο 20 ν.μ. = 37,04 km: F στα ~36,5 km βλέπει, G στα ~38 km όχι (το SOS είναι στο 34.601, 32.901)
reset role;
insert into public.trip_live (user_id, lat, lon, active, at) values (:F, 34.601 + 36.5 / 111.195, 32.901, true, now()), (:G, 34.601 + 38.0 / 111.195, 32.901, true, now());
set role authenticated; select pg_temp.as_user(:F);
select pg_temp.ok((select count(*) = 1 from public.sos_alerts), 'F at 36.5 km (inside 20 nm) sees the SOS');
select pg_temp.as_user(:G);
select pg_temp.ok((select count(*) = 0 from public.sos_alerts), 'G at 38 km (outside 20 nm) does NOT see the SOS');
select pg_temp.ok((select abs(public.alkyon_km(34.0, 33.0, 34.0 + 37.04 / 111.195, 33.0) - 37.04) < 0.05), 'server distance function: 20 nm = 37.04 km');
reset role; update public.trip_live set at = now() - interval '2 hours' where user_id = :B;
set role authenticated; select pg_temp.as_user(:B);
select pg_temp.ok((select count(*) = 0 from public.sos_alerts), 'B with a 2-hour-old position does NOT see the SOS');
reset role; update public.trip_live set at = now() where user_id = :B;
-- «Είμαι καλά» και νέο SOS αργότερα
set role authenticated; select pg_temp.as_user(:A);
update public.sos_alerts set status = 'ok' where user_id = :A;
select pg_temp.as_user(:B);
select pg_temp.ok((select count(*) = 0 from public.sos_alerts), 'an ended SOS is not visible');
reset role; update public.sos_alerts set at = now() - interval '3 minutes';
set role authenticated; select pg_temp.as_user(:A);
update public.sos_alerts set id = 'sos-3', status = 'active', notified = 0 where user_id = :A;   -- όπως η εφαρμογή σε νέο SOS
select pg_temp.ok((select id = 'sos-3' and notified = 0 from public.sos_alerts), 'a new SOS after "I am OK" resets notified');
reset role; update public.sos_alerts set notified = 4, created_at = now() - interval '20 minutes';
set role authenticated; select pg_temp.as_user(:A);
update public.sos_alerts set id = 'sos-other', lat = 34.602 where user_id = :A;   -- ενημέρωση θέσης (χωρίς notified) μετά από 20′
select pg_temp.ok((select notified = 4 and id = 'sos-3' and lat = 34.602 from public.sos_alerts), 'position updates of an active SOS never reset notified');
update public.sos_alerts set status = 'ok' where user_id = :A;
reset role; update public.sos_alerts set at = now() - interval '45 seconds';
set role authenticated; select pg_temp.as_user(:A);
update public.sos_alerts set id = 'sos-4', status = 'active', notified = 0 where user_id = :A;
select pg_temp.ok((select id = 'sos-4' and notified = 0 from public.sos_alerts), 'SOS again 45 s after "I am OK" alerts boats again');
-- «Είμαι καλά» κατά λάθος και SOS ξανά αμέσως (το SOS έτρεχε ήδη 20″): πρέπει να ξαναειδοποιήσει
reset role; update public.sos_alerts set notified = 5, created_at = now() - interval '20 seconds';
set role authenticated; select pg_temp.as_user(:A);
update public.sos_alerts set status = 'ok' where user_id = :A;
update public.sos_alerts set id = 'sos-5', status = 'active', notified = 0 where user_id = :A;
select pg_temp.ok((select id = 'sos-5' and notified = 0 and status = 'active' from public.sos_alerts), 'SOS right after an accidental "I am OK" alerts boats again');
-- κατάχρηση: SOS / «Είμαι καλά» / SOS μέσα σε 15″ από την έναρξη δεν ξαναστέλνει push
reset role; update public.sos_alerts set notified = 6;
set role authenticated; select pg_temp.as_user(:A);
update public.sos_alerts set status = 'ok' where user_id = :A;
update public.sos_alerts set id = 'sos-6', status = 'active', notified = 0 where user_id = :A;
select pg_temp.ok((select id = 'sos-5' and notified = 6 and status = 'active' from public.sos_alerts), 'SOS/OK flip-flop within 15 s of the start cannot re-send pushes');

-- ---------- 4) αναφορές θάλασσας ----------
select pg_temp.as_user(:A);
insert into public.sea_reports (lat, lon, state) values (34.6, 32.9, 2);
select pg_temp.as_user(:B);
select pg_temp.ok((select count(*) = 0 from public.sea_reports), 'other users cannot read the base sea_reports table');
select pg_temp.ok((select count(*) = 1 from public.sea_reports_pub), 'other users see the report through the view');
select pg_temp.ok((select count(*) = 0 from information_schema.columns where table_name = 'sea_reports_pub' and column_name = 'user_id'), 'the view does not expose user_id');

-- ---------- 5) ρολόι, job_state, παλμός ----------
reset role;
select pg_temp.ok((select expires_at > now() + interval '179 days' from public.watch_links where code = 'LEGACY01'), 'existing watch codes get a 180-day expiry (not cut off)');
set role authenticated; select pg_temp.as_user(:A);
do $$ begin
  begin perform 1 from public.job_state; raise exception 'FAIL: job_state readable by clients';
  exception when insufficient_privilege then raise notice 'ok   job_state is server-only'; end;
  begin perform 1 from public.watch_auth_fail; raise exception 'FAIL: watch_auth_fail readable by clients';
  exception when insufficient_privilege then raise notice 'ok   watch_auth_fail is server-only'; end;
end $$;
reset role;
select pg_temp.ok((select count(*) = 2 from information_schema.columns where table_name = 'safety_trips' and column_name in ('hb_key', 'hb_src')), 'safety_trips has hb_key/hb_src');
set role authenticated; select pg_temp.as_user(:A);
select pg_temp.ok((select public.alkyon_sync_version() = 2), 'sync version marker for the app (enables incremental pull)');
reset role;
\echo ALL SQL TESTS PASSED
