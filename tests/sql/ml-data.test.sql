-- Έλεγχοι του sql/2026-11-20-ml-data.sql (created_at από τον server, αμετάβλητο). Κάθε αποτυχία σταματά με error.
\set ON_ERROR_STOP 1
create or replace function pg_temp.ok(c boolean, msg text) returns void language plpgsql as $$ begin if not coalesce(c,false) then raise exception 'FAIL: %', msg; end if; raise notice 'ok   %', msg; end $$;
\set U '''00000000-0000-0000-0000-0000000000aa'''

-- γραμμές που υπήρχαν ΠΡΙΝ από τη στήλη μένουν NULL (το run.sh τις βάζει πριν από το migration)
select pg_temp.ok((select created_at is null from public.records where id = 'old'), 'records: a row from before the column keeps created_at NULL');
select pg_temp.ok((select created_at is null from public.catch_obs where ref = 't:old'), 'catch_obs: a row from before the column keeps created_at NULL');
update public.records set data = '{"x":1}'::jsonb where id = 'old';
select pg_temp.ok((select created_at is null from public.records where id = 'old'), 'records: updating an old row does not invent a creation date');

-- νέα γραμμή: την ώρα τη βάζει ο server, ό,τι κι αν στείλει ο πελάτης
insert into public.records (user_id, kind, id, data, created_at) values (:U, 'trips', 'n1', '{}'::jsonb, '2001-01-01');
select pg_temp.ok((select created_at > now() - interval '1 minute' from public.records where id = 'n1'), 'records: a client-supplied created_at is ignored on insert');
update public.records set created_at = '2001-01-01', data = '{"y":2}'::jsonb where id = 'n1';
select pg_temp.ok((select created_at > now() - interval '1 minute' from public.records where id = 'n1'), 'records: created_at cannot be changed afterwards');

-- upsert όπως το κάνει η εφαρμογή (merge-duplicates): η αρχική ώρα μένει
create temp table t0 as select created_at from public.records where id = 'n1';
select pg_sleep(0.05);
insert into public.records (user_id, kind, id, data) values (:U, 'trips', 'n1', '{"z":3}'::jsonb)
  on conflict (user_id, kind, id) do update set data = excluded.data;
select pg_temp.ok((select r.created_at = t0.created_at and r.data = '{"z":3}'::jsonb from public.records r, t0 where r.id = 'n1'), 'records: an upsert keeps the first created_at and still updates the data');

insert into public.catch_obs (user_id, ref, kind, ms, cond, created_at) values (:U, 't:n1', 'trip', 1, '{"snap":{"v":1}}'::jsonb, '2001-01-01');
select pg_temp.ok((select created_at > now() - interval '1 minute' from public.catch_obs where ref = 't:n1'), 'catch_obs: created_at comes from the server');
create temp table c0 as select created_at from public.catch_obs where ref = 't:n1';
select pg_sleep(0.05);
insert into public.catch_obs (user_id, ref, kind, ms, cond) values (:U, 't:n1', 'trip', 1, '{"snap":{"v":1},"e":[1]}'::jsonb)
  on conflict (user_id, ref) do update set cond = excluded.cond, updated_at = now();
select pg_temp.ok((select o.created_at = c0.created_at and o.cond ? 'e' and o.cond ? 'snap' from public.catch_obs o, c0 where o.ref = 't:n1'), 'catch_obs: an upsert keeps created_at');
select pg_temp.ok((select count(*) = 2 from pg_trigger where tgname in ('records_created_at','catch_obs_created_at')), 'both triggers exist');
select pg_temp.ok((select proconfig::text ~ 'search_path' from pg_proc where proname = 'alk_created_at'), 'the trigger function has a fixed search_path');

-- ---------------------------------------------------------------------------------------------------------------------
-- trip_snaps: ο ιδιοκτήτης βλέπει το στιγμιότυπό του· ο φίλος με ενεργό μοίρασμα βλέπει την ΕΞΟΔΟ αλλά όχι το στιγμιότυπο.
\set A '''00000000-0000-0000-0000-0000000000a1'''
\set F '''00000000-0000-0000-0000-0000000000f1'''
\set S '''00000000-0000-0000-0000-0000000000c1'''
insert into auth.users (id) values (:A), (:F), (:S) on conflict do nothing;
insert into public.friends (owner, viewer, share) values (:A, :F, true) on conflict do nothing;   -- ο F είναι φίλος του A, με μοίρασμα
create or replace function pg_temp.as_user(u text) returns void language plpgsql as $$ begin perform set_config('test.uid', u, false); end $$;
create or replace function pg_temp.fails(q text) returns boolean language plpgsql as $$ begin execute q; return false; exception when others then return true; end $$;

