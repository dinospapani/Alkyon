-- Alkyon: σφίξιμο ασφαλείας (από τον έλεγχο του Supabase). Ασφαλές να ξανατρέξει.
-- Οι συναρτήσεις αυτές τρέχουν μόνο ως triggers· δεν χρειάζεται να καλούνται απ' έξω.
revoke execute on function public.community_rate() from public, anon, authenticated;
revoke execute on function public.community_report_check() from public, anon, authenticated;
revoke execute on function public.sea_reports_before() from public, anon, authenticated;
revoke execute on function public.port_notes_before() from public, anon, authenticated;
-- το is_admin() το χρειάζονται μόνο οι συνδεδεμένοι χρήστες (κανόνες RLS)
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
