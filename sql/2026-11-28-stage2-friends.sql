-- Alkyon · stage2 (28/11/2026): απόρρητο φίλων (B + C), ζωντανή θέση μόνο ενεργή, σταθερό search_path.
-- Αποφάσεις Dinos 28/11 18:3x–18:40. Αναίρεση: sql/2026-11-28-stage2-friends-rollback.sql
-- Τρέχει πολλές φορές χωρίς πρόβλημα (idempotent).

-- 1) B: ο φίλος ΔΕΝ διαβάζει πια απευθείας τις εγγραφές και τις φωτογραφίες σου.
--    (Ο ιδιοκτήτης συνεχίζει να βλέπει τα δικά του από τις δικές του πολιτικές· δεν αλλάζουν.)
drop policy if exists records_friends_read on public.records;
drop policy if exists photos_friends_read on storage.objects;

-- 2) B: ό,τι δείχνει η οθόνη «Τα ψάρια του», και τίποτα άλλο.
--    Ψάρια: είδος, πλήθος, κιλά, μήκος, ημερομηνία, ώρα (χωρίς θέση, όνομα τόπου, σημειώσεις, φωτογραφίες, βαθμούς, συνθήκες, εξοπλισμό).
--    Έξοδοι και σημεία: μόνο πλήθος. Ίδιοι κανόνες με πριν: μόνο αν μοιράζεται μαζί σου, όχι σβησμένα, όχι «Ιδιωτικά», όχι χαμένα ψάρια.
create or replace function public.friend_view(p_owner uuid)
returns json language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Χρειάζεται σύνδεση.'; end if;
  if p_owner is null or not exists (select 1 from public.friends f where f.owner = p_owner and f.viewer = me and f.share) then
    return json_build_object('bites', '[]'::json, 'trips', 0, 'spots', 0);
  end if;
  return json_build_object(
    'bites', coalesce((
      select json_agg(json_strip_nulls(json_build_object(
        'species', left(r.data ->> 'species', 60),
        'cnt', case when (r.data ->> 'cnt') ~ '^[0-9]{1,4}$' then (r.data ->> 'cnt')::int end,
        'kg', case when (r.data ->> 'kg') ~ '^[0-9]{1,4}([.][0-9]{1,3})?$' then (r.data ->> 'kg')::numeric end,
        'len', case when (r.data ->> 'len') ~ '^[0-9]{1,4}([.][0-9]{1,2})?$' then (r.data ->> 'len')::numeric end,
        'date', case when (r.data ->> 'date') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then r.data ->> 'date' end,
        'time', case when (r.data ->> 'time') ~ '^[0-9]{2}:[0-9]{2}$' then r.data ->> 'time' end
      )) order by r.data ->> 'date' desc, r.data ->> 'time' desc)
      from public.records r
      where r.user_id = p_owner and r.kind = 'bites' and not coalesce(r.deleted, false)
        and coalesce((r.data ->> 'priv')::boolean, false) = false
        and coalesce((r.data ->> 'miss')::boolean, false) = false), '[]'::json),
    'trips', (select count(*) from public.records r where r.user_id = p_owner and r.kind = 'trips' and not coalesce(r.deleted, false) and coalesce((r.data ->> 'priv')::boolean, false) = false),
    'spots', (select count(*) from public.records r where r.user_id = p_owner and r.kind = 'spots' and not coalesce(r.deleted, false) and coalesce((r.data ->> 'priv')::boolean, false) = false)
  );
end $$;
revoke all on function public.friend_view(uuid) from public, anon;
grant execute on function public.friend_view(uuid) to authenticated;

-- 3) C: με τον κωδικό η κοινή χρήση ανοίγει ΜΟΝΟ από τη μεριά αυτού που τον έστειλε.
--    Αυτός που τον γράφει δεν μοιράζεται μέχρι να το ανοίξει ο ίδιος (share = false). Οι υπάρχουσες φιλίες δεν αλλάζουν.
create or replace function public.redeem_friend(p_code text, p_name text)
returns json language plpgsql security definer set search_path = public as $$
declare inv public.friend_invites; me uuid := auth.uid(); nm text := left(coalesce(p_name, ''), 40);
begin
  if me is null then raise exception 'Χρειάζεται σύνδεση.'; end if;
  select * into inv from public.friend_invites where code = upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')) and expires_at > now();
  if not found then raise exception 'Ο κωδικός δεν υπάρχει ή έληξε.'; end if;
  if inv.owner = me then raise exception 'Αυτός είναι ο δικός σου κωδικός.'; end if;
  -- αυτός που έστειλε τον κωδικό → μοιράζεται με αυτόν που τον γράφει
  insert into public.friends (owner, viewer, owner_name, viewer_name, share) values (inv.owner, me, inv.name, nm, true)
    on conflict (owner, viewer) do update set owner_name = excluded.owner_name, viewer_name = excluded.viewer_name;
  -- αυτός που γράφει τον κωδικό → ΔΕΝ μοιράζεται ακόμα (αν η γραμμή υπάρχει ήδη, κρατά ό,τι είχε)
  insert into public.friends (owner, viewer, owner_name, viewer_name, share) values (me, inv.owner, nm, inv.name, false)
    on conflict (owner, viewer) do update set owner_name = excluded.owner_name, viewer_name = excluded.viewer_name;
  delete from public.friend_invites where code = inv.code;
  delete from public.friend_invites where expires_at < now();
  return json_build_object('friend', inv.owner, 'name', inv.name, 'mine', false);
end $$;
revoke all on function public.redeem_friend(text, text) from public, anon;
grant execute on function public.redeem_friend(text, text) to authenticated;

-- 4) Ζωντανή θέση: οι φίλοι τη βλέπουν μόνο όσο η έξοδος είναι ενεργή (όχι την τελευταία θέση μετά το τέλος).
drop policy if exists tl_friends on public.trip_live;
create policy tl_friends on public.trip_live for select to authenticated using (
  active and exists (select 1 from public.friends f where f.owner = trip_live.user_id and f.viewer = auth.uid() and f.share)
);

-- 5) Υγιεινή: σταθερό search_path στις 5 συναρτήσεις που δεν είχαν (όλες SECURITY INVOKER· η συμπεριφορά δεν αλλάζει).
do $$
declare r record;
begin
  for r in select p.oid::regprocedure as f from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('alkyon_jnum', 'alkyon_km', 'alkyon_sync_version', 'records_touch', 'sos_alerts_guard')
  loop
    execute format('alter function %s set search_path = public', r.f);
  end loop;
end $$;
