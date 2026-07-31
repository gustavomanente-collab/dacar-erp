-- Guarda el % de descuento aplicado al total antes de repartir en comprobantes.
-- Correr manualmente en el SQL Editor de Supabase.

alter table comprobantes_venta
  add column if not exists descuento_pct numeric default 0;
