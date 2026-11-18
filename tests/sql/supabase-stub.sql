-- Ελάχιστο «Supabase» για τοπικό Postgres: ρόλοι, auth.uid() από ρύθμιση, storage.objects και οι βοηθητικές του.
-- Μετά: οι πίνακες όπως είναι σήμερα στην παραγωγή (18/11/2026, read-only έλεγχος), ώστε το migration να δοκιμάζεται πάνω στην πραγματική αφετηρία.
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key);
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
create schema if not exists storage;
create table if not exists storage.objects (id bigserial primary key, bucket_id text, name text);
create or replace function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
create or replace function storage.filename(name text) returns text language sql immutable as $$ select (string_to_array(name, '/'))[array_length(string_to_array(name, '/'), 1)] $$;
alter table storage.objects enable row level security;
create table public.friends (owner uuid not null, viewer uuid not null, owner_name text, viewer_name text, share boolean not null default true, created_at timestamptz not null default now(), primary key (owner, viewer));
alter table public.friends enable row level security;
create policy fr_sel on public.friends for select to authenticated using (owner = auth.uid() or viewer = auth.uid());
create table public.records (user_id uuid not null default auth.uid(), kind text not null, id text not null, data jsonb not null default '{}'::jsonb, deleted boolean not null default false, updated_at timestamptz not null default now(), primary key (user_id, kind, id));
alter table public.records enable row level security;
create policy "own rows" on public.records for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create table public.trip_live (user_id uuid primary key default auth.uid(), name text, lat double precision, lon double precision, catches int not null default 0, active boolean not null default true, at timestamptz not null default now());
alter table public.trip_live enable row level security;
create policy tl_own on public.trip_live for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create table public.safety_trips (id text primary key, user_id uuid not null default auth.uid(), due_at timestamptz not null, last_lat double precision, last_lon double precision, last_at timestamptz, status text not null default 'active', hb_at timestamptz);
alter table public.safety_trips enable row level security;
create policy "own trips" on public.safety_trips for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create table public.sos_alerts (user_id uuid primary key, id text not null, name text, lat double precision not null, lon double precision not null, status text not null default 'active', created_at timestamptz not null default now(), at timestamptz not null default now(), notified int not null default 0);
alter table public.sos_alerts enable row level security;
create policy sos_own_write on public.sos_alerts for insert to authenticated with check (user_id = auth.uid() and char_length(coalesce(name,'')) <= 60);
create policy sos_own_update on public.sos_alerts for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and char_length(coalesce(name,'')) <= 60);
create policy sos_read_active on public.sos_alerts for select to authenticated using (user_id = auth.uid() or (status = 'active' and at > now() - interval '6 hours'));
create table public.sea_reports (id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid(), lat numeric not null, lon numeric not null, state smallint not null, wind smallint, note text, created_at timestamptz not null default now());
alter table public.sea_reports enable row level security;
create policy "sea read" on public.sea_reports for select to authenticated using (user_id = auth.uid());
create policy "sea insert" on public.sea_reports for insert to authenticated with check (user_id = auth.uid());
create table public.watch_links (code text primary key, user_id uuid not null default auth.uid(), name text, lang text, created_at timestamptz not null default now());
alter table public.watch_links enable row level security;
create policy wl_own on public.watch_links for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
insert into public.watch_links (code, user_id) values ('LEGACY01', '00000000-0000-0000-0000-00000000000a');
create policy "own photos read" on storage.objects for select using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
-- η σημερινή (παλιά) πολιτική, που το migration αντικαθιστά
create policy photos_friends_read on storage.objects for select to authenticated using (bucket_id = 'photos' and exists (select 1 from public.friends f where f.owner::text = (storage.foldername(objects.name))[1] and f.viewer = auth.uid() and f.share));

grant usage on schema public, auth, storage to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all tables in schema storage to anon, authenticated, service_role;
grant all on all sequences in schema storage to anon, authenticated, service_role;
