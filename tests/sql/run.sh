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
$P -t -A -f "$ROOT/tests/sql/waitlist.test.sql" 2>&1 | grep -v "^$" | sed -e 's/^psql:[^ ]* NOTICE:  //' -e 's/^NOTICE:  //' | tee /dev/stderr | grep -q FAIL && exit 1 || true
$P -f "$ROOT/sql/2026-11-27-waitlist-rollback.sql" >/dev/null
$P -f "$ROOT/sql/2026-11-27-waitlist-rollback.sql" >/dev/null   # idempotent
$P -t -A -c "select case when to_regclass('public.waitlist') is null then 'ok   waitlist rollback removes the table' else 'FAIL: waitlist rollback' end" | tee /dev/stderr | grep -q '^ok'
$P -f "$ROOT/sql/2026-11-27-waitlist.sql" >/dev/null
$P -t -A -c "select case when to_regclass('public.waitlist') is not null then 'ok   waitlist migration re-applies after a rollback' else 'FAIL: waitlist re-apply' end" | tee /dev/stderr | grep -q '^ok'
