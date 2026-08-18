"use server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession } from "@/lib/session";
import { estadoClase, fechaHoy, diaHoy, horaAhora, normalizeName, aMinutos } from "@/lib/estado";
import { permitirRateLimit } from "@/lib/rateLimit";
import { registrarAuditoria } from "@/lib/auditoria";
import { qrSecret, firmaValida, generarFirmaQR } from "@/lib/qr";
import { planificarCierre, planificarSubirFaltas, ClaseCierre, FaltaPendiente } from "@/lib/cierre";

export type MarcarResult = { ok: true; estado: string; curso: string } | { ok: false; error: string };

function puedeEscanear(rol: string): boolean {
  return rol === "Docente" || rol === "Administrador";
}

export async function resolverAlumno(nombre: string): Promise<
  { ok: true; id: string; nombreCompleto: string } | { ok: false; error: string }
> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Sesión expirada" };
  if (!puedeEscanear(session.rol)) return { ok: false, error: "Solo docentes o administradores" };

  const q = String(nombre || "").trim();
  if (!q) return { ok: false, error: "Ingresa el nombre completo del alumno" };

  const { data: alumnos, error } = await supabaseAdmin
    .from("alumnos")
    .select("id,nombres,apellidos")
    .eq("rol", "Alumno");

  if (error) return { ok: false, error: "Error buscando alumno" };

  const target = normalizeName(q);
  const candidatos = (alumnos ?? []).filter(
    (a) => normalizeName(a.nombres + " " + a.apellidos) === target
  );

  if (candidatos.length === 0) return { ok: false, error: "No se encontró un alumno con ese nombre" };
  if (candidatos.length > 1) return { ok: false, error: "Hay varios alumnos con ese nombre; sé más específico" };

  const a = candidatos[0];
  return { ok: true, id: a.id, nombreCompleto: `${a.nombres} ${a.apellidos}` };
}

export type QrTokenResult = { ok: true; token: string } | { ok: false; error: string };

export async function getQrToken(
  claseId: number,
  curso: string,
  fecha: string,
  seed: number
): Promise<QrTokenResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Sesión expirada" };
  if (session.rol !== "Alumno") return { ok: false, error: "Solo alumnos pueden generar QR" };

  // Máximo 12 tokens por minuto por alumno (el QR se refresca cada 30s)
  if (!(await permitirRateLimit(`qr:${session.id}`, 12, 60_000))) {
    return { ok: false, error: "Demasiadas solicitudes. Espera un momento." };
  }

  const id = Number(claseId);
  if (!id) return { ok: false, error: "Clase inválida" };

  const { data: configRows } = await supabaseAdmin.from("configuracion").select("*").limit(1);
  const tolerancia = Number(configRows?.[0]?.tiempo_cierre_qr) || 5;

  const { data: cursos } = await supabaseAdmin
    .from("cursos")
    .select("nombre")
    .eq("asistencia_obligatoria", false);
  const excluidos = new Set((cursos ?? []).map((c) => normalizeName(c.nombre)));

  const { data: horario } = await supabaseAdmin.from("horario").select("*").eq("id", id).limit(1);
  const h = horario?.[0];
  if (!h) return { ok: false, error: "Clase no encontrada" };

  // Verifica que el curso coincida con la clase activa y no esté excluido
  const hoy = diaHoy();
  const hoyStr = fechaHoy();
  if (String(h.dia) !== hoy) return { ok: false, error: "La clase no es de hoy" };
  if (excluidos.has(normalizeName(h.curso))) return { ok: false, error: "Curso sin QR" };
  if (normalizeName(h.curso) !== normalizeName(String(curso || ""))) {
    return { ok: false, error: "Curso no coincide con la clase activa" };
  }

  const { data: abiertas } = await supabaseAdmin
    .from("clases_abiertas")
    .select("curso,hora_abierta")
    .eq("fecha", hoyStr);
  const aperturaManual = (abiertas ?? []).find(
    (a) => normalizeName(a.curso) === normalizeName(h.curso)
  )?.hora_abierta ?? null;

  const est = estadoClase(h, tolerancia, aperturaManual);
  if (est !== "Activa") return { ok: false, error: "La clase no está activa en este momento" };

  const token = generarFirmaQR(h.id, h.curso, hoyStr, seed, qrSecret());
  return { ok: true, token };
}

