-- Guarda como se decidio cobrar una venta al aprobarla/configurarla:
-- empresa (neto + IVA diferenciado) o consumidor final (precio final,
-- con o sin descuento por pago de contado sin factura).
-- Correr manualmente en el SQL Editor de Supabase.

alter table cotizaciones
  add column if not exists tipo_venta text default 'empresa',
  add column if not exists descuento_contado_pct numeric default 0;
