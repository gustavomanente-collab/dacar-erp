-- Guarda el porcentaje de impuesto usado al generar cada comprobante
-- (no siempre es 21% -- depende del cliente/caso).
-- Correr manualmente en el SQL Editor de Supabase.

alter table comprobantes_venta
  add column if not exists pct_impuesto numeric default 21;
