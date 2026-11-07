-- Alkyon: κοινότητα. Τρέξε ολόκληρο αυτό το αρχείο στο Supabase → SQL Editor → Run. Είναι ασφαλές να το ξανατρέξεις.
-- Δεν αποθηκεύεται ποτέ θέση: ούτε συντεταγμένες ούτε όνομα σημείου.

create extension if not exists pgcrypto;

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  src text,
  author text not null default 'Ψαράς' check (char_length(author) <= 40),
  species text not null check (char_length(species) between 1 and 60),
  latin text check (latin is null or char_length(latin) <= 80),
  kg numeric check (kg is null or (kg >= 0 and kg <= 2000)),
  len numeric check (len is null or (len >= 0 and len <= 1000)),
  bait text check (bait is null or char_length(bait) <= 60),
  tech text check (tech is null or char_length(tech) <= 40),
  day date,
  cond jsonb not null default '{}'::jsonb,
  photo text check (photo is null or char_length(photo) <= 200),
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, src)
);
create index if not exists community_posts_created on public.community_posts (created_at desc);

create table if not exists public.community_likes (
  post_id uuid not null references public.community_posts on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  author text not null default 'Ψαράς' check (char_length(author) <= 40),
  body text not null check (char_length(body) between 1 and 300),
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists community_comments_post on public.community_comments (post_id, created_at);

create table if not exists public.community_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  post_id uuid references public.community_posts on delete cascade,
  comment_id uuid references public.community_comments on delete cascade,
  reason text check (reason is null or char_length(reason) <= 200),
  created_at timestamptz not null default now(),
  check (post_id is not null or comment_id is not null)
);

alter table public.community_posts enable row level security;
alter table public.community_likes enable row level security;
alter table public.community_comments enable row level security;
alter table public.community_reports enable row level security;

drop policy if exists "posts read" on public.community_posts;
create policy "posts read" on public.community_posts for select to authenticated using (hidden = false or user_id = auth.uid());
drop policy if exists "posts insert" on public.community_posts;
create policy "posts insert" on public.community_posts for insert to authenticated with check (user_id = auth.uid() and hidden = false);
drop policy if exists "posts delete" on public.community_posts;
create policy "posts delete" on public.community_posts for delete to authenticated using (user_id = auth.uid());

drop policy if exists "likes read" on public.community_likes;
create policy "likes read" on public.community_likes for select to authenticated using (true);
drop policy if exists "likes insert" on public.community_likes;
create policy "likes insert" on public.community_likes for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "likes delete" on public.community_likes;
create policy "likes delete" on public.community_likes for delete to authenticated using (user_id = auth.uid());

drop policy if exists "comments read" on public.community_comments;
create policy "comments read" on public.community_comments for select to authenticated using (hidden = false or user_id = auth.uid());
drop policy if exists "comments insert" on public.community_comments;
create policy "comments insert" on public.community_comments for insert to authenticated with check (user_id = auth.uid() and hidden = false);
drop policy if exists "comments delete" on public.community_comments;
create policy "comments delete" on public.community_comments for delete to authenticated using (user_id = auth.uid());

drop policy if exists "reports insert" on public.community_reports;
create policy "reports insert" on public.community_reports for insert to authenticated with check (user_id = auth.uid());

-- Όρια χρήσης: 30 αναρτήσεις και 100 σχόλια ανά 24 ώρες ανά χρήστη
create or replace function public.community_rate() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'community_posts' and (select count(*) from public.community_posts where user_id = new.user_id and created_at > now() - interval '1 day') >= 30 then
    raise exception 'rate limit';
  end if;
  if tg_table_name = 'community_comments' and (select count(*) from public.community_comments where user_id = new.user_id and created_at > now() - interval '1 day') >= 100 then
    raise exception 'rate limit';
  end if;
  return new;
end $$;
drop trigger if exists community_posts_rate on public.community_posts;
create trigger community_posts_rate before insert on public.community_posts for each row execute function public.community_rate();
drop trigger if exists community_comments_rate on public.community_comments;
create trigger community_comments_rate before insert on public.community_comments for each row execute function public.community_rate();

-- Αυτόματη απόκρυψη: όταν 3 διαφορετικοί χρήστες αναφέρουν ανάρτηση ή σχόλιο
create or replace function public.community_report_check() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.post_id is not null and (select count(distinct user_id) from public.community_reports where post_id = new.post_id) >= 3 then
    update public.community_posts set hidden = true where id = new.post_id;
  end if;
  if new.comment_id is not null and (select count(distinct user_id) from public.community_reports where comment_id = new.comment_id) >= 3 then
    update public.community_comments set hidden = true where id = new.comment_id;
  end if;
  return new;
end $$;
drop trigger if exists community_report_trg on public.community_reports;
create trigger community_report_trg after insert on public.community_reports for each row execute function public.community_report_check();

-- Φωτογραφίες: δημόσιο bucket, μόνο JPEG έως 2 MB, κάθε χρήστης γράφει μόνο στον δικό του φάκελο
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('community', 'community', true, 2000000, array['image/jpeg'])
on conflict (id) do update set public = true, file_size_limit = 2000000, allowed_mime_types = array['image/jpeg'];

drop policy if exists "community upload own" on storage.objects;
create policy "community upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'community' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "community update own" on storage.objects;
create policy "community update own" on storage.objects for update to authenticated
  using (bucket_id = 'community' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "community delete own" on storage.objects;
create policy "community delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'community' and (storage.foldername(name))[1] = auth.uid()::text);

-- 1.9.24: οι συναρτήσεις trigger δεν καλούνται απ' έξω
revoke execute on function public.community_rate() from public, anon, authenticated;
revoke execute on function public.community_report_check() from public, anon, authenticated;
