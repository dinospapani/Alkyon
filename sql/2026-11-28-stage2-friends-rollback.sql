-- Alkyon · αναίρεση του sql/2026-11-28-stage2-friends.sql: ξαναφέρνει ακριβώς τις πολιτικές και τις συναρτήσεις όπως ήταν στην παραγωγή
-- (ανάγνωση 28/11/2026). Οι φιλίες που έγιναν στο μεταξύ με share = false μένουν όπως είναι (ο χρήστης τις ανοίγει από την εφαρμογή).

drop function if exists public.friend_view(uuid);

drop policy if exists records_friends_read on public.records;
create policy records_friends_read on public.records for select to authenticated using (
  kind in ('bites', 'spots', 'trips')
  and not coalesce(deleted, false)
  and coalesce((data ->> 'priv')::boolean, false) = false
  and exists (select 1 from public.friends f where f.owner = records.user_id and f.viewer = auth.uid() and f.share)
);

drop policy if exists photos_friends_read on storage.objects;
create policy photos_friends_read on storage.objects for select to authenticated using (
  bucket_id = 'photos'
  and exists (select 1 from public.friends f where f.owner::text = (storage.foldername(objects.name))[1] and f.viewer = auth.uid() and f.share)
  and exists (select 1 from public.records r where r.user_id::text = (storage.foldername(objects.name))[1] and r.kind = 'bites'
              and r.id = regexp_replace(storage.filename(objects.name), '(~[0-9]+)?\.jpg$', '') and not r.deleted
              and coalesce((r.data ->> 'priv')::boolean, false) = false)
);

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

drop policy if exists tl_friends on public.trip_live;
create policy tl_friends on public.trip_live for select to authenticated using (
  exists (select 1 from public.friends f where f.owner = trip_live.user_id and f.viewer = auth.uid() and f.share)
);

do $$
declare r record;
begin
  for r in select p.oid::regprocedure as f from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('alkyon_jnum', 'alkyon_km', 'alkyon_sync_version', 'records_touch', 'sos_alerts_guard')
  loop
    execute format('alter function %s reset search_path', r.f);
  end loop;
end $$;
