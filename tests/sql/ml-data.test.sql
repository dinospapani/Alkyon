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
