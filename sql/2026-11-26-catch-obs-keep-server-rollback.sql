-- Αναίρεση του sql/2026-11-26-catch-obs-keep-server.sql (επιστροφή στην προηγούμενη συμπεριφορά). Ασφαλές να ξανατρέξει.
drop trigger if exists catch_obs_keep_srv on public.catch_obs;
drop function if exists public.alk_catch_obs_keep_srv();
