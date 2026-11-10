-- Alkyon 1.12.6 · διαγραφή λογαριασμού: και οι αναφορές σφαλμάτων του χρήστη (app_errors δεν έχει foreign key προς auth.users).
-- Τα υπόλοιπα (records, safety_*, push_subs, notif_log, friends, trip_live, watch_links, sea_reports, port_notes, community_*) σβήνονται με ON DELETE CASCADE.
-- Τα αρχεία στο Storage (photos, backups, community) τα σβήνει η εφαρμογή πριν καλέσει τη συνάρτηση (profile-view.js › wipe).
create or replace function public.delete_my_account(dry boolean default false)
returns boolean language plpgsql security definer set search_path to 'public', 'auth' as $function$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if dry then return true; end if;
  delete from public.app_errors where user_id = auth.uid();
  delete from auth.users where id = auth.uid();
  return true;
end;
$function$;
