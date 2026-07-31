-- Modulo Ventas: datos fiscales opcionales del cliente + division de una venta
-- aprobada en varios comprobantes de venta (facturas internas) para pedirle
-- a administracion que facture. Correr manualmente en el SQL Editor de Supabase.

alter table clientes
  add column if not exists cuit text,
  add column if not exists razon_social text,
  add column if not exists condicion_iva text;

create table if not exists comprobantes_venta (
  id uuid primary key default gen_random_uuid(),
  cotizacion_id uuid not null references cotizaciones(id),
  numero int not null,
  monto_usd numeric not null,
  concepto text,
  created_at timestamptz not null default now()
);

alter table comprobantes_venta enable row level security;

create policy "authenticated read comprobantes_venta"
  on comprobantes_venta for select
  to authenticated
  using (true);

create policy "authenticated write comprobantes_venta"
  on comprobantes_venta for insert
  to authenticated
  with check (true);

create policy "authenticated update comprobantes_venta"
  on comprobantes_venta for update
  to authenticated
  using (true);

create policy "authenticated delete comprobantes_venta"
  on comprobantes_venta for delete
  to authenticated
  using (true);
