-- Alkyon 1.14.21 · «Βοήθησε να γίνει πιο σωστή η πρόγνωση»: ανώνυμα στοιχεία τσιμπημάτων από όσους συμφωνούν.
-- Τρέχει μία φορά στο Supabase. Ασφαλές να ξανατρέξει.
-- catch_obs: κάθε χρήστης βλέπει/γράφει/σβήνει ΜΟΝΟ τα δικά του. Κανείς άλλος δεν τα διαβάζει (μόνο ο server με το service key).
-- Θέση στρογγυλεμένη στο 0,1° (~10 km), χωρίς όνομα, χωρίς σημειώσεις, χωρίς φωτογραφίες.
create table if not exists public.catch_obs (
  id bigserial primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  ref text not null check (char_length(ref) <= 80),            -- τυχαίο id της εγγραφής στο κινητό (για ενημέρωση/διαγραφή)
  kind text not null check (kind in ('catch','miss','trip')),
  sp text check (sp is null or char_length(sp) <= 80),          -- λατινικό όνομα (πεζά) ή όνομα είδους
  day date not null,
  ms bigint,                                                    -- ώρα (ms UTC): ψάρι = πότε πιάστηκε, έξοδος = αρχή
  ms2 bigint,                                                   -- έξοδος: τέλος
  lat numeric(5,1) check (lat is null or lat between -90 and 90),
  lon numeric(5,1) check (lon is null or lon between -180 and 180),
  cnt smallint check (cnt is null or cnt between 0 and 999),
  tech text check (tech is null or char_length(tech) <= 40),
  prof text check (prof is null or char_length(prof) <= 20),
  cond jsonb,                                                   -- άνεμος, κύμα, πίεση, τάση πίεσης, νέφωση, θερμοκρασία, νερό, παλίρροια
  updated_at timestamptz not null default now(),
  unique (user_id, ref)
);
create index if not exists catch_obs_day_idx on public.catch_obs (day);
alter table public.catch_obs enable row level security;
drop policy if exists co_sel on public.catch_obs;
create policy co_sel on public.catch_obs for select using (user_id = auth.uid());
drop policy if exists co_ins on public.catch_obs;
create policy co_ins on public.catch_obs for insert with check (user_id = auth.uid());
drop policy if exists co_upd on public.catch_obs;
create policy co_upd on public.catch_obs for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists co_del on public.catch_obs;
create policy co_del on public.catch_obs for delete using (user_id = auth.uid());

-- bite_stats: τα συγκεντρωτικά (χωρίς κανένα στοιχείο χρήστη), τα γράφει ο server κάθε βράδυ· τα διαβάζουν όλοι.
create table if not exists public.bite_stats (
  key text primary key,          -- 'all' ή 'sp:<λατινικό>'
  n int not null default 0,      -- πόσα ψάρια
  users int not null default 0,  -- από πόσους ψαράδες (φαίνεται μόνο όταν ≥ 3)
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.bite_stats enable row level security;
drop policy if exists bs_sel on public.bite_stats;
create policy bs_sel on public.bite_stats for select using (true);
grant select on public.bite_stats to anon, authenticated;
grant select, insert, update, delete on public.catch_obs to authenticated;
grant usage, select on sequence public.catch_obs_id_seq to authenticated;

-- 1.14.23: προσωπικά ευρήματα «Για σένα» (μόνο ο ίδιος τα διαβάζει· τα γράφει ο server)
create table if not exists public.user_bite_stats (
  user_id uuid primary key references auth.users(id) on delete cascade,
  n int not null default 0,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.user_bite_stats enable row level security;
drop policy if exists ubs_sel on public.user_bite_stats;
create policy ubs_sel on public.user_bite_stats for select using (user_id = auth.uid());
grant select on public.user_bite_stats to authenticated;
