-- Alkyon 1.9.19: σημειώσεις λιμανιών και ραμπών. Τρέξε ολόκληρο αυτό το αρχείο στο Supabase → SQL Editor → Run. Είναι ασφαλές να το ξανατρέξεις.
-- Οι χρήστες στέλνουν σημειώσεις (ρηχά, βράχια, φουσκοθαλασσιά, γλιστερή ράμπα, χρέωση, πάρκινγκ, καύσιμα, νερό…).
-- Κάθε σημείωση μένει «σε αναμονή» και φαίνεται στους άλλους μόνο αφού την εγκρίνει διαχειριστής
-- (από το Telegram με ✅/❌, ή μέσα στην εφαρμογή: Προφίλ › Σημειώσεις λιμανιών για έγκριση).

create extension if not exists pgcrypto;

-- διαχειριστές: όποιος είναι εδώ βλέπει και εγκρίνει τις σημειώσεις
create table if not exists public.app_admins (
  user_id uuid primary key references auth.users on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.app_admins enable row level security;
drop policy if exists "admins self" on public.app_admins;
create policy "admins self" on public.app_admins for select to authenticated using (user_id = auth.uid());

-- ΒΑΛΕ ΕΔΩ το email του λογαριασμού σου στο Alkyon (αυτό που κάνεις σύνδεση στο Προφίλ) και τρέξε το αρχείο:
insert into public.app_admins (user_id)
  select id from auth.users where lower(email) = lower('ΤΟ_EMAIL_ΣΟΥ@gmail.com')
on conflict do nothing;

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.app_admins where user_id = auth.uid());
$$;

create table if not exists public.port_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  port_key text not null check (char_length(port_key) <= 40),
  port_name text check (port_name is null or char_length(port_name) <= 80),
  lat numeric not null check (lat between -90 and 90),
  lon numeric not null check (lon between -180 and 180),
  tags text[] not null default '{}',
  note text check (note is null or char_length(note) <= 240),
  author text check (author is null or char_length(author) <= 40),
  status text not null default 'pending' check (status in ('pending', 'ok', 'rejected')),
  tg_sent boolean not null default false,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  check (cardinality(tags) <= 8),
  check (cardinality(tags) > 0 or note is not null)
);
create index if not exists port_notes_key on public.port_notes (port_key, status);
create index if not exists port_notes_pending on public.port_notes (status, tg_sent) where status = 'pending';

alter table public.port_notes enable row level security;

drop policy if exists "pn read" on public.port_notes;
create policy "pn read" on public.port_notes for select to authenticated
  using (status = 'ok' or user_id = auth.uid() or public.is_admin());
drop policy if exists "pn insert" on public.port_notes;
create policy "pn insert" on public.port_notes for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "pn delete" on public.port_notes;
create policy "pn delete" on public.port_notes for delete to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists "pn decide" on public.port_notes;
create policy "pn decide" on public.port_notes for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- κάθε νέα σημείωση ξεκινά «σε αναμονή»· έως 10 τη μέρα ανά χρήστη· μόνο γνωστές ετικέτες
create or replace function public.port_notes_before() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.status := 'pending'; new.tg_sent := false; new.decided_at := null;
    new.note := nullif(btrim(new.note), '');
    new.tags := array(select distinct t from unnest(new.tags) t where t in
      ('shallow','rocks','swell','slippery','fee','parking','fuel','water','crowded','good','night','wind'));
    if (select count(*) from public.port_notes where user_id = new.user_id and created_at > now() - interval '1 day') >= 10 then
      raise exception 'rate: too many port notes today';
    end if;
  elsif tg_op = 'UPDATE' then
    if new.status is distinct from old.status then new.decided_at := now(); end if;
  end if;
  return new;
end $$;
drop trigger if exists port_notes_before on public.port_notes;
create trigger port_notes_before before insert or update on public.port_notes for each row execute function public.port_notes_before();

-- 1.9.24: η συνάρτηση trigger δεν καλείται απ' έξω· το is_admin μόνο για συνδεδεμένους
revoke execute on function public.port_notes_before() from public, anon, authenticated;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
