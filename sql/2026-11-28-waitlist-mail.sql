-- Alkyon · emails της λίστας «Ειδοποίησέ με» (28/11/2026): πότε στάλθηκε το καλωσόρισμα και πόσες αποτυχίες.
-- Τα πεδία τα γράφει μόνο ο server (service role). Ο επισκέπτης εξακολουθεί να μπορεί ΜΟΝΟ insert(email, lang). Idempotent.
alter table public.waitlist add column if not exists welcomed_at timestamptz;
alter table public.waitlist add column if not exists mail_tries smallint not null default 0;
create index if not exists waitlist_pending on public.waitlist (id) where welcomed_at is null;
