-- ─── 1. extraction_cache ──────────────────────────────────────────────────────
-- Used by the extract-prompt edge function to cache results so the same URL
-- is never sent to OpenAI/Whisper twice.

create table if not exists public.extraction_cache (
  url_hash  text primary key,
  url       text not null,
  title     text,
  content   text,
  platform  text,
  transcribed boolean default false,
  created_at  timestamptz default now()
);

alter table public.extraction_cache enable row level security;
-- No user-facing policies: only the edge function (service role key) reads/writes this table.


-- ─── 2. collection_prompts ────────────────────────────────────────────────────
-- Join table that tracks which prompts a user has saved to which collection.
-- Used by the SaveToCollection component on the Discover screen.

create table if not exists public.collection_prompts (
  collection_id uuid references public.collections(id) on delete cascade,
  prompt_id     uuid references public.prompts(id) on delete cascade,
  user_id       uuid references auth.users(id) on delete cascade,
  created_at    timestamptz default now(),
  primary key (collection_id, prompt_id, user_id)
);

alter table public.collection_prompts enable row level security;

drop policy if exists "Users can view their own collection_prompts" on public.collection_prompts;
create policy "Users can view their own collection_prompts"
  on public.collection_prompts for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own collection_prompts" on public.collection_prompts;
create policy "Users can insert their own collection_prompts"
  on public.collection_prompts for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own collection_prompts" on public.collection_prompts;
create policy "Users can delete their own collection_prompts"
  on public.collection_prompts for delete
  using (auth.uid() = user_id);


-- ─── 3. profiles — add missing columns ───────────────────────────────────────

alter table public.profiles
  add column if not exists display_name text,
  add column if not exists bio          text,
  add column if not exists avatar_url   text;


-- ─── 4. prompts — add save_count ─────────────────────────────────────────────

alter table public.prompts
  add column if not exists save_count integer default 0 not null;

-- Increment save_count whenever a prompt is saved to any collection
create or replace function public.increment_prompt_save_count()
returns trigger as $$
begin
  update public.prompts
  set save_count = save_count + 1
  where id = new.prompt_id;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_collection_prompt_inserted on public.collection_prompts;
create trigger on_collection_prompt_inserted
  after insert on public.collection_prompts
  for each row execute procedure public.increment_prompt_save_count();


-- ─── 5. Auto-create profile on signup ────────────────────────────────────────
-- Without this, new users have no profile row and the username picker
-- screen's UPDATE will silently affect 0 rows, leaving the user stuck.

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, created_at)
  values (new.id, now())
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ─── 6. profiles RLS (ensure these exist) ────────────────────────────────────

alter table public.profiles enable row level security;

drop policy if exists "Profiles are publicly readable" on public.profiles;
create policy "Profiles are publicly readable"
  on public.profiles for select
  using (true);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);
