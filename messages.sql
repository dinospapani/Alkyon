-- Alkyon 1.14.13 · Μηνύματα χρήστη ↔ Alkyon (απαντήσεις στα «Πες μας τη γνώμη σου») και ονόματα φίλων.
-- Τρέχει μία φορά στο Supabase (SQL editor ή migration). Ασφαλές να ξανατρέξει.

-- 1) Συζήτηση ανά χρήστη: user_id = ο χρήστης· from_admin = true όταν γράφει η Alkyon (διαχειριστής).
create table if not exists public.user_messages (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  from_admin boolean not null default false,
  author uuid default auth.uid(),
  body text not null check (char_length(body) between 1 and 4000),
  name text check (name is null or char_length(name) <= 60),   -- όνομα αποστολέα όπως το έγραψε (για τη λίστα του διαχειριστή)
  ref text,                                   -- προαιρετικά: σε ποιο μήνυμα «Πες μας τη γνώμη σου» απαντά (app_errors.at)
  created_at timestamptz not null default now(),
  read_at timestamptz
);
alter table public.user_messages add column if not exists name text;
create index if not exists user_messages_user_idx on public.user_messages (user_id, created_at desc);
alter table public.user_messages enable row level security;

create or replace function public.is_app_admin() returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.app_admins a where a.user_id = auth.uid()) $$;
grant execute on function public.is_app_admin() to authenticated;

drop policy if exists um_sel on public.user_messages;
create policy um_sel on public.user_messages for select using (user_id = auth.uid() or public.is_app_admin());
drop policy if exists um_ins_user on public.user_messages;
create policy um_ins_user on public.user_messages for insert with check (user_id = auth.uid() and from_admin = false and author = auth.uid());
drop policy if exists um_ins_admin on public.user_messages;
create policy um_ins_admin on public.user_messages for insert with check (public.is_app_admin() and from_admin = true and author = auth.uid());
-- «διαβάστηκε»: ο χρήστης στα μηνύματα της Alkyon, ο διαχειριστής στα μηνύματα των χρηστών
drop policy if exists um_upd on public.user_messages;
create policy um_upd on public.user_messages for update
  using ((user_id = auth.uid() and from_admin) or (public.is_app_admin() and not from_admin))
  with check ((user_id = auth.uid() and from_admin) or (public.is_app_admin() and not from_admin));

-- 2) Ονόματα φίλων: όταν κάποιος βάζει ή αλλάζει όνομα στον λογαριασμό του, αλλάζει και στη λίστα των φίλων του.
create or replace function public.sync_friend_names() returns trigger language plpgsql security definer set search_path = public as $$
declare n text := nullif(btrim(coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', '')), '');
begin
  if n is not null and n is distinct from nullif(btrim(coalesce(old.raw_user_meta_data->>'name', old.raw_user_meta_data->>'full_name', '')), '') then
    update public.friends set owner_name = left(n, 60) where owner = new.id and owner_name is distinct from left(n, 60);
    update public.friends set viewer_name = left(n, 60) where viewer = new.id and viewer_name is distinct from left(n, 60);
  end if;
  return new;
end $$;
drop trigger if exists trg_sync_friend_names on auth.users;
create trigger trg_sync_friend_names after update of raw_user_meta_data on auth.users
  for each row execute function public.sync_friend_names();

-- Συμπλήρωση όσων λείπουν ήδη (π.χ. φίλος που έβαλε όνομα μετά τη σύνδεση)
update public.friends f set owner_name = left(btrim(coalesce(u.raw_user_meta_data->>'name', u.raw_user_meta_data->>'full_name')), 60)
  from auth.users u where u.id = f.owner and coalesce(f.owner_name, '') = '' and btrim(coalesce(u.raw_user_meta_data->>'name', u.raw_user_meta_data->>'full_name', '')) <> '';
update public.friends f set viewer_name = left(btrim(coalesce(u.raw_user_meta_data->>'name', u.raw_user_meta_data->>'full_name')), 60)
  from auth.users u where u.id = f.viewer and coalesce(f.viewer_name, '') = '' and btrim(coalesce(u.raw_user_meta_data->>'name', u.raw_user_meta_data->>'full_name', '')) <> '';
