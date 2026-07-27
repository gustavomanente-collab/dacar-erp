-- Extiende facturas_compra: tipo (factura/nota_credito/nota_debito) vinculada
-- a una factura padre, tipo de cambio, y numero interno COMESSA de seguimiento.
-- Correr manualmente en el SQL Editor de Supabase, despues de 2026-07-27_facturas_compra.sql

alter table facturas_compra
  add column if not exists tipo text not null default 'factura',
  add column if not exists factura_relacionada_id uuid references facturas_compra(id),
  add column if not exists tc numeric,
  add column if not exists comessa text;

alter table facturas_compra drop constraint if exists facturas_compra_tipo_check;
alter table facturas_compra
  add constraint facturas_compra_tipo_check check (tipo in ('factura','nota_credito','nota_debito'));
