-- Run this entire file in Supabase Dashboard > SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.vocab_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vocab_words (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.vocab_lists(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  word text not null,
  meaning text not null,
  equivalent text,
  starred boolean not null default false,
  mastered boolean not null default false,
  word_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vocab_progress (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.vocab_lists(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_index integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (user_id, list_id)
);

create index if not exists vocab_lists_user_id_idx
  on public.vocab_lists (user_id);
create index if not exists vocab_words_list_order_idx
  on public.vocab_words (list_id, word_order);
create index if not exists vocab_words_user_id_idx
  on public.vocab_words (user_id);
create index if not exists vocab_progress_user_id_idx
  on public.vocab_progress (user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_vocab_lists_updated_at on public.vocab_lists;
create trigger set_vocab_lists_updated_at
before update on public.vocab_lists
for each row execute function public.set_updated_at();

drop trigger if exists set_vocab_words_updated_at on public.vocab_words;
create trigger set_vocab_words_updated_at
before update on public.vocab_words
for each row execute function public.set_updated_at();

drop trigger if exists set_vocab_progress_updated_at on public.vocab_progress;
create trigger set_vocab_progress_updated_at
before update on public.vocab_progress
for each row execute function public.set_updated_at();

alter table public.vocab_lists enable row level security;
alter table public.vocab_words enable row level security;
alter table public.vocab_progress enable row level security;

drop policy if exists "Users can read own vocab lists" on public.vocab_lists;
create policy "Users can read own vocab lists"
on public.vocab_lists for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own vocab lists" on public.vocab_lists;
create policy "Users can insert own vocab lists"
on public.vocab_lists for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own vocab lists" on public.vocab_lists;
create policy "Users can update own vocab lists"
on public.vocab_lists for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own vocab lists" on public.vocab_lists;
create policy "Users can delete own vocab lists"
on public.vocab_lists for delete to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can read own vocab words" on public.vocab_words;
create policy "Users can read own vocab words"
on public.vocab_words for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own vocab words" on public.vocab_words;
create policy "Users can insert own vocab words"
on public.vocab_words for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.vocab_lists
    where id = list_id and user_id = (select auth.uid())
  )
);

drop policy if exists "Users can update own vocab words" on public.vocab_words;
create policy "Users can update own vocab words"
on public.vocab_words for update to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.vocab_lists
    where id = list_id and user_id = (select auth.uid())
  )
);

drop policy if exists "Users can delete own vocab words" on public.vocab_words;
create policy "Users can delete own vocab words"
on public.vocab_words for delete to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can read own vocab progress" on public.vocab_progress;
create policy "Users can read own vocab progress"
on public.vocab_progress for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own vocab progress" on public.vocab_progress;
create policy "Users can insert own vocab progress"
on public.vocab_progress for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.vocab_lists
    where id = list_id and user_id = (select auth.uid())
  )
);

drop policy if exists "Users can update own vocab progress" on public.vocab_progress;
create policy "Users can update own vocab progress"
on public.vocab_progress for update to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.vocab_lists
    where id = list_id and user_id = (select auth.uid())
  )
);

drop policy if exists "Users can delete own vocab progress" on public.vocab_progress;
create policy "Users can delete own vocab progress"
on public.vocab_progress for delete to authenticated
using ((select auth.uid()) = user_id);
