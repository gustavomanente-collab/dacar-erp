-- Numero interno COMESSA en la venta, para poder relacionarla con las
-- facturas de compra que tienen el mismo COMESSA (seguimiento, rentabilidad
-- real por lote de compra/venta). Correr manualmente en el SQL Editor de Supabase.

alter table cotizaciones
  add column if not exists comessa text;
