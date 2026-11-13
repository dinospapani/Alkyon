-- Alkyon 1.14.0 · SOS σε κοντινά σκάφη
-- Ένα ενεργό SOS ανά χρήστη. Το βλέπουν οι συνδεδεμένοι χρήστες μόνο όσο είναι ενεργό (και έως 6 ώρες).
-- Τις ειδοποιήσεις push τις στέλνει η Edge Function sos-alert (sos-alert-index.ts) με το service key.
create table if not exists public.sos_alerts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  id text not null,
  name text,
  lat double precision not null,
  lon double precision not null,
  status text not null default 'active' check (status in ('active','ok')),
  created_at timestamptz not null default now(),
  at timestamptz not null default now(),
  notified int not null default 0
);
alter table public.sos_alerts enable row level security;
drop policy if exists sos_own_write on public.sos_alerts;
create policy sos_own_write on public.sos_alerts for insert to authenticated
  with check (user_id = auth.uid() and char_length(coalesce(name,'')) <= 60);
drop policy if exists sos_own_update on public.sos_alerts;
create policy sos_own_update on public.sos_alerts for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and char_length(coalesce(name,'')) <= 60);
drop policy if exists sos_read_active on public.sos_alerts;
create policy sos_read_active on public.sos_alerts for select to authenticated
  using (user_id = auth.uid() or (status = 'active' and at > now() - interval '6 hours'));
