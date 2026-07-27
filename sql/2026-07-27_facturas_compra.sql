-- Modulo de Compras: facturas de compra del proveedor + vinculo con pagos_proveedor
-- Correr manualmente en el SQL Editor de Supabase.

create table if not exists facturas_compra (
  id uuid primary key default gen_random_uuid(),
  nro_factura text,
  fecha date not null,
  monto_usd numeric not null,
  concepto text,
  created_at timestamptz not null default now()
);

alter table pagos_proveedor
  add column if not exists factura_compra_id uuid references facturas_compra(id);

alter table facturas_compra enable row level security;

create policy "authenticated read facturas_compra"
  on facturas_compra for select
  to authenticated
  using (true);

create policy "authenticated write facturas_compra"
  on facturas_compra for insert
  to authenticated
  with check (true);

create policy "authenticated update facturas_compra"
  on facturas_compra for update
  to authenticated
  using (true);

create policy "authenticated delete facturas_compra"
  on facturas_compra for delete
  to authenticated
  using (true);
