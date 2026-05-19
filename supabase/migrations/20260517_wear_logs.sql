create table if not exists wear_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  outfit_id text not null,
  worn_at timestamptz not null default now()
);

alter table wear_logs enable row level security;

create policy "Users can manage their own wear logs"
  on wear_logs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index wear_logs_user_outfit_idx on wear_logs (user_id, outfit_id);
