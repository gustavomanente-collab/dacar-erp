-- Mismo problema que en clientes: "Vendedor ve sus cotizaciones, gerencia
-- ve todas" y "Items accesibles si la cotizacion es accesible" filtraban
-- por vendedor_id = auth.uid(), pero esa columna nunca se cargó en las
-- cotizaciones existentes -> cualquier vendedor veía Historial vacío y no
-- podía editar presupuestos.
--
-- Nuevo comportamiento: cualquier usuario autenticado (vendedor,
-- administrativo, gerencia) ve y edita todas las cotizaciones y sus items.
--
-- Correr manualmente en Supabase: Database → SQL Editor → pegar y ejecutar.

drop policy if exists "Vendedor ve sus cotizaciones, gerencia ve todas" on "public"."cotizaciones";

create policy "Autenticados ven todas las cotizaciones"
on "public"."cotizaciones"
for all
to authenticated
using (true);

drop policy if exists "Items accesibles si la cotizacion es accesible" on "public"."cotizacion_items";

create policy "Autenticados ven todos los items de cotizacion"
on "public"."cotizacion_items"
for all
to authenticated
using (true);
