-- ===================================================================
-- CORRECCION: cursos.docente_id -> docentes  FK
-- La hoja Docentes estaba vacia. Creamos los docentes referenciados
-- (ids 1,2,3,5,6) como filas placeholder para satisfacer la FK.
-- ===================================================================

insert into public.docentes (id, nombre, correo, telefono, estado) values
  (1, 'Docente 1', NULL, NULL, 'Activo'),
  (2, 'Docente 2', NULL, NULL, 'Activo'),
  (3, 'Docente 3', NULL, NULL, 'Activo'),
  (5, 'Docente 5', NULL, NULL, 'Activo'),
  (6, 'Docente 6', NULL, NULL, 'Activo')
on conflict (id) do nothing;

-- Verificacion
select c.id, c.nombre, c.docente_id, d.nombre as docente
from public.cursos c
left join public.docentes d on d.id = c.docente_id
order by c.id;
