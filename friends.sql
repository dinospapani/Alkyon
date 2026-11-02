-- Alkyon: Φίλοι (κοινή χρήση ψαριών, σημείων και φωτογραφιών, μόνο ανάγνωση).
-- ΠΡΩΤΑ ανέβασε την έκδοση v31z401 ή νεότερη και άνοιξε την εφαρμογή μία φορά. ΜΕΤΑ τρέξε ολόκληρο αυτό το αρχείο
-- στο Supabase → SQL Editor → Run. Είναι ασφαλές να το ξανατρέξεις.

-- 0) έλεγχος: ο πίνακας records πρέπει να έχει στήλη user_id
do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='records' and column_name='user_id') then
    raise exception 'Ο πίνακας records δεν έχει στήλη user_id. Μην συνεχίσεις: στείλε τη δομή του πίνακα.';
  end if;
end $$;

-- 1) προσκλήσεις (κωδικός μίας χρήσης, 48 ώρες)
create table if not exists public.friend_invites (
  code text primary key check (code ~ '^[A-Z0-9]{6,12}$'),
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  name text check (name is null or char_length(name) <= 40),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '48 hours'
);
alter table public.friend_invites enable row level security;
drop policy if exists fi_sel on public.friend_invites;
drop policy if exists fi_ins on public.friend_invites;
drop policy if exists fi_del on public.friend_invites;
create policy fi_sel on public.friend_invites for select to authenticated using (owner = auth.uid());
create policy fi_ins on public.friend_invites for insert to authenticated with check (owner = auth.uid());
create policy fi_del on public.friend_invites for delete to authenticated using (owner = auth.uid());

-- 2) φιλίες: μία γραμμή ανά κατεύθυνση. (owner → viewer, share) = ο owner δείχνει τα δικά του στον viewer.
create table if not exists public.friends (
  owner uuid not null references auth.users on delete cascade,
  viewer uuid not null references auth.users on delete cascade,
  owner_name text check (owner_name is null or char_length(owner_name) <= 40),
  viewer_name text check (viewer_name is null or char_length(viewer_name) <= 40),
  share boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (owner, viewer),
  check (owner <> viewer)
);
create index if not exists friends_viewer on public.friends (viewer);
alter table public.friends enable row level security;
drop policy if exists fr_sel on public.friends;
drop policy if exists fr_upd on public.friends;
drop policy if exists fr_del on public.friends;
create policy fr_sel on public.friends for select to authenticated using (owner = auth.uid() or viewer = auth.uid());
create policy fr_upd on public.friends for update to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
create policy fr_del on public.friends for delete to authenticated using (owner = auth.uid() or viewer = auth.uid());
-- νέες φιλίες μόνο μέσω κωδικού (συνάρτηση παρακάτω)· από την εφαρμογή αλλάζει μόνο το «share»
revoke insert, update on public.friends from anon, authenticated;
grant select, delete on public.friends to authenticated;
grant update (share) on public.friends to authenticated;

-- 3) εξαργύρωση κωδικού: φιλία και προς τις δύο κατευθύνσεις
create or replace function public.redeem_friend(p_code text, p_name text)
returns json language plpgsql security definer set search_path = public as $$
declare inv public.friend_invites; me uuid := auth.uid(); nm text := left(coalesce(p_name, ''), 40);
begin
  if me is null then raise exception 'Χρειάζεται σύνδεση.'; end if;
  select * into inv from public.friend_invites where code = upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')) and expires_at > now();
  if not found then raise exception 'Ο κωδικός δεν υπάρχει ή έληξε.'; end if;
  if inv.owner = me then raise exception 'Αυτός είναι ο δικός σου κωδικός.'; end if;
  insert into public.friends (owner, viewer, owner_name, viewer_name) values (inv.owner, me, inv.name, nm)
    on conflict (owner, viewer) do update set owner_name = excluded.owner_name, viewer_name = excluded.viewer_name;
  insert into public.friends (owner, viewer, owner_name, viewer_name) values (me, inv.owner, nm, inv.name)
    on conflict (owner, viewer) do update set owner_name = excluded.owner_name, viewer_name = excluded.viewer_name;
  delete from public.friend_invites where code = inv.code;
  delete from public.friend_invites where expires_at < now();
  return json_build_object('friend', inv.owner, 'name', inv.name);
end $$;
revoke all on function public.redeem_friend(text, text) from public, anon;
grant execute on function public.redeem_friend(text, text) to authenticated;

-- 4) ανάγνωση εγγραφών φίλου: μόνο ψάρια και σημεία, όχι σβησμένα, όχι «Ιδιωτικά», μόνο αν ο φίλος μοιράζεται.
--    Οι υπάρχοντες κανόνες (ο καθένας τα δικά του) μένουν ως έχουν· αυτός προστίθεται.
drop policy if exists records_friends_read on public.records;
create policy records_friends_read on public.records for select to authenticated using (
  kind in ('bites', 'spots')
  and not coalesce(deleted, false)
  and coalesce((data ->> 'priv')::boolean, false) = false
  and exists (select 1 from public.friends f where f.owner = records.user_id and f.viewer = auth.uid() and f.share)
);

-- 5) φωτογραφίες φίλου (bucket «photos», φάκελος = user id του φίλου)
drop policy if exists photos_friends_read on storage.objects;
create policy photos_friends_read on storage.objects for select to authenticated using (
  bucket_id = 'photos'
  and exists (select 1 from public.friends f where f.owner::text = (storage.foldername(name))[1] and f.viewer = auth.uid() and f.share)
);