export type CierreResult = {
  ok: boolean;
  cerradas: string[];
  tardanzas: number;
  faltas: number;
  error?: string;
};

// Sube a Tardanza las Faltas de hoy de un alumno que sí llegó (p.ej. a otra clase del día),
// y le genera la multa de tardanza si aún no existe.
async function subirFaltasSiLlego(
  alumnoId: string,
  hoyStr: string,
  monto: number
): Promise<{ errores: string[]; subidas: number }> {
  const errores: string[] = [];

  const { data: faltas } = await supabaseAdmin
    .from("asistencia")
    .select("id,curso,alumno")
    .eq("alumno", alumnoId)
    .eq("fecha", hoyStr)
    .eq("estado", "Falta");

  const { data: multas } = await supabaseAdmin
    .from("multas")
    .select("motivo")
    .eq("alumno", alumnoId)
    .eq("fecha", hoyStr);

  const plan = planificarSubirFaltas(
    (faltas ?? []) as FaltaPendiente[],
    (multas ?? []) as { motivo: string | null }[],
    alumnoId,
    (curso) => "No escaneó su QR en " + curso
  );
  for (const f of plan.actualizar) {
    const { error } = await supabaseAdmin.from("asistencia").update({ estado: "Tardanza" }).eq("id", f.id);
    if (error) {
      errores.push(`Actualizar falta en ${f.curso}: ${error.message}`);
      continue;
    }
  }

  for (const m of plan.multasNuevas) {
    const { error: e2 } = await supabaseAdmin.from("multas").insert({
      alumno: m.alumno,
      tipo: "Tardanza",
      motivo: m.motivo,
      monto,
      fecha: hoyStr,
      estado: "Pendiente",
    });
    if (e2) errores.push(`Multa ${m.curso}: ${e2.message}`);
  }

  return { errores, subidas: plan.actualizar.length };
}

