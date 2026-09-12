-- Run once in the Supabase SQL Editor for this project (same place you
-- ran stock-table.sql). Lets stripe-webhook decrement stock atomically
-- when an order is paid, without a read-then-write race between two
-- near-simultaneous orders for the same product.

create or replace function public.decrement_stock(p_product_id integer, p_qty integer)
returns void
language sql
security definer
set search_path = public
as $$
  update public.stock
  set quantity = greatest(quantity - p_qty, 0),
      updated_at = now()
  where product_id = p_product_id;
$$;
