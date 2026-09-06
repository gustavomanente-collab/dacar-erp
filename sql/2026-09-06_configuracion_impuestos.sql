-- Tabla de configuración general (fila única, id=1). Arranca con la
-- alícuota de Ingresos Brutos (Santa Fe) para descontarla en Rentabilidad.
-- Se puede extender más adelante con Ganancias / Impuesto al cheque, etc.
--
-- Correr manualmente en Supabase: Database → SQL Editor → pegar y ejecutar.

create table if not exists public.configuracion (
  id int primary key default 1,
  iibb_pct numeric not null default 0,
  updated_at timestamptz not null default now(),
  constraint configuracion_singleton check (id = 1)
);

insert into public.configuracion (id, iibb_pct)
values (1, 0)
on conflict (id) do nothing;

alter table public.configuracion enable row level security;

drop policy if exists "Autenticados leen configuracion" on "public"."configuracion";
create policy "Autenticados leen configuracion"
on "public"."configuracion"
for select
to authenticated
using (true);

drop policy if exists "Gerencia edita configuracion" on "public"."configuracion";
create policy "Gerencia edita configuracion"
on "public"."configuracion"
for update
to authenticated
using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'gerencia'))
with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'gerencia'));
