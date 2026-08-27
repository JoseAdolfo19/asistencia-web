"use server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession } from "@/lib/session";
import { estadoClase, esPrimeraClase, esAlumno, esAlumnoRegistrado, fechaHoy, diaHoy, horaAhora, normalizeName, aMinutos } from "@/lib/estado";
import { permitirRateLimit } from "@/lib/rateLimit";
import { registrarAuditoria } from "@/lib/auditoria";
import { qrSecret, firmaValida, generarFirmaQR, generarCodigoClase, codigoValido } from "@/lib/qr";
import { planificarCierre, planificarSubirFaltas, ClaseCierre, FaltaPendiente } from "@/lib/cierre";

export type MarcarResult = { ok: true; estado: string; curso: string } | { ok: false; error: string };

function puedeEscanear(rol: string): boolean {
  return rol === "Docente" || rol === "Administrador";
}

type ClaseParaToken = {
  id: number;
  curso: string;
  dia: string;
  hora_inicio: string;
  hora_fin: string;
  apertura_qr: string | null;
  cierre_lista: string | null;
};

type BaseDia = {
  montoTardanza: number;
  lista: ClaseParaToken[];
  opcionales: Set<string>;
};

// Datos estables del día (config, cursos opcionales y horario). Se cachean un minuto
// para no repetir lecturas en cada escaneo; lo mutable (clases_abiertas, asistencia)
// siempre se lee fresco.
let cacheBase: { ts: number; base: BaseDia } | null = null;
const TTL_BASE_MS = 60_000;

async function cargarBaseDia(): Promise<BaseDia> {
  if (cacheBase && Date.now() - cacheBase.ts < TTL_BASE_MS) return cacheBase.base;

  const [configRes, cursosRes, horarioRes] = await Promise.all([
    supabaseAdmin.from("configuracion").select("*").limit(1),
    supabaseAdmin.from("cursos").select("nombre").eq("asistencia_obligatoria", false),
    supabaseAdmin.from("horario").select("*"),
  ]);

  const montoTardanza = Number(configRes.data?.[0]?.multa_tardanza) || 1;
  // Cursos con asistencia_obligatoria = false: tienen QR, pero la asistencia es
  // opcional (el cierre automático no penaliza por no marcar).
  const opcionales = new Set((cursosRes.data ?? []).map((c) => normalizeName(c.nombre)));
  const hoy = diaHoy();
  const lista = ((horarioRes.data ?? []) as ClaseParaToken[]).filter(
    (h) => String(h.dia) === hoy
  );

  const base: BaseDia = { montoTardanza, lista, opcionales };
  cacheBase = { ts: Date.now(), base };
  return base;
}

// El cierre completo es costoso (genera Faltas/Tardanzas de todos los que no marcaron).
// Se ejecuta como máximo una vez por minuto; es idempotente, así que entre medias
// basta con el resultado del último cierre.
let ultimoCierreCompleto = 0;
const INTERVALO_CIERRE_MS = 60_000;

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
    .in("rol", ["Alumno", "Tesorera"]);

  if (error) return { ok: false, error: "Error buscando alumno" };

  const target = normalizeName(q);
  const candidatos = (alumnos ?? [])
    .filter((a) => esAlumnoRegistrado(a.id))
    .filter((a) => normalizeName(a.nombres + " " + a.apellidos) === target);

  if (candidatos.length === 0) return { ok: false, error: "No se encontró un alumno con ese nombre" };
  if (candidatos.length > 1) return { ok: false, error: "Hay varios alumnos con ese nombre; sé más específico" };

  const a = candidatos[0];
  return { ok: true, id: a.id, nombreCompleto: `${a.nombres} ${a.apellidos}` };
}

export type QrTokenResult = { ok: true; token: string; codigo: string } | { ok: false; error: string };

