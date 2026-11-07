-- Alkyon 1.9.17: αναφορές θάλασσας. Τρέξε ολόκληρο αυτό το αρχείο στο Supabase → SQL Editor → Run. Είναι ασφαλές να το ξανατρέξεις.
-- Ένας χρήστης πατά «Πώς είναι η θάλασσα εδώ» (ήρεμη / κυματάκι / ταραγμένη / επικίνδυνη). Η αναφορά φαίνεται σε όλους τους χρήστες με λογαριασμό για 6 ώρες.
-- Δεν φαίνεται ποτέ όνομα. Η θέση στρογγυλεύεται στον server στα ~1,5 km (0,015°), ώστε να μη φαίνεται πού ακριβώς ψαρεύει κάποιος.

create extension if not exists pgcrypto;

create table if not exists public.sea_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  lat numeric not null check (lat between -90 and 90),
  lon numeric not null check (lon between -180 and 180),
  state smallint not null check (state between 0 and 3),
  wind smallint check (wind is null or wind between 0 and 3),
  note text check (note is null or char_length(note) <= 80),
  created_at timestamptz not null default now()
);
create index if not exists sea_reports_created on public.sea_reports (created_at desc);

alter table public.sea_reports enable row level security;

-- όλοι με λογαριασμό βλέπουν μόνο τις αναφορές των τελευταίων 6 ωρών· ο καθένας βλέπει πάντα τις δικές του
drop policy if exists "sea read" on public.sea_reports;
create policy "sea read" on public.sea_reports for select to authenticated
  using (created_at > now() - interval '6 hours' or user_id = auth.uid());
drop policy if exists "sea insert" on public.sea_reports;
create policy "sea insert" on public.sea_reports for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "sea delete" on public.sea_reports;
create policy "sea delete" on public.sea_reports for delete to authenticated using (user_id = auth.uid());

-- το user_id δεν επιστρέφεται ποτέ στους άλλους: η εφαρμογή ζητά μόνο τις στήλες της όψης
create or replace view public.sea_reports_pub with (security_invoker = true) as
  select id, lat, lon, state, wind, note, created_at, (user_id = auth.uid()) as mine from public.sea_reports;
grant select on public.sea_reports_pub to authenticated;

-- στρογγύλεμα θέσης και όριο: έως 12 αναφορές τη μέρα ανά χρήστη, μία ανά 5 λεπτά
create or replace function public.sea_reports_before() returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.lat := round(new.lat / 0.015) * 0.015;
  new.lon := round(new.lon / 0.015) * 0.015;
  new.note := nullif(btrim(new.note), '');
  if (select count(*) from public.sea_reports where user_id = new.user_id and created_at > now() - interval '1 day') >= 12 then
    raise exception 'rate: too many sea reports today';
  end if;
  if exists (select 1 from public.sea_reports where user_id = new.user_id and created_at > now() - interval '5 minutes') then
    raise exception 'rate: wait a few minutes';
  end if;
  return new;
end $$;
drop trigger if exists sea_reports_before on public.sea_reports;
create trigger sea_reports_before before insert on public.sea_reports for each row execute function public.sea_reports_before();

-- καθάρισμα: οι αναφορές πάνω από 7 μέρες σβήνονται (αν υπάρχει pg_cron)
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'sea-reports-clean';
    perform cron.schedule('sea-reports-clean', '17 3 * * *', $c$delete from public.sea_reports where created_at < now() - interval '7 days'$c$);
  end if;
end $$;

-- 1.9.24: η συνάρτηση trigger δεν καλείται απ' έξω
revoke execute on function public.sea_reports_before() from public, anon, authenticated;
