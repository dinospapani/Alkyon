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
