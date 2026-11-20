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
# 1.14.93 · sql/2026-11-20-ml-data.sql: created_at στους records και catch_obs
$P -c "create table if not exists public.catch_obs (id bigserial primary key, user_id uuid not null, ref text not null, kind text, sp text, day date, ms bigint, ms2 bigint, lat numeric, lon numeric, cnt smallint, tech text, prof text, cond jsonb, updated_at timestamptz not null default now(), unique (user_id, ref))" >/dev/null
$P -c "insert into public.records (user_id, kind, id, data) values ('00000000-0000-0000-0000-0000000000aa','trips','old','{}'::jsonb); insert into public.catch_obs (user_id, ref, kind, ms) values ('00000000-0000-0000-0000-0000000000aa','t:old','trip',1)" >/dev/null
$P -f "$ROOT/sql/2026-11-20-ml-data.sql" >/dev/null
$P -f "$ROOT/sql/2026-11-20-ml-data.sql" >/dev/null   # idempotent
$P -t -A -f "$ROOT/tests/sql/ml-data.test.sql" 2>&1 | grep -v "^$" | sed -e 's/^psql:[^ ]* NOTICE:  //' -e 's/^NOTICE:  //'
$P -f "$ROOT/sql/2026-11-20-ml-data-rollback.sql" >/dev/null
$P -f "$ROOT/sql/2026-11-20-ml-data-rollback.sql" >/dev/null   # idempotent
$P -t -A -c "select case when (select count(*) from pg_trigger where tgname in ('records_created_at','catch_obs_created_at')) = 0 and not exists (select 1 from information_schema.columns where table_schema='public' and column_name='created_at' and table_name in ('records','catch_obs')) and to_regprocedure('public.alk_created_at()') is null then 'ok   ml-data rollback removes the column, triggers and function' else 'FAIL: ml-data rollback' end" | tee /dev/stderr | grep -q '^ok'
$P -f "$ROOT/sql/2026-11-20-ml-data.sql" >/dev/null
$P -t -A -c "select case when (select count(*) from pg_trigger where tgname in ('records_created_at','catch_obs_created_at')) = 2 then 'ok   ml-data migration re-applies after a rollback' else 'FAIL: ml-data re-apply' end" | tee /dev/stderr | grep -q '^ok'
