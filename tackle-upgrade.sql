-- Alkyon v31z74: επιτρέπει τον εξοπλισμό (kind = 'tackle') στον πίνακα records.
-- Τρέξε το μία φορά στο Supabase → SQL Editor. Είναι ασφαλές να τρέξει και ξανά.
do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.records'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%kind%'
  loop
    execute format('alter table public.records drop constraint %I', c);
  end loop;
end $$;
