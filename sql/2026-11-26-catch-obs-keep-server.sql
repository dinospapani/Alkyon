-- Alkyon 26/11/2026 · catch_obs: η εφαρμογή να μη σβήνει όσα συμπλήρωσε ο server στο cond.
-- Πρόβλημα: όταν η εφαρμογή ξαναστέλνει μια εγγραφή (upsert, resolution=merge-duplicates), το cond αντικαθίσταται ολόκληρο
-- και χάνονται ο καιρός (enr, e, d), η χλωροφύλλη (chl, chv, cht) και το θερμοκλινές (thd, thv, tht) που έγραψε ο server.
-- Λύση: trigger BEFORE UPDATE. Όταν η εγγραφή έρχεται από την εφαρμογή (το νέο cond ΔΕΝ έχει 'enr': μόνο ο server το γράφει)
-- και η στιγμή/θέση/είδος δεν άλλαξαν, ξαναμπαίνουν στο cond τα κλειδιά του server από την προηγούμενη έκδοση.
-- Αν άλλαξε ώρα, θέση, μέρα ή είδος, ΔΕΝ κρατιούνται (ο καιρός δεν ισχύει πια): ο server τα ξαναφτιάχνει.
-- Οι εγγραφές του server (έχουν 'enr') περνούν όπως είναι. Κανένα δεδομένο χρήστη δεν αλλάζει. Ασφαλές να ξανατρέξει.
-- Αναίρεση: sql/2026-11-26-catch-obs-keep-server-rollback.sql
create or replace function public.alk_catch_obs_keep_srv() returns trigger
language plpgsql set search_path = public, pg_temp as $$
declare k text; c jsonb;
begin
  if old.cond is null or not (old.cond ? 'enr') then return new; end if;          -- δεν υπάρχει τίποτα του server να κρατηθεί
  if new.cond is not null and (new.cond ? 'enr') then return new; end if;          -- γράφει ο server: όπως είναι
  if new.kind is distinct from old.kind or new.ms is distinct from old.ms or new.ms2 is distinct from old.ms2
     or new.lat is distinct from old.lat or new.lon is distinct from old.lon or new.day is distinct from old.day then
    return new;                                                                     -- άλλη στιγμή/θέση: ο server ξαναϋπολογίζει
  end if;
  c := coalesce(new.cond, '{}'::jsonb);
  foreach k in array array['enr','e','d','chl','chv','cht','thd','thv','tht'] loop
    if old.cond ? k and not (c ? k) then c := c || jsonb_build_object(k, old.cond -> k); end if;
  end loop;
  new.cond := c;
  return new;
end $$;

drop trigger if exists catch_obs_keep_srv on public.catch_obs;
create trigger catch_obs_keep_srv before update on public.catch_obs
  for each row execute function public.alk_catch_obs_keep_srv();