export async function cerrarClasesPendientes(): Promise<CierreResult> {
  const session = await getSession();
  if (!session) return { ok: false, cerradas: [], tardanzas: 0, faltas: 0, error: "Sesión expirada" };
  if (!puedeEscanear(session.rol)) return { ok: false, cerradas: [], tardanzas: 0, faltas: 0, error: "Solo docentes o administradores" };

  const hoyStr = fechaHoy();
  const hoy = diaHoy();
  const ahora = horaAhora();
  const ahoraMin = aMinutos(ahora);

  const { data: configRows } = await supabaseAdmin.from("configuracion").select("*").limit(1);
  const montoTardanza = Number(configRows?.[0]?.multa_tardanza) || 1;

  const { data: cursos } = await supabaseAdmin
    .from("cursos")
    .select("nombre")
    .eq("asistencia_obligatoria", false);
  const excluidos = new Set((cursos ?? []).map((c) => normalizeName(c.nombre)));

  const { data: horario } = await supabaseAdmin.from("horario").select("*");

  const { data: abiertas } = await supabaseAdmin
    .from("clases_abiertas")
    .select("curso,hora_abierta")
    .eq("fecha", hoyStr);
  const aperturaPorCurso = new Map<string, string>();
  for (const a of abiertas ?? []) aperturaPorCurso.set(normalizeName(a.curso), a.hora_abierta);

  // Registros de hoy: quiénes llegaron (Presente/Tardanza) y quiénes marcaron cada curso
  const { data: asisHoy } = await supabaseAdmin
    .from("asistencia")
    .select("alumno,curso,estado")
    .eq("fecha", hoyStr);
  const llegaronHoy = new Set<string>();
  const marcaronCurso = new Map<string, Set<string>>();
  for (const a of asisHoy ?? []) {
    if (a.estado !== "Falta") llegaronHoy.add(a.alumno);
    const k = normalizeName(a.curso);
    if (!marcaronCurso.has(k)) marcaronCurso.set(k, new Set());
    marcaronCurso.get(k)!.add(a.alumno);
  }

  const clasesHoy = (horario ?? []).filter(
    (h) => String(h.dia) === hoy && !excluidos.has(normalizeName(h.curso))
  ) as ClaseCierre[];

  const { data: alumnos } = await supabaseAdmin.from("alumnos").select("id").eq("rol", "Alumno");
  const alumnosIds = (alumnos ?? []).map((a) => a.id);

  const clasesCerradas: string[] = [];
  let tardanzas = 0;
  let faltas = 0;
  const errores: string[] = [];

  const plan = planificarCierre(clasesHoy, alumnosIds, marcaronCurso, llegaronHoy, ahoraMin);

  for (const p of plan) {
    let nuevos = 0;

    for (const r of p.registros) {
      const { error: eAsis } = await supabaseAdmin.from("asistencia").insert({
        alumno: r.alumnoId,
        curso: p.curso,
        fecha: hoyStr,
        hora: ahora,
        estado: r.estado,
      });
      if (eAsis) {
        errores.push(`Asistencia ${p.curso}: ${eAsis.message}`);
        continue;
      }

      if (r.estado === "Tardanza") {
        const { error: eMulta } = await supabaseAdmin.from("multas").insert({
          alumno: r.alumnoId,
          tipo: "Tardanza",
          motivo: "No escaneó su QR en " + p.curso,
          monto: montoTardanza,
          fecha: hoyStr,
          estado: "Pendiente",
        });
        if (eMulta) errores.push(`Multa ${p.curso}: ${eMulta.message}`);
        tardanzas++;
      } else {
        faltas++;
      }
      nuevos++;
    }

    clasesCerradas.push(nuevos > 0 ? p.curso : p.curso + " (sin pendientes)");
  }

  // Quienes llegaron hoy (aunque sea a una clase posterior) no pueden quedar con Falta:
  // sus Faltas de hoy se suben a Tardanza y se les genera la multa.
  const { data: faltasHoy } = await supabaseAdmin
    .from("asistencia")
    .select("id,alumno,curso")
    .eq("fecha", hoyStr)
    .eq("estado", "Falta");
  const procesados = new Set<string>();
  for (const f of faltasHoy ?? []) {
    if (!llegaronHoy.has(f.alumno)) continue;
    if (procesados.has(f.alumno)) continue;
    procesados.add(f.alumno);
    const { errores: er, subidas } = await subirFaltasSiLlego(f.alumno, hoyStr, montoTardanza);
    errores.push(...er);
    tardanzas += subidas;
    faltas = Math.max(0, faltas - subidas);
  }

  if (errores.length > 0) {
    return { ok: false, cerradas: clasesCerradas, tardanzas, faltas, error: "Algunos registros fallaron: " + errores.join(" | ") };
  }
  return { ok: true, cerradas: clasesCerradas, tardanzas, faltas };
}

export async function abrirClase(curso: string): Promise<{ ok: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Sesión expirada" };
  if (!puedeEscanear(session.rol)) return { ok: false, error: "Solo docentes o administradores" };

  const hoy = fechaHoy();
  const ahora = horaAhora();

  const { data: existente } = await supabaseAdmin
    .from("clases_abiertas")
    .select("id")
    .eq("curso", curso)
    .eq("fecha", hoy);

  if (existente && existente.length > 0) {
    return { ok: false, error: "La clase ya fue abierta hoy" };
  }

  const { error } = await supabaseAdmin.from("clases_abiertas").insert({
    curso,
    fecha: hoy,
    hora_abierta: ahora,
    docente: session.nombres + " " + session.apellidos,
  });

  if (error) return { ok: false, error: error.message };
  await registrarAuditoria("abrir_clase", `Clase de ${curso} abierta hoy a las ${ahora}`);
  return { ok: true };
}

