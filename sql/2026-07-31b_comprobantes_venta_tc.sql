-- Guarda el tipo de cambio usado al generar cada comprobante de venta,
-- para poder mostrar neto y con IVA en pesos ademas de dolares.
-- Correr manualmente en el SQL Editor de Supabase.

alter table comprobantes_venta
  add column if not exists tc numeric;
