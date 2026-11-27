-- Αναίρεση του 2026-11-27-waitlist.sql (ΣΒΗΝΕΙ και τα emails της λίστας). Idempotent.
drop table if exists public.waitlist;