export async function marcarAsistencia(token: string, alumnoId: string): Promise<MarcarResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Sesión expirada" };
  if (!puedeEscanear(session.rol)) return { ok: false, error: "Solo docentes o administradores pueden marcar asistencia" };

  // Máximo 30 marcaciones por minuto por docente (protege contra spam)
  if (!(await permitirRateLimit(`marcar:${session.id}`, 30, 60_000))) {
    return { ok: false, error: "Demasiadas marcaciones. Espera un momento." };
  }

  // Procesa cierres automáticos de clases y faltas/tardanzas pendientes antes de marcar
  await cerrarClasesPendientes();

  const t = String(token || "").trim();
  if (!t) return { ok: false, error: "Token vacío" };

  const { data: configRows } = await supabaseAdmin.from("configuracion").select("*").limit(1);
  const tolerancia = Number(configRows?.[0]?.tiempo_cierre_qr) || 5;
  const montoTardanza = Number(configRows?.[0]?.multa_tardanza) || 1;

  const { data: cursos } = await supabaseAdmin
    .from("cursos")
    .select("nombre")
    .eq("asistencia_obligatoria", false);
  const excluidos = new Set((cursos ?? []).map((c) => normalizeName(c.nombre)));

  const { data: horario } = await supabaseAdmin.from("horario").select("*");
  const hoy = diaHoy();
  const hoyStr = fechaHoy();

  const { data: abiertas } = await supabaseAdmin
    .from("clases_abiertas")
    .select("curso,hora_abierta")
    .eq("fecha", hoyStr);
  const aperturaPorCurso = new Map<string, string>();
  for (const a of abiertas ?? []) aperturaPorCurso.set(normalizeName(a.curso), a.hora_abierta);

  const lista = (horario ?? []).filter(
    (h) => String(h.dia) === hoy && !excluidos.has(normalizeName(h.curso))
  );

  let encontrada: { horario: { id: number; curso: string }; estado: string } | null = null;
  for (const h of lista) {
    const aperturaManual = aperturaPorCurso.get(normalizeName(h.curso)) ?? null;
    const est = estadoClase(h, tolerancia, aperturaManual);
    if (est !== "Activa" && est !== "Cerrada") continue;
    if (firmaValida(t, h.id, h.curso, hoyStr, qrSecret(), Date.now())) {
      encontrada = { horario: { id: h.id, curso: h.curso }, estado: est };
      break;
    }
  }
  if (!encontrada) return { ok: false, error: "QR inválido o expirado. Pide un QR nuevo." };

  const { data: existentes } = await supabaseAdmin
    .from("asistencia")
    .select("id,estado")
    .eq("alumno", alumnoId)
    .eq("curso", encontrada.horario.curso)
    .eq("fecha", hoyStr);

  // Si ya había una Falta automática para esta clase pero el alumno llegó y escaneó,
  // se sube a Tardanza en vez de rechazarlo.
  const previo = (existentes ?? [])[0];
  if (previo) {
    if (previo.estado === "Falta") {
      await supabaseAdmin.from("asistencia").update({ estado: "Tardanza" }).eq("id", previo.id);
      const { errores } = await subirFaltasSiLlego(alumnoId, hoyStr, montoTardanza);
      if (errores.length > 0) return { ok: false, error: errores[0] };
      await registrarAuditoria(
        "marcar_asistencia",
        `${session.nombres} ${session.apellidos} subió Falta a Tardanza a ${alumnoId} en ${encontrada.horario.curso}`
      );
      return { ok: true, estado: "Tardanza", curso: encontrada.horario.curso };
    }
    return { ok: false, error: "Ya registraste asistencia en " + encontrada.horario.curso };
  }

  const estado = encontrada.estado === "Cerrada" ? "Tardanza" : "Presente";

  const { error: errAsis } = await supabaseAdmin.from("asistencia").insert({
    alumno: alumnoId,
    curso: encontrada.horario.curso,
    fecha: hoyStr,
    hora: horaAhora(),
    estado,
  });
  if (errAsis) return { ok: false, error: "No se pudo registrar: " + errAsis.message };

  if (estado === "Tardanza") {
    const { error: errMulta } = await supabaseAdmin.from("multas").insert({
      alumno: alumnoId,
      tipo: "Tardanza",
      motivo: "Llegó después del cierre de lista",
      monto: montoTardanza,
      fecha: hoyStr,
      estado: "Pendiente",
    });
    if (errMulta) return { ok: false, error: "Asistencia registrada pero no se pudo crear la multa: " + errMulta.message };
  }

  // El alumno llegó hoy: cualquier Falta previa del día sube a Tardanza
  const { errores } = await subirFaltasSiLlego(alumnoId, hoyStr, montoTardanza);
  if (errores.length > 0) return { ok: false, error: errores[0] };

  await registrarAuditoria(
    "marcar_asistencia",
    `${session.nombres} ${session.apellidos} marcó ${estado} a ${alumnoId} en ${encontrada.horario.curso}`
  );

  return { ok: true, estado, curso: encontrada.horario.curso };
}