// Valida que la clase sea de hoy, no excluida y esté en ventana (activa o cerrada)
// y firma el token compartido de esa clase.
async function tokenDeClaseActiva(
  claseId: number,
  curso: string,
  fecha: string,
  seed: number
): Promise<QrTokenResult> {
  const id = Number(claseId);
  if (!id) return { ok: false, error: "Clase inválida" };

  const base = await cargarBaseDia();

  const { data: abiertas } = await supabaseAdmin
    .from("clases_abiertas")
    .select("curso,hora_abierta")
    .eq("fecha", fechaHoy());

  const h = base.lista.find((x) => x.id === id);
  if (!h) return { ok: false, error: "Clase no encontrada o no es de hoy" };

  if (normalizeName(h.curso) !== normalizeName(String(curso || ""))) {
    return { ok: false, error: "Curso no coincide con la clase activa" };
  }

  const aperturaManual = (abiertas ?? []).find(
    (a) => normalizeName(a.curso) === normalizeName(h.curso)
  )?.hora_abierta ?? null;

  const primera = esPrimeraClase(h, base.lista, diaHoy(), new Set());

  const est = estadoClase(h, aperturaManual, primera);
  if (est !== "Activa" && est !== "Cerrada") {
    return { ok: false, error: "La clase no está en ventana de marcación" };
  }

  const token = generarFirmaQR(h.id, h.curso, fechaHoy(), seed, qrSecret());
  const codigo = generarCodigoClase(h.id, h.curso, fechaHoy(), seed, qrSecret());
  return { ok: true, token, codigo };
}

// El docente muestra el QR de la clase activa para que los alumnos lo escaneen.
export async function getDocenteQrToken(
  claseId: number,
  curso: string,
  fecha: string,
  seed: number
): Promise<QrTokenResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Sesión expirada" };
  if (!puedeEscanear(session.rol)) return { ok: false, error: "Solo docentes o administradores pueden mostrar el QR" };

  // Máximo 12 tokens por minuto por docente
  if (!(await permitirRateLimit(`qrdocente:${session.id}`, 12, 60_000))) {
    return { ok: false, error: "Demasiadas solicitudes. Espera un momento." };
  }

  return tokenDeClaseActiva(claseId, curso, fecha, seed);
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

  const [faltasRes, multasRes] = await Promise.all([
    supabaseAdmin
      .from("asistencia")
      .select("id,curso,alumno")
      .eq("alumno", alumnoId)
      .eq("fecha", hoyStr)
      .eq("estado", "Falta")
      .eq("justificada", false),
    supabaseAdmin
      .from("multas")
      .select("motivo,asistencia_id")
      .eq("alumno", alumnoId)
      .eq("fecha", hoyStr),
  ]);
  const faltas = faltasRes.data;
  const multas = multasRes.data;

  const plan = planificarSubirFaltas(
    (faltas ?? []) as FaltaPendiente[],
    (multas ?? []) as { motivo: string | null; asistencia_id: number | null }[],
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
      asistencia_id: m.asistenciaId,
    });
    if (e2) errores.push(`Multa ${m.curso}: ${e2.message}`);
  }

  return { errores, subidas: plan.actualizar.length };
}

