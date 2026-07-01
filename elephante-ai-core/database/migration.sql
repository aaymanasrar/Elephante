create extension if not exists vector;

-- Create table optimized for FREE, low-memory local embeddings
create table if not exists wardrobe_items (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null,
  image_url text not null,
  category text,
  sub_type text,
  embedding vector(384), -- Changed from 1536 to 384 for the free model
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists wardrobe_items_hnsw_idx on wardrobe_items using hnsw (embedding vector_cosine_ops);

create or replace function match_wardrobe_items (
  query_embedding vector(384), -- Changed from 1536 to 384
  match_threshold float,
  match_count int,
  filter_user_id uuid
)
returns table (
  id uuid,
  image_url text,
  category text,
  sub_type text,
  similarity float
)
language sql stable
as $$
  select
    id,
    image_url,
    category,
    sub_type,
    1 - (wardrobe_items.embedding <=> query_embedding) as similarity
  from wardrobe_items
  where wardrobe_items.user_id = filter_user_id
    and 1 - (wardrobe_items.embedding <=> query_embedding) > match_threshold
  order by wardrobe_items.embedding <=> query_embedding asc
  limit match_count;
$$;
