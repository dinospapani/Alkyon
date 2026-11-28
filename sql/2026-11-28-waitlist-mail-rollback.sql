-- Αναίρεση του 2026-11-28-waitlist-mail.sql (τα emails της λίστας μένουν). Idempotent.
drop index if exists public.waitlist_pending;
alter table public.waitlist drop column if exists mail_tries;
alter table public.waitlist drop column if exists welcomed_at;