export async function cerrarClasesPendientes(): Promise<CierreResult> {
  const session = await getSession();
  if (!session) return { ok: false, cerradas: [], tardanzas: 0, faltas: 0, error: "Sesión expirada" };

  if (Date.now() - ultimoCierreCompleto < INTERVALO_CIERRE_MS) {
    return { ok: true, cerradas: [], tardanzas: 0, faltas: 0 };
  }
  ultimoCierreCompleto = Date.now();

  const hoyStr = fechaHoy();
  const ahora = horaAhora();
  const ahoraMin = aMinutos(ahora);

  // Config, cursos y horario vienen de la cache del día; lo mutable se lee fresco.
  const base = await cargarBaseDia();

  const [abiertasRes, asisRes, alumnosRes] = await Promise.all([
    supabaseAdmin.from("clases_abiertas").select("curso,hora_abierta").eq("fecha", hoyStr),
    supabaseAdmin.from("asistencia").select("id,alumno,curso,estado,justificada").eq("fecha", hoyStr),
    supabaseAdmin.from("alumnos").select("id").in("rol", ["Alumno", "Tesorera"]),
  ]);
  const abiertas = abiertasRes.data;
  const asisHoy = asisRes.data;
  const alumnos = alumnosRes.data;
  const montoTardanza = base.montoTardanza;

  const aperturaPorCurso = new Map<string, string>();
  for (const a of abiertas ?? []) aperturaPorCurso.set(normalizeName(a.curso), a.hora_abierta);

  // Registros de hoy: quiénes llegaron (Presente/Tardanza) y quiénes marcaron cada curso
  const llegaronHoy = new Set<string>();
  const marcaronCurso = new Map<string, Set<string>>();
  for (const a of asisHoy ?? []) {
    if (a.estado !== "Falta") llegaronHoy.add(a.alumno);
    const k = normalizeName(a.curso);
    if (!marcaronCurso.has(k)) marcaronCurso.set(k, new Set());
    marcaronCurso.get(k)!.add(a.alumno);
  }

  // Cierra y penaliza solo los cursos obligatorios: los opcionales (Taller)
  // tienen QR pero el cierre automático no genera Falta/Tardanza ni multas.
  const clasesHoy = (base.lista as ClaseCierre[]).filter(
    (h) => !base.opcionales.has(normalizeName(h.curso))
  );

  const alumnosIds = (alumnos ?? []).map((a) => a.id).filter(esAlumnoRegistrado);

  const clasesCerradas: string[] = [];
  let tardanzas = 0;
  let faltas = 0;
  const errores: string[] = [];

  const plan = planificarCierre(clasesHoy, alumnosIds, marcaronCurso, llegaronHoy, ahoraMin);

  // Inserta por clase en lotes (2 consultas por clase en vez de 2 por alumno).
  for (const p of plan) {
    if (p.registros.length === 0) {
      clasesCerradas.push(p.curso + " (sin pendientes)");
      continue;
    }

    const filasAsis = p.registros.map((r) => ({
      alumno: r.alumnoId,
      curso: p.curso,
      fecha: hoyStr,
      hora: ahora,
      estado: r.estado,
    }));

    const { data: insertadas, error: eAsis } = await supabaseAdmin
      .from("asistencia")
      .insert(filasAsis)
      .select("id,alumno,curso,estado");
    if (eAsis) {
      errores.push(`Asistencia ${p.curso}: ${eAsis.message}`);
      continue;
    }

    const filasMulta = (insertadas ?? [])
      .filter((r) => r.estado === "Tardanza")
      .map((r) => ({
        alumno: r.alumno,
        tipo: "Tardanza",
        motivo: "No escaneó su QR en " + p.curso,
        monto: montoTardanza,
        fecha: hoyStr,
        estado: "Pendiente",
        asistencia_id: r.id,
      }));

    if (filasMulta.length > 0) {
      const { error: eMulta } = await supabaseAdmin.from("multas").insert(filasMulta);
      if (eMulta) errores.push(`Multa ${p.curso}: ${eMulta.message}`);
    }

    tardanzas += filasMulta.length;
    faltas += filasAsis.length - filasMulta.length;
    clasesCerradas.push(p.curso);
  }

  // Quienes llegaron hoy (aunque sea a una clase posterior) no pueden quedar con Falta:
  // sus Faltas de hoy se suben a Tardanza y se les genera la multa.
  const faltasHoy = (asisHoy ?? []).filter((a) => a.estado === "Falta" && !a.justificada);
  const procesados = new Set<string>();
  for (const f of faltasHoy) {
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
  const hoyDia = diaHoy();
  const ahoraMin = aMinutos(ahora);

  // Busca la clase de hoy con ese curso para validar que aún no terminó
  const { data: horario } = await supabaseAdmin
    .from("horario")
    .select("*")
    .eq("dia", hoyDia)
    .ilike("curso", curso);
  const h = (horario ?? []).find((x) => normalizeName(x.curso) === normalizeName(curso));

  if (h) {
    const finMin = aMinutos(h.hora_fin);
    if (ahoraMin >= finMin) {
      return { ok: false, error: "La clase ya terminó hoy (" + h.hora_fin + "). No se puede abrir." };
    }
  } else {
    return { ok: false, error: "No hay una clase de " + curso + " hoy" };
  }

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

// Procesa un token o código de clase para un alumno: valida la firma/código,
// registra Presente/Tardanza, crea la multa si aplica y sube Faltas previas del día a Tardanza.
async function marcarPorToken(
  token: string,
  alumnoId: string,
  actorNombre: string,
  viaCodigo = false
): Promise<MarcarResult> {
  // Procesa cierres automáticos de clases y faltas/tardanzas pendientes antes de marcar
  await cerrarClasesPendientes();

  const t = String(token || "").trim();
  if (!t) return { ok: false, error: "Token vacío" };

  const { montoTardanza, lista } = await cargarBaseDia();

  const { data: abiertas } = await supabaseAdmin
    .from("clases_abiertas")
    .select("curso,hora_abierta")
    .eq("fecha", fechaHoy());

  const hoy = diaHoy();
  const hoyStr = fechaHoy();

  const aperturaPorCurso = new Map<string, string>();
  for (const a of abiertas ?? []) aperturaPorCurso.set(normalizeName(a.curso), a.hora_abierta);

  let encontrada: { horario: { id: number; curso: string }; estado: string } | null = null;
  for (const h of lista) {
    const aperturaManual = aperturaPorCurso.get(normalizeName(h.curso)) ?? null;
    const primera = esPrimeraClase(h, lista, hoy, new Set());
    const est = estadoClase(h, aperturaManual, primera);
    if (est !== "Activa" && est !== "Cerrada") continue;
    const valido = viaCodigo
      ? codigoValido(t, h.id, h.curso, hoyStr, qrSecret(), Date.now())
      : firmaValida(t, h.id, h.curso, hoyStr, qrSecret(), Date.now());
    if (valido) {
      encontrada = { horario: { id: h.id, curso: h.curso }, estado: est };
      break;
    }
  }
  if (!encontrada) {
    return {
      ok: false,
      error: viaCodigo
        ? "Código inválido o expirado. Pide un código nuevo."
        : "QR inválido o expirado. Pide un QR nuevo.",
    };
  }

  const { data: existentes } = await supabaseAdmin
    .from("asistencia")
    .select("id,estado,justificada")
    .eq("alumno", alumnoId)
    .eq("curso", encontrada.horario.curso)
    .eq("fecha", hoyStr);

  // Si ya había una Falta automática para esta clase pero el alumno llegó y escaneó,
  // se sube a Tardanza en vez de rechazarlo (salvo que ya esté justificada).
  const previo = (existentes ?? [])[0];
  if (previo) {
    if (previo.estado === "Falta" && !previo.justificada) {
      await supabaseAdmin.from("asistencia").update({ estado: "Tardanza" }).eq("id", previo.id);
      const { errores } = await subirFaltasSiLlego(alumnoId, hoyStr, montoTardanza);
      if (errores.length > 0) return { ok: false, error: errores[0] };
      await registrarAuditoria(
        "marcar_asistencia",
        `${actorNombre} subió Falta a Tardanza a ${alumnoId} en ${encontrada.horario.curso}`
      );
      return { ok: true, estado: "Tardanza", curso: encontrada.horario.curso };
    }
    return { ok: false, error: "Ya registraste asistencia en " + encontrada.horario.curso };
  }

  const estado = encontrada.estado === "Cerrada" ? "Tardanza" : "Presente";

  const { data: asisInsertada, error: errAsis } = await supabaseAdmin
    .from("asistencia")
    .insert({
      alumno: alumnoId,
      curso: encontrada.horario.curso,
      fecha: hoyStr,
      hora: horaAhora(),
      estado,
    })
    .select("id")
    .single();
  if (errAsis) return { ok: false, error: "No se pudo registrar: " + errAsis.message };

  if (estado === "Tardanza") {
    const { error: errMulta } = await supabaseAdmin.from("multas").insert({
      alumno: alumnoId,
      tipo: "Tardanza",
      motivo: "Llegó después del cierre de lista",
      monto: montoTardanza,
      fecha: hoyStr,
      estado: "Pendiente",
      asistencia_id: asisInsertada?.id ?? null,
    });
    if (errMulta) return { ok: false, error: "Asistencia registrada pero no se pudo crear la multa: " + errMulta.message };
  }

  // El alumno llegó hoy: cualquier Falta previa del día sube a Tardanza
  const { errores } = await subirFaltasSiLlego(alumnoId, hoyStr, montoTardanza);
  if (errores.length > 0) return { ok: false, error: errores[0] };

  await registrarAuditoria(
    "marcar_asistencia",
    `${actorNombre} marcó ${estado} a ${alumnoId} en ${encontrada.horario.curso}`
  );

  return { ok: true, estado, curso: encontrada.horario.curso };
}

export async function marcarAsistencia(token: string, alumnoId: string): Promise<MarcarResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Sesión expirada" };
  if (!puedeEscanear(session.rol)) return { ok: false, error: "Solo docentes o administradores pueden marcar asistencia" };
  if (!esAlumnoRegistrado(String(alumnoId || ""))) return { ok: false, error: "Alumno no válido para marcar asistencia" };

  // Máximo 30 marcaciones por minuto por docente (protege contra spam)
  if (!(await permitirRateLimit(`marcar:${session.id}`, 30, 60_000))) {
    return { ok: false, error: "Demasiadas marcaciones. Espera un momento." };
  }

  return marcarPorToken(token, alumnoId, session.nombres + " " + session.apellidos);
}

// El alumno escanea el QR del docente y se marca su propia asistencia (su identidad
// sale de la sesión; el token solo identifica la clase activa).
export async function marcarConQrDocente(token: string): Promise<MarcarResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Sesión expirada" };
  if (!esAlumno(session.rol)) return { ok: false, error: "Solo alumnos pueden marcar con el QR del docente" };
  if (!esAlumnoRegistrado(session.id)) return { ok: false, error: "Cuenta no habilitada para marcar asistencia" };

  // Máximo 6 marcaciones por minuto por alumno
  if (!(await permitirRateLimit(`marcar:${session.id}`, 6, 60_000))) {
    return { ok: false, error: "Demasiadas solicitudes. Espera un momento." };
  }

  return marcarPorToken(token, session.id, session.nombres + " " + session.apellidos);
}

