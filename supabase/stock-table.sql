-- Stock table backing assets/inventory.js. Run once in the Supabase
-- SQL Editor for this project. Public read/write via RLS — matches the
-- login page's role as a UI convenience gate, not real authentication.

create table if not exists public.stock (
  product_id integer primary key,
  quantity integer not null default 0,
  updated_at timestamptz not null default now()
);

insert into public.stock (product_id, quantity) values
  (1, 10),
  (2, 10),
  (3, 10)
on conflict (product_id) do nothing;

alter table public.stock enable row level security;

create policy "Public can read stock"
  on public.stock for select
  using (true);

create policy "Public can update stock"
  on public.stock for update
  using (true)
  with check (true);
