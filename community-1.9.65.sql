-- Alkyon 1.9.65 · Κοινότητα: επεξεργασία ανάρτησης, διαχείριση αναφορών, ανάγνωση χωρίς λογαριασμό,
-- like σε σχόλια, φωτογραφία προφίλ. ΕΦΑΡΜΟΣΤΗΚΕ ήδη στο Supabase (migration alkyon_1_9_65_community, 2026-11-08).

-- 1) Επεξεργασία δικής σου ανάρτησης: μόνο συγκεκριμένα πεδία, μόνο ορατές αναρτήσεις
revoke update on public.community_posts from anon, authenticated;
revoke update on public.community_comments from anon, authenticated;
grant update (species, latin, kg, len, bait, tech, cond) on public.community_posts to authenticated;
drop policy if exists "posts update own" on public.community_posts;
create policy "posts update own" on public.community_posts for update to authenticated
  using (user_id = auth.uid() and hidden = false) with check (user_id = auth.uid() and hidden = false);

-- 2) Διαχείριση (μόνο app_admins)
create or replace function public.community_is_admin() returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.app_admins where user_id = auth.uid()) $$;

create or replace function public.community_reports_list() returns table (
  id uuid, created_at timestamptz, reason text, kind text, target uuid, author text, body text, species text, photo text, hidden boolean, reporters bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.community_is_admin() then raise exception 'not admin'; end if;
  return query
  select distinct on (coalesce(r.post_id, r.comment_id)) r.id, r.created_at, r.reason,
    case when r.post_id is not null then 'post' else 'comment' end,
    coalesce(r.post_id, r.comment_id),
    coalesce(p.author, c.author), coalesce(c.body, p.cond->>'q'), p.species, p.photo, coalesce(p.hidden, c.hidden),
    (select count(distinct r2.user_id) from public.community_reports r2 where r2.post_id is not distinct from r.post_id and r2.comment_id is not distinct from r.comment_id)
  from public.community_reports r
  left join public.community_posts p on p.id = r.post_id
  left join public.community_comments c on c.id = r.comment_id
  where p.id is not null or c.id is not null
  order by coalesce(r.post_id, r.comment_id), r.created_at desc;
end $$;

create or replace function public.community_hide(kind text, target uuid, hide boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.community_is_admin() then raise exception 'not admin'; end if;
  if kind = 'post' then update public.community_posts set hidden = hide where id = target;
  elsif kind = 'comment' then update public.community_comments set hidden = hide where id = target;
  else raise exception 'bad kind'; end if;
  if not hide then
    delete from public.community_reports where (kind = 'post' and post_id = target) or (kind = 'comment' and comment_id = target);
  end if;
end $$;

create or replace function public.community_report_dismiss(kind text, target uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.community_is_admin() then raise exception 'not admin'; end if;
  delete from public.community_reports where (kind = 'post' and post_id = target) or (kind = 'comment' and comment_id = target);
end $$;

revoke all on function public.community_reports_list() from public, anon;
revoke all on function public.community_hide(text, uuid, boolean) from public, anon;
revoke all on function public.community_report_dismiss(text, uuid) from public, anon;
revoke all on function public.community_is_admin() from public, anon;
grant execute on function public.community_is_admin() to authenticated;
grant execute on function public.community_reports_list() to authenticated;
grant execute on function public.community_hide(text, uuid, boolean) to authenticated;
grant execute on function public.community_report_dismiss(text, uuid) to authenticated;

-- 3) Ανάγνωση χωρίς λογαριασμό
drop policy if exists "posts read anon" on public.community_posts;
create policy "posts read anon" on public.community_posts for select to anon using (hidden = false);
drop policy if exists "comments read anon" on public.community_comments;
create policy "comments read anon" on public.community_comments for select to anon using (hidden = false);
drop policy if exists "likes read anon" on public.community_likes;
create policy "likes read anon" on public.community_likes for select to anon using (true);

-- 4) Like σε σχόλια
create table if not exists public.community_comment_likes (
  comment_id uuid not null references public.community_comments(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id));
alter table public.community_comment_likes enable row level security;
drop policy if exists "clikes read" on public.community_comment_likes;
create policy "clikes read" on public.community_comment_likes for select to anon, authenticated using (true);
drop policy if exists "clikes insert" on public.community_comment_likes;
create policy "clikes insert" on public.community_comment_likes for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "clikes delete" on public.community_comment_likes;
create policy "clikes delete" on public.community_comment_likes for delete to authenticated using (user_id = auth.uid());
revoke update on public.community_comment_likes from anon, authenticated;
revoke insert, delete on public.community_comment_likes from anon;

-- 5) Φωτογραφία προφίλ (το αρχείο στο bucket community, φάκελος του χρήστη)
create table if not exists public.community_profiles (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  avatar text check (avatar is null or char_length(avatar) <= 200),
  updated_at timestamptz not null default now());
alter table public.community_profiles enable row level security;
drop policy if exists "cprof read" on public.community_profiles;
create policy "cprof read" on public.community_profiles for select to anon, authenticated using (true);
drop policy if exists "cprof insert" on public.community_profiles;
create policy "cprof insert" on public.community_profiles for insert to authenticated with check (user_id = auth.uid() and (avatar is null or avatar like auth.uid()::text || '/%'));
drop policy if exists "cprof update" on public.community_profiles;
create policy "cprof update" on public.community_profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and (avatar is null or avatar like auth.uid()::text || '/%'));
drop policy if exists "cprof delete" on public.community_profiles;
create policy "cprof delete" on public.community_profiles for delete to authenticated using (user_id = auth.uid());
revoke insert, update, delete on public.community_profiles from anon;
