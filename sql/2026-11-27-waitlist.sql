-- Alkyon · λίστα «Ειδοποίησέ με» του website (alkyonfishing.com), 27/11/2026.
-- Κρατά ΜΟΝΟ email + γλώσσα + ημερομηνία. Ο επισκέπτης (anon) μπορεί μόνο να ΓΡΑΨΕΙ μια γραμμή·
-- κανείς από την εφαρμογή/website δεν μπορεί να διαβάσει, αλλάξει ή σβήσει (μόνο ο διαχειριστής από το Supabase).
-- Idempotent: τρέχει ξανά χωρίς λάθος.
create table if not exists public.waitlist (
  id bigint generated always as identity primary key,
  email text not null check (char_length(email) between 6 and 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  lang text not null default 'en' check (lang in ('en','el')),
  created_at timestamptz not null default now()
);
create unique index if not exists waitlist_email_uq on public.waitlist (lower(email));
alter table public.waitlist enable row level security;
revoke all on public.waitlist from anon, authenticated;
grant insert (email, lang) on public.waitlist to anon, authenticated;
drop policy if exists waitlist_insert on public.waitlist;
create policy waitlist_insert on public.waitlist for insert to anon, authenticated with check (true);
