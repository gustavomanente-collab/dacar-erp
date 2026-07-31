-- Guarda si el descuento se aplico sobre el neto (empresas, factura real)
-- o sobre el precio final con impuesto (consumidor final, pago en
-- efectivo sin factura). Correr manualmente en el SQL Editor de Supabase.

alter table comprobantes_venta
  add column if not exists base_descuento text default 'neto';
