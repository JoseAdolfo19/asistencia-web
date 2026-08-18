-- GRANTS PUBLICOS
grant usage on schema public to anon, authenticated;
grant select on public.alumnos       to anon, authenticated;
grant select on public.docentes      to anon, authenticated;
grant select on public.cursos        to anon, authenticated;
grant select on public.horario       to anon, authenticated;
grant select on public.configuracion to anon, authenticated;
grant select on public.asistencia    to anon, authenticated;
grant select on public.multas        to anon, authenticated;

grant all on public.alumnos       to service_role;
grant all on public.docentes      to service_role;
grant all on public.cursos        to service_role;
grant all on public.horario       to service_role;
grant all on public.configuracion to service_role;
grant all on public.asistencia    to service_role;
grant all on public.multas        to service_role;

-- POLICIES (drop si existen, luego create)
drop policy if exists "lectura_alumnos"       on public.alumnos;
drop policy if exists "lectura_docentes"      on public.docentes;
drop policy if exists "lectura_cursos"        on public.cursos;
drop policy if exists "lectura_horario"       on public.horario;
drop policy if exists "lectura_configuracion" on public.configuracion;
drop policy if exists "lectura_asistencia"    on public.asistencia;
drop policy if exists "lectura_multas"        on public.multas;
drop policy if exists "insert_asistencia"     on public.asistencia;

create policy "lectura_alumnos"       on public.alumnos       for select using (true);
create policy "lectura_docentes"      on public.docentes      for select using (true);
create policy "lectura_cursos"        on public.cursos        for select using (true);
create policy "lectura_horario"       on public.horario       for select using (true);
create policy "lectura_configuracion" on public.configuracion for select using (true);
create policy "lectura_asistencia"    on public.asistencia    for select using (true);
create policy "lectura_multas"        on public.multas        for select using (true);

create policy "insert_asistencia" on public.asistencia for insert with check (true);
