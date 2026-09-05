-- Antes: "Vendedor ve sus clientes, gerencia ve todos" filtraba por
-- clientes.vendedor_id = auth.uid(), pero esa columna nunca se cargó en
-- los clientes existentes -> cualquier vendedor veía la lista vacía.
-- Además esa política tampoco dejaba pasar al rol administrativo.
--
-- Nuevo comportamiento: cualquier usuario autenticado (vendedor,
-- administrativo, gerencia) ve todos los clientes.
--
-- Correr manualmente en Supabase: Database → SQL Editor → pegar y ejecutar.

drop policy if exists "Vendedor ve sus clientes, gerencia ve todos" on "public"."clientes";

create policy "Autenticados ven todos los clientes"
on "public"."clientes"
for all
to authenticated
using (true);
