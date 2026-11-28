#!/bin/bash
# Alkyon · έλεγχος των SQL migrations σε τοπικό, προσωρινό Postgres (χωρίς σύνδεση στην παραγωγή).
# Χρήση: bash tests/sql/run.sh   (χρειάζεται initdb/pg_ctl/psql, π.χ. postgresql-16)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BIN="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
[ -x "$BIN/initdb" ] || BIN="$(dirname "$(command -v initdb)")"
D="$(mktemp -d)"; PORT=$((20000 + RANDOM % 20000))
cleanup(){ "$BIN/pg_ctl" -D "$D/db" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$D"; }
trap cleanup EXIT
USR=$(id -un)
if [ "$(id -u)" = "0" ]; then RUN="su postgres -s /bin/bash -c"; chown -R postgres "$D" 2>/dev/null || { useradd -m postgres; chown -R postgres "$D"; }; USR=postgres; else RUN="bash -c"; fi
$RUN "$BIN/initdb -D $D/db -U $USR -A trust >/dev/null"
$RUN "$BIN/pg_ctl -D $D/db -o '-p $PORT -k $D -c listen_addresses=' -l $D/log -w start >/dev/null"
P="$BIN/psql -h $D -p $PORT -U $USR -d postgres -v ON_ERROR_STOP=1 -q"
$P -c "create extension if not exists pgcrypto" >/dev/null
$P -f "$ROOT/tests/sql/supabase-stub.sql" >/dev/null
$P -f "$ROOT/sql/2026-11-18-p0-trust.sql" >/dev/null
$P -f "$ROOT/sql/2026-11-18-p0-trust.sql" >/dev/null   # idempotent: δεύτερη εκτέλεση
$P -t -A -f "$ROOT/tests/sql/p0.test.sql" 2>&1 | grep -v "^$" | sed -e 's/^psql:[^ ]* NOTICE:  //' -e 's/^NOTICE:  //'
# αναίρεση (rollback) και ξανά το migration: και τα δύο πρέπει να τρέχουν καθαρά, και οι έλεγχοι να ξαναπερνούν
$P -f "$ROOT/sql/2026-11-18-p0-trust-rollback.sql" >/dev/null
$P -f "$ROOT/sql/2026-11-18-p0-trust-rollback.sql" >/dev/null   # idempotent
$P -t -A -c "select case when (select count(*) from pg_trigger where tgname in ('records_touch','sos_alerts_guard')) = 0 and (select qual !~ 'sos_can_see' from pg_policies where policyname = 'sos_read_active') and (select qual !~ 'priv' from pg_policies where policyname = 'photos_friends_read') and to_regprocedure('public.alkyon_sync_version()') is null then 'ok   rollback restores the pre-migration triggers/policies' else 'FAIL: rollback' end" | tee /dev/stderr | grep -q '^ok'
$P -f "$ROOT/sql/2026-11-18-p0-trust.sql" >/dev/null
$P -t -A -c "select case when (select count(*) from pg_trigger where tgname in ('records_touch','sos_alerts_guard')) = 2 and (select qual ~ 'sos_can_see' from pg_policies where policyname = 'sos_read_active') and to_regprocedure('public.alkyon_sync_version()') is not null then 'ok   migration re-applies after a rollback' else 'FAIL: re-apply' end" | tee /dev/stderr | grep -q '^ok'
# 26/11/2026: catch_obs: η εφαρμογή να μη σβήνει τα πεδία του server (trigger catch_obs_keep_srv)
$P -f "$ROOT/contrib.sql" >/dev/null
$P -f "$ROOT/sql/2026-11-26-catch-obs-keep-server.sql" >/dev/null
$P -f "$ROOT/sql/2026-11-26-catch-obs-keep-server.sql" >/dev/null   # idempotent
$P -t -A -f "$ROOT/tests/sql/keep-srv.test.sql" 2>&1 | grep -v "^$" | sed -e 's/^psql:[^ ]* NOTICE:  //' -e 's/^NOTICE:  //'
$P -f "$ROOT/sql/2026-11-26-catch-obs-keep-server-rollback.sql" >/dev/null
$P -f "$ROOT/sql/2026-11-26-catch-obs-keep-server-rollback.sql" >/dev/null   # idempotent
$P -t -A -c "update public.catch_obs set cond = '{\"wind\":9}' where ref = 'b:1'; select case when (select count(*) from pg_trigger where tgname = 'catch_obs_keep_srv') = 0 and (select cond = '{\"wind\":9}'::jsonb from public.catch_obs where ref = 'b:1') then 'ok   keep-srv rollback restores the old behaviour (cond replaced whole)' else 'FAIL: keep-srv rollback' end" | tail -1 | tee /dev/stderr | grep -q '^ok'
$P -f "$ROOT/sql/2026-11-26-catch-obs-keep-server.sql" >/dev/null
$P -t -A -c "select case when (select count(*) from pg_trigger where tgname = 'catch_obs_keep_srv') = 1 then 'ok   keep-srv migration re-applies after a rollback' else 'FAIL: keep-srv re-apply' end" | tee /dev/stderr | grep -q '^ok'
# 27/11/2026: λίστα «Ειδοποίησέ με» του website (public.waitlist)
$P -f "$ROOT/sql/2026-11-27-waitlist.sql" >/dev/null
$P -f "$ROOT/sql/2026-11-27-waitlist.sql" >/dev/null   # idempotent
$P -t -A -f "$ROOT/tests/sql/waitlist.test.sql" 2>&1 | grep -v "^$" | sed -e 's/^psql:[^ ]* NOTICE:  //' -e 's/^NOTICE:  //' | tee /dev/stderr | { ! grep -q FAIL; }   # 28/11: πριν «grep -q FAIL && exit 1 || true», που με pipefail δεν σταματούσε ποτέ
$P -f "$ROOT/sql/2026-11-27-waitlist-rollback.sql" >/dev/null
$P -f "$ROOT/sql/2026-11-27-waitlist-rollback.sql" >/dev/null   # idempotent
$P -t -A -c "select case when to_regclass('public.waitlist') is null then 'ok   waitlist rollback removes the table' else 'FAIL: waitlist rollback' end" | tee /dev/stderr | grep -q '^ok'
$P -f "$ROOT/sql/2026-11-27-waitlist.sql" >/dev/null
$P -t -A -c "select case when to_regclass('public.waitlist') is not null then 'ok   waitlist migration re-applies after a rollback' else 'FAIL: waitlist re-apply' end" | tee /dev/stderr | grep -q '^ok'
# 28/11/2026: πεδία αποστολής email της λίστας (welcomed_at, mail_tries)
$P -f "$ROOT/sql/2026-11-28-waitlist-mail.sql" >/dev/null
$P -f "$ROOT/sql/2026-11-28-waitlist-mail.sql" >/dev/null   # idempotent
$P -t -A -c "set role anon; do \$\$ begin insert into public.waitlist (email, welcomed_at) values ('m@n.co', now()); raise notice 'FAIL: anon can set welcomed_at'; exception when insufficient_privilege then raise notice 'ok   anon cannot set welcomed_at'; end \$\$; do \$\$ begin insert into public.waitlist (email, mail_tries) values ('m@n.co', 9); raise notice 'FAIL: anon can set mail_tries'; exception when insufficient_privilege then raise notice 'ok   anon cannot set mail_tries'; end \$\$; reset role;" 2>&1 | sed -e 's/^psql:[^ ]* NOTICE:  //' -e 's/^NOTICE:  //' | grep -v '^$' | tee /dev/stderr | { ! grep -q FAIL; }   # 28/11: όπως παραπάνω
$P -f "$ROOT/sql/2026-11-28-waitlist-mail-rollback.sql" >/dev/null
$P -f "$ROOT/sql/2026-11-28-waitlist-mail-rollback.sql" >/dev/null   # idempotent
$P -t -A -c "select case when not exists (select 1 from information_schema.columns where table_name='waitlist' and column_name in ('welcomed_at','mail_tries')) then 'ok   waitlist-mail rollback removes the columns' else 'FAIL: waitlist-mail rollback' end" | tee /dev/stderr | grep -q '^ok'
$P -f "$ROOT/sql/2026-11-28-waitlist-mail.sql" >/dev/null
# 1.14.93 · sql/2026-11-20-ml-data.sql: created_at στους records και catch_obs
$P -c "create table if not exists public.catch_obs (id bigserial primary key, user_id uuid not null, ref text not null, kind text, sp text, day date, ms bigint, ms2 bigint, lat numeric, lon numeric, cnt smallint, tech text, prof text, cond jsonb, updated_at timestamptz not null default now(), unique (user_id, ref))" >/dev/null
$P -c "insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000aa'), ('00000000-0000-0000-0000-0000000000a1'), ('00000000-0000-0000-0000-0000000000b2') on conflict do nothing; insert into public.records (user_id, kind, id, data) values ('00000000-0000-0000-0000-0000000000aa','trips','old','{}'::jsonb); insert into public.catch_obs (user_id, ref, kind, ms, day) values ('00000000-0000-0000-0000-0000000000aa','t:old','trip',1,'2026-11-20')" >/dev/null
$P -f "$ROOT/sql/2026-11-20-ml-data.sql" >/dev/null
$P -f "$ROOT/sql/2026-11-20-ml-data.sql" >/dev/null   # idempotent
$P -t -A -f "$ROOT/tests/sql/ml-data.test.sql" 2>&1 | grep -v "^$" | sed -e 's/^psql:[^ ]* NOTICE:  //' -e 's/^NOTICE:  //'
$P -f "$ROOT/sql/2026-11-20-ml-data-rollback.sql" >/dev/null
$P -f "$ROOT/sql/2026-11-20-ml-data-rollback.sql" >/dev/null   # idempotent
$P -t -A -c "select case when (select count(*) from pg_trigger where tgname in ('records_created_at','catch_obs_created_at')) = 0 and not exists (select 1 from information_schema.columns where table_schema='public' and column_name='created_at' and table_name in ('records','catch_obs')) and to_regprocedure('public.alk_created_at()') is null and to_regclass('public.trip_snaps') is null and to_regprocedure('public.alk_trip_snap_cleanup()') is null then 'ok   ml-data rollback removes the column, triggers, functions and the trip_snaps table' else 'FAIL: ml-data rollback' end" | tee /dev/stderr | grep -q '^ok'
$P -f "$ROOT/sql/2026-11-20-ml-data.sql" >/dev/null
$P -t -A -c "select case when (select count(*) from pg_trigger where tgname in ('records_created_at','catch_obs_created_at','trip_snaps_created_at','records_trip_snap_cleanup')) = 4 and to_regclass('public.trip_snaps') is not null then 'ok   ml-data migration re-applies after a rollback' else 'FAIL: ml-data re-apply' end" | tee /dev/stderr | grep -q '^ok'
# 28/11/2026 stage2: φίλοι B + C, ζωντανή θέση μόνο ενεργή, search_path (sql/2026-11-28-stage2-friends.sql)
$P -c "create table if not exists public.friend_invites (code text primary key, owner uuid not null default auth.uid(), name text, expires_at timestamptz not null default now() + interval '48 hours'); grant all on public.friend_invites to anon, authenticated, service_role;" >/dev/null
$P -f "$ROOT/sql/2026-11-28-stage2-friends-rollback.sql" >/dev/null   # η σημερινή κατάσταση της παραγωγής (πολιτικές και συναρτήσεις όπως διαβάστηκαν 28/11)
$P -f "$ROOT/sql/2026-11-28-stage2-friends.sql" >/dev/null
$P -f "$ROOT/sql/2026-11-28-stage2-friends.sql" >/dev/null   # idempotent
$P -t -A -f "$ROOT/tests/sql/stage2-friends.test.sql" 2>&1 | grep -v "^$" | sed -e 's/^psql:[^ ]* NOTICE:  //' -e 's/^NOTICE:  //'   # μία αποτυχία σταματά το psql (ON_ERROR_STOP) και, με pipefail, όλο το script
$P -f "$ROOT/sql/2026-11-28-stage2-friends-rollback.sql" >/dev/null
$P -f "$ROOT/sql/2026-11-28-stage2-friends-rollback.sql" >/dev/null   # idempotent
$P -t -A -c "select case when to_regprocedure('public.friend_view(uuid)') is null and exists (select 1 from pg_policies where policyname = 'records_friends_read') and exists (select 1 from pg_policies where policyname = 'photos_friends_read') and (select qual !~ 'active' from pg_policies where policyname = 'tl_friends') then 'ok   stage2 rollback restores the previous friends policies' else 'FAIL: stage2 rollback' end" | tee /dev/stderr | grep -q '^ok'
$P -f "$ROOT/sql/2026-11-28-stage2-friends.sql" >/dev/null
$P -t -A -c "select case when to_regprocedure('public.friend_view(uuid)') is not null and not exists (select 1 from pg_policies where policyname in ('records_friends_read','photos_friends_read')) and (select qual ~ 'active' from pg_policies where policyname = 'tl_friends') then 'ok   stage2 migration re-applies after a rollback' else 'FAIL: stage2 re-apply' end" | tee /dev/stderr | grep -q '^ok'
