-- Agrega actividades de limpieza sin cambiar el comportamiento de las existentes.
alter table public.actividades
  add column if not exists tipo text not null default 'Actividad'
  check (tipo in ('Actividad', 'Limpieza'));

alter table public.configuracion
  add column if not exists multa_limpieza numeric(10,2) not null default 5;

grant select on public.actividades to anon, authenticated;
grant select on public.actividad_alumnos to anon, authenticated;
grant all on public.actividades to service_role;
grant all on public.actividad_alumnos to service_role;

alter table public.actividades enable row level security;
alter table public.actividad_alumnos enable row level security;

drop policy if exists "lectura_actividades" on public.actividades;
drop policy if exists "lectura_actividad_alumnos" on public.actividad_alumnos;
create policy "lectura_actividades" on public.actividades for select using (true);
create policy "lectura_actividad_alumnos" on public.actividad_alumnos for select using (true);