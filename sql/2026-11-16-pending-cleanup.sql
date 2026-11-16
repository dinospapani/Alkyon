-- Alkyon · καθαρισμός πινάκων που μεγαλώνουν (pg_cron, καθημερινά 02:41 UTC)
-- ΔΕΝ έχει τρέξει: το Supabase ζητά επιβεβαίωση για εντολές διαγραφής και η επιβεβαίωση ακυρώθηκε (16/11/2026).
-- Τρέξε το από το SQL Editor του Supabase ή πες στον Claude να το ξανατρέξει όταν είσαι μπροστά για να το εγκρίνεις.
CREATE OR REPLACE FUNCTION public.alkyon_cleanup() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
begin
  delete from cron.job_run_details where end_time < now() - interval '7 days';
  delete from net._http_response where created < now() - interval '2 days';
  delete from public.notif_log where at < now() - interval '30 days';
  delete from public.app_errors where at < now() - interval '30 days' and kind is distinct from 'feedback';
  delete from public.trip_live where active = false and at < now() - interval '90 days';
  delete from public.safety_trips where status = 'done' and created_at < now() - interval '90 days';
end; $$;
REVOKE EXECUTE ON FUNCTION public.alkyon_cleanup() FROM anon, authenticated, public;
SELECT cron.schedule('alkyon-cleanup', '41 2 * * *', $$select public.alkyon_cleanup()$$);

-- Ορφανό αρχείο: 1 αρχείο στο bucket «backups», σε φάκελο με uid που δεν υπάρχει στο auth.users.
-- Το Supabase δεν επιτρέπει διαγραφή από το storage.objects με SQL· σβήνεται από το Dashboard › Storage › backups.
-- Βρες τον φάκελο με:
--   select split_part(name,'/',1) from storage.objects o where bucket_id='backups'
--     and not exists(select 1 from auth.users u where u.id::text=split_part(o.name,'/',1));