set role authenticated; select pg_temp.as_user(:A);
insert into public.records (user_id, kind, id, data) values (:A, 'trips', 'tripA', '{"startMs":1,"endMs":2}'::jsonb);
insert into public.trip_snaps (user_id, trip_id, snap) values (:A, 'tripA', '{"v":1,"cols":["wind"],"h":[[1,5,"o"]]}'::jsonb);
select pg_temp.ok((select count(*) = 1 from public.trip_snaps where trip_id = 'tripA'), 'owner sees their own snapshot');
select pg_temp.ok((select created_at > now() - interval '1 minute' from public.trip_snaps where trip_id = 'tripA'), 'trip_snaps: created_at comes from the server');
select pg_temp.ok(pg_temp.fails($q$ update public.trip_snaps set snap = '{"v":1,"x":1}'::jsonb where trip_id = 'tripA' $q$) or (select snap ? 'cols' from public.trip_snaps where trip_id = 'tripA'), 'a snapshot cannot be changed after it is written');
select pg_temp.ok((select snap ? 'cols' and not snap ? 'x' from public.trip_snaps where trip_id = 'tripA'), 'the stored snapshot is still the first one');
-- ίδια έξοδος δεύτερη φορά, όπως το στέλνει η εφαρμογή (ignore-duplicates): μένει το πρώτο
insert into public.trip_snaps (user_id, trip_id, snap) values (:A, 'tripA', '{"v":1,"second":true}'::jsonb) on conflict (user_id, trip_id) do nothing;
select pg_temp.ok((select not snap ? 'second' from public.trip_snaps where trip_id = 'tripA'), 'a second upload for the same trip keeps the first snapshot');
select pg_temp.ok(pg_temp.fails($q$ insert into public.trip_snaps (user_id, trip_id, snap) values ('00000000-0000-0000-0000-0000000000f1', 'x', '{"v":1}'::jsonb) $q$), 'nobody can write a snapshot for another user');
select pg_temp.ok(pg_temp.fails($q$ insert into public.trip_snaps (trip_id, snap) values ('big', jsonb_build_object('h', repeat('x', 40000))) $q$), 'an oversized snapshot is refused');
select pg_temp.ok(pg_temp.fails($q$ insert into public.trip_snaps (trip_id, snap) values ('arr', '[1,2]'::jsonb) $q$), 'a snapshot must be an object');

select pg_temp.as_user(:F);   -- ο φίλος
select pg_temp.ok((select count(*) = 1 from public.records where user_id = '00000000-0000-0000-0000-0000000000a1' and kind = 'trips' and id = 'tripA'), 'the friend CAN read the shared trip (existing behaviour, unchanged)');
select pg_temp.ok((select count(*) = 0 from public.trip_snaps), 'the friend sees NO snapshot at all');
select pg_temp.ok((select not (data ? 'snap') from public.records where user_id = '00000000-0000-0000-0000-0000000000a1' and id = 'tripA'), 'the trip the friend reads carries no snapshot');
delete from public.trip_snaps where trip_id = 'tripA';
select pg_temp.as_user(:S);   -- ξένος
select pg_temp.ok((select count(*) = 0 from public.trip_snaps), 'a stranger sees no snapshot');
reset role;
select pg_temp.ok((select count(*) = 1 from public.trip_snaps where trip_id = 'tripA'), 'the friend could not delete it either');
set role anon;
select pg_temp.ok(pg_temp.fails($q$ select count(*) from public.trip_snaps $q$), 'anonymous visitors have no access to the table');
reset role;
select pg_temp.ok((select count(*) = 3 and bool_and(qual ~ 'user_id = auth.uid\(\)' or with_check ~ 'user_id = auth.uid\(\)') from pg_policies where tablename = 'trip_snaps'), 'trip_snaps has exactly three policies, all owner-only');
select pg_temp.ok((select count(*) = 0 from pg_policies where tablename = 'trip_snaps' and cmd in ('UPDATE', 'ALL')), 'no policy allows updating a snapshot');
select pg_temp.ok(not has_table_privilege('authenticated', 'public.trip_snaps', 'UPDATE') and not has_table_privilege('anon', 'public.trip_snaps', 'SELECT'), 'no UPDATE grant for users, nothing for anon');

-- σβήσιμο εξόδου → σβήνεται και το στιγμιότυπο (σημάδι deleted, όπως το κάνει ο συγχρονισμός)
set role authenticated; select pg_temp.as_user(:A);
update public.records set deleted = true where kind = 'trips' and id = 'tripA';
select pg_temp.ok((select count(*) = 0 from public.trip_snaps where trip_id = 'tripA'), 'marking the trip deleted removes its snapshot');
insert into public.records (user_id, kind, id, data) values (:A, 'trips', 'tripB', '{}'::jsonb), (:A, 'bites', 'tripC', '{}'::jsonb);
insert into public.trip_snaps (user_id, trip_id, snap) values (:A, 'tripB', '{"v":1}'::jsonb), (:A, 'tripC', '{"v":1}'::jsonb);
update public.records set data = '{"n":1}'::jsonb where id = 'tripB';
select pg_temp.ok((select count(*) = 1 from public.trip_snaps where trip_id = 'tripB'), 'an ordinary edit of the trip keeps the snapshot');
delete from public.records where kind = 'bites' and id = 'tripC';
select pg_temp.ok((select count(*) = 1 from public.trip_snaps where trip_id = 'tripC'), 'deleting a catch with the same id does not touch a snapshot');
delete from public.records where kind = 'trips' and id = 'tripB';
select pg_temp.ok((select count(*) = 0 from public.trip_snaps where trip_id = 'tripB'), 'deleting the trip row removes its snapshot');
reset role;
-- διαγραφή λογαριασμού → φεύγουν όλα τα στιγμιότυπα
delete from public.records where user_id = :A; delete from public.friends where owner = :A;
delete from auth.users where id = :A;
select pg_temp.ok((select count(*) = 0 from public.trip_snaps where user_id = :A), 'deleting the account removes its snapshots');
