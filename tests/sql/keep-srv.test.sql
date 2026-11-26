-- Έλεγχοι του sql/2026-11-26-catch-obs-keep-server.sql (τρέχουν μετά το contrib.sql και το migration). Κάθε αποτυχία σταματά με error.
\set ON_ERROR_STOP 1
create or replace function pg_temp.ok(c boolean, msg text) returns void language plpgsql as $$ begin if not coalesce(c,false) then raise exception 'FAIL: %', msg; end if; raise notice 'ok   %', msg; end $$;
create or replace function pg_temp.as_user(u text) returns void language plpgsql as $$ begin perform set_config('test.uid', u, false); end $$;
\set U '''00000000-0000-0000-0000-0000000000c1'''
\set V '''00000000-0000-0000-0000-0000000000c2'''
insert into auth.users values (:U), (:V) on conflict do nothing;

-- η εφαρμογή στέλνει (όπως το v4/contrib.js: upsert στο user_id,ref)
set role authenticated; select pg_temp.as_user(:U);
insert into public.catch_obs (ref, kind, sp, day, ms, lat, lon, cnt, cond) values
  ('b:1', 'catch', 'sparus aurata', '2026-11-25', 1764100000000, 34.6, 32.9, 1, '{"wind":5}'),
  ('b:2', 'catch', 'sparus aurata', '2026-11-25', 1764100000000, 34.6, 32.9, 1, '{"wind":5}'),
  ('t:3', 'trip', null, '2026-11-25', 1764090000000, 34.6, 32.9, 2, null);
reset role;
-- ο server συμπληρώνει (service role, PATCH με ολόκληρο το cond)
update public.catch_obs set cond = cond || '{"enr":2,"e":{"wind":4.8},"d":[{"wind":3}],"chl":0.12,"chv":2,"thd":0,"thv":1}' where ref in ('b:1','b:2');
update public.catch_obs set cond = '{"enr":2,"e":[{"wind":4}],"cht":1764160000000}' where ref = 't:3';

-- 1) η εφαρμογή ξαναστέλνει την ίδια εγγραφή, με αλλαγμένο δικό της πεδίο
set role authenticated; select pg_temp.as_user(:U);
insert into public.catch_obs (ref, kind, sp, day, ms, lat, lon, cnt, cond) values
  ('b:1', 'catch', 'sparus aurata', '2026-11-25', 1764100000000, 34.6, 32.9, 2, '{"wind":5,"bait":"shrimp"}')
  on conflict (user_id, ref) do update set kind = excluded.kind, sp = excluded.sp, day = excluded.day, ms = excluded.ms, ms2 = excluded.ms2,
    lat = excluded.lat, lon = excluded.lon, cnt = excluded.cnt, tech = excluded.tech, prof = excluded.prof, cond = excluded.cond, updated_at = excluded.updated_at;
reset role;
select pg_temp.ok((select cond->>'enr' = '2' and cond->'e'->>'wind' = '4.8' and jsonb_array_length(cond->'d') = 1 and cond->>'chl' = '0.12' and cond->>'chv' = '2' and cond->>'thd' = '0' and cond->>'thv' = '1' from public.catch_obs where ref = 'b:1'),
  'resend from the app keeps the server fields (enr, e, d, chl, chv, thd, thv)');
select pg_temp.ok((select cond->>'bait' = 'shrimp' and cond->>'wind' = '5' and cnt = 2 from public.catch_obs where ref = 'b:1'), 'resend from the app still updates the app''s own fields');

-- 2) η εφαρμογή άλλαξε ώρα: ο καιρός δεν ισχύει πια → δεν κρατιέται
set role authenticated; select pg_temp.as_user(:U);
update public.catch_obs set ms = 1764103600000, cond = '{"wind":5}' where ref = 'b:2';
reset role;
select pg_temp.ok((select not (cond ? 'enr') and not (cond ? 'e') and not (cond ? 'chl') from public.catch_obs where ref = 'b:2'), 'changed time → server fields are dropped so the server re-enriches');
select pg_temp.ok((select cond->>'wind' = '5' from public.catch_obs where ref = 'b:2'), 'changed time → the app''s cond is stored as sent');

-- 3) έξοδος με cond = null από την εφαρμογή (π.χ. χωρίς «Πώς ήταν»): κρατά τα του server
set role authenticated; select pg_temp.as_user(:U);
update public.catch_obs set cnt = 3, cond = null where ref = 't:3';
reset role;
select pg_temp.ok((select cond->>'enr' = '2' and cond ? 'e' and cond->>'cht' = '1764160000000' and cnt = 3 from public.catch_obs where ref = 't:3'), 'trip resent with cond = null keeps the server fields (incl. the retry time cht)');

-- 4) ο server γράφει (έχει enr): περνά όπως είναι, ακόμα κι αν αφαιρεί κλειδιά (π.χ. enr=-1 χωρίς e/d)
update public.catch_obs set cond = '{"wind":5,"bait":"shrimp","enr":-1}' where ref = 'b:1';
select pg_temp.ok((select cond = '{"wind":5,"bait":"shrimp","enr":-1}'::jsonb from public.catch_obs where ref = 'b:1'), 'a server write (has enr) is stored exactly as sent');

-- 5) εγγραφή χωρίς τίποτα από τον server: καμία αλλαγή
set role authenticated; select pg_temp.as_user(:U);
insert into public.catch_obs (ref, kind, sp, day, ms, lat, lon, cnt, cond) values ('b:9', 'catch', 'x', '2026-11-25', 1764100000000, 34.6, 32.9, 1, '{"wind":1}');
update public.catch_obs set cond = '{"wind":2}' where ref = 'b:9';
reset role;
select pg_temp.ok((select cond = '{"wind":2}'::jsonb from public.catch_obs where ref = 'b:9'), 'row never enriched → update stored as sent');

-- 6) RLS αμετάβλητο: άλλος χρήστης δεν βλέπει/αλλάζει
set role authenticated; select pg_temp.as_user(:V);
update public.catch_obs set cond = '{}' where ref = 'b:1';
select pg_temp.ok((select count(*) = 0 from public.catch_obs), 'another user still sees no rows (RLS unchanged)');
reset role;
select pg_temp.ok((select cond->>'bait' = 'shrimp' from public.catch_obs where ref = 'b:1'), 'another user cannot change the row (RLS unchanged)');
