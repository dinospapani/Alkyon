-- Alkyon 1.14.83 · P0 «Εμπιστοσύνη» · ΑΝΑΙΡΕΣΗ του sql/2026-11-18-p0-trust.sql
-- Γυρίζει τη συμπεριφορά της βάσης όπως ήταν στις 18/11/2026 πριν το migration (οι ορισμοί αντιγράφηκαν από την παραγωγή, pg_policies).
-- ΔΕΝ σβήνει δεδομένα και ΔΕΝ αφαιρεί τις νέες στήλες/πίνακες (watch_links.expires_at/revoked_at/last_used_at, safety_trips.hb_key/hb_src,
-- job_state, watch_auth_fail, index records_sync): είναι αβλαβή για τις παλιές εκδόσεις και τα χρειάζονται οι νέες Edge Functions αν μείνουν.
-- Σειρά αναίρεσης: πρώτα οι Edge Functions στην προηγούμενη έκδοση (αν χρειάζεται), μετά αυτό το αρχείο. Idempotent.
begin;

-- 1) records: χωρίς ρολόι server / απόρριψη παλιότερης έκδοσης. Η εφαρμογή 1.14.83 βλέπει ότι λείπει το alkyon_sync_version
--    και γυρίζει μόνη της σε πλήρη λήψη σε σελίδες (όπως πριν, αλλά χωρίς το όριο των 10000).
drop trigger if exists records_touch on public.records;
drop function if exists public.alkyon_sync_version();

-- 2) Φωτογραφίες φίλων: όπως πριν (ΧΩΡΙΣ έλεγχο priv / deleted — αυτό ήταν το κενό ιδιωτικότητας που έκλεισε το migration)
drop policy if exists photos_friends_read on storage.objects;
create policy photos_friends_read on storage.objects for select to authenticated using (
  bucket_id = 'photos'
  and exists (select 1 from public.friends f where f.owner::text = (storage.foldername(objects.name))[1] and f.viewer = auth.uid() and f.share)
);

-- 3) Αναφορές θάλασσας: το migration δεν άλλαξε τίποτα στην παραγωγή (ίδια πολιτική και view) → καμία αναίρεση.

-- 4) SOS: όλοι οι συνδεδεμένοι βλέπουν τα ενεργά SOS των τελευταίων 6 ωρών· ο client γράφει ελεύθερα το notified (όπως πριν)
drop trigger if exists sos_alerts_guard on public.sos_alerts;
drop policy if exists sos_read_active on public.sos_alerts;
create policy sos_read_active on public.sos_alerts for select to authenticated using (
  user_id = auth.uid() or (status = 'active' and at > now() - interval '6 hours')
);

commit;