// Segunda vía de marcación: el alumno escribe el código de clase que dicta el docente
// (6 dígitos, rota cada 30s) y confirma su nombre para registrar su asistencia.
export async function marcarConCodigo(codigo: string, nombre: string): Promise<MarcarResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Sesión expirada" };
  if (!esAlumno(session.rol)) return { ok: false, error: "Solo alumnos pueden marcar con el código de clase" };
  if (!esAlumnoRegistrado(session.id)) return { ok: false, error: "Cuenta no habilitada para marcar asistencia" };

  const c = String(codigo || "").trim();
  if (!/^\d{6}$/.test(c)) return { ok: false, error: "El código debe tener 6 dígitos" };

  // El nombre confirma la identidad y debe coincidir con la cuenta
  const nombreCompleto = session.nombres + " " + session.apellidos;
  if (normalizeName(String(nombre || "")) !== normalizeName(nombreCompleto)) {
    return { ok: false, error: "El nombre no coincide con tu cuenta" };
  }

  // Máximo 6 marcaciones por minuto por alumno
  if (!(await permitirRateLimit(`marcar:${session.id}`, 6, 60_000))) {
    return { ok: false, error: "Demasiadas solicitudes. Espera un momento." };
  }

  return marcarPorToken(c, session.id, nombreCompleto, true);
}
