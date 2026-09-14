-- Run once in the Supabase SQL Editor for this project (same place you ran
-- stock-table.sql). Replaces the old "anyone can update stock" policy —
-- which let any visitor holding the public anon key (shipped in
-- inventory.js, as it must be) PATCH stock to whatever they wanted — with
-- one that requires a signed-in Supabase Auth session. Public read access
-- is unchanged; the site's own stock display never needed write access.
--
-- Pairs with the admin.html/login.html switch to real Supabase Auth
-- (see assets/auth.js) — create your admin user in the Supabase dashboard
-- under Authentication > Users before relying on this.

drop policy if exists "Public can update stock" on public.stock;

create policy "Authenticated can update stock"
  on public.stock for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
