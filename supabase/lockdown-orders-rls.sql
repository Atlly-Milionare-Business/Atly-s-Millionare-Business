-- CRITICAL — run this in the Supabase SQL Editor immediately.
--
-- The orders table is currently readable by anyone on the internet with
-- no authentication at all, via the public anon key already shipped in
-- this site's own client-side JS (the same key inventory.js uses). That
-- key is meant to be safe to expose — but only when paired with RLS
-- policies that actually restrict what it can do. Right now nothing
-- restricts SELECT on orders, so every customer's name, email, and
-- shipping address becomes public the moment they complete a purchase.
--
-- Nothing in this site's own code ever reads the orders table from the
-- browser — only the stripe-webhook Edge Function writes to it, using
-- the service role key, which bypasses RLS entirely. So orders can be
-- locked down to "no public access at all" with zero functional impact.
--
-- This drops any existing public-facing policies and ensures RLS is
-- enabled with no permissive policies left, so only the service role
-- (and the Supabase dashboard, as the project owner) can read it.

alter table public.orders enable row level security;

-- List existing policies first if you want to see what's there before
-- dropping them:
--   select policyname, cmd, roles, qual from pg_policies where tablename = 'orders';
--
-- Drop every existing policy on orders (safe — the webhook doesn't need
-- any policy at all, since the service role bypasses RLS):
do $$
declare
  pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'orders'
  loop
    execute format('drop policy %I on public.orders', pol.policyname);
  end loop;
end $$;
