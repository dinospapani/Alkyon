-- Alkyon: οι φίλοι βλέπουν και τις εξόδους σου (διαδρομή, διάρκεια, ψάρια). Τρέξε το στο Supabase → SQL Editor → Run.
-- Χωρίς αυτό, οι φίλοι βλέπουν μόνο ψάρια και σημεία. Για να το αναιρέσεις, ξανατρέξε το friends.sql.
drop policy if exists records_friends_read on public.records;
create policy records_friends_read on public.records for select to authenticated using (
  kind in ('bites', 'spots', 'trips')
  and not coalesce(deleted, false)
  and coalesce((data ->> 'priv')::boolean, false) = false
  and exists (select 1 from public.friends f where f.owner = records.user_id and f.viewer = auth.uid() and f.share)
);
