alter table public.recipes
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table public.recipes
  add column if not exists notes text default '';

update public.recipes
set notes = ''
where notes is null;

create index if not exists recipes_user_id_idx on public.recipes(user_id);

alter table public.recipes enable row level security;

drop policy if exists "Users can read own recipes" on public.recipes;
drop policy if exists "Users can insert own recipes" on public.recipes;
drop policy if exists "Users can update own recipes" on public.recipes;
drop policy if exists "Users can delete own recipes" on public.recipes;

create policy "Users can read own recipes"
on public.recipes
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own recipes"
on public.recipes
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own recipes"
on public.recipes
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own recipes"
on public.recipes
for delete
to authenticated
using (auth.uid() = user_id);
