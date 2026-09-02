"use server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession } from "@/lib/session";
import { estadoClase, esPrimeraClase, esAlumno, esAlumnoRegistrado, fechaHoy, diaHoy, horaAhora, normalizeName, aMinutos } from "@/lib/estado";
import { permitirRateLimit } from "@/lib/rateLimit";
import { registrarAuditoria } from "@/lib/auditoria";
import { qrSecret, firmaValida, generarFirmaQR, generarCodigoClase, codigoValido, firmaDiaValida, codigoDiaValido, generarFirmaDia, generarCodigoDia } from "@/lib/qr";
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

// ---------------------------------------------------------------------------
// Marca por día (QR/código estático, no rota cada 30 s).
//
// Dos QRs por día, válidos en ventanas horarias fijas:
//   - "asistencia": de 08:00 a 08:30  -> Presente
//   - "tardanza":   de 09:00 a 10:00  -> Tardanza
// Ambos se asocian a la primera clase obligatoria del día (la de las 8:00).
// ---------------------------------------------------------------------------
const VENTANA_ASISTENCIA = { inicio: 8 * 60, fin: 8 * 60 + 30 }; // 08:00 - 08:30
const VENTANA_TARDANZA = { inicio: 9 * 60, fin: 10 * 60 }; // 09:00 - 10:00

// Devuelve el nombre de la primera clase obligatoria del día (la de hora de
// inicio más temprana, excluyendo los cursos opcionales / asistencia no
// obligatoria). Es el curso al que se asocian las marcas de día.
function primeraClaseObligatoria(lista: ClaseParaToken[], opcionales: Set<string>): string | null {
  const obligatorias = (lista ?? []).filter((h) => !opcionales.has(normalizeName(h.curso)));
  if (obligatorias.length === 0) return null;
  obligatorias.sort((a, b) => aMinutos(a.hora_inicio) - aMinutos(b.hora_inicio));
  return obligatorias[0].curso;
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

export type QrDiaResult = {
  ok: true;
  fecha: string;
  asistencia: { token: string; codigo: string; activo: boolean; disponible: boolean };
  tardanza: { token: string; codigo: string; activo: boolean; disponible: boolean };
} | { ok: false; error: string };

// Devuelve los 2 QRs/códigos estáticos del día (asistencia y tardanza) para que
// el docente los muestre. No rotan cada 30 s. 'activo' indica si estamos dentro de
// su ventana horaria; 'disponible' si todavía no ha terminado su ventana.
export async function getDocenteQrDia(): Promise<QrDiaResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Sesión expirada" };
  if (!puedeEscanear(session.rol)) {
    return { ok: false, error: "Solo docentes o administradores pueden mostrar el QR" };
  }

  const hoyStr = fechaHoy();
  const ahoraMin = aMinutos(horaAhora());
  const secret = qrSecret();

  return {
    ok: true,
    fecha: hoyStr,
    asistencia: {
      token: generarFirmaDia(hoyStr, "asistencia", secret),
      codigo: generarCodigoDia(hoyStr, "asistencia", secret),
      activo: ahoraMin >= VENTANA_ASISTENCIA.inicio && ahoraMin < VENTANA_ASISTENCIA.fin,
      disponible: ahoraMin < VENTANA_ASISTENCIA.fin,
    },
    tardanza: {
      token: generarFirmaDia(hoyStr, "tardanza", secret),
      codigo: generarCodigoDia(hoyStr, "tardanza", secret),
      activo: ahoraMin >= VENTANA_TARDANZA.inicio && ahoraMin < VENTANA_TARDANZA.fin,
      disponible: ahoraMin < VENTANA_TARDANZA.fin,
    },
  };
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

  return ejecutarCierreClases();
}

// Ejecuta el cierre automático de clases y generación de Faltas/Tardanzas/multas
// sin depender de una sesión de navegador. La usa la ruta API /api/cron/cerrar
// (disparada por un cron server-side) para que las multas se generen aunque nadie
// tenga abierta la pantalla de escaneo.
export async function ejecutarCierreClases(): Promise<CierreResult> {
  if (Date.now() - ultimoCierreCompleto < INTERVALO_CIERRE_MS) {
    return { ok: true, cerradas: [], tardanzas: 0, faltas: 0 };
  }
  ultimoCierreCompleto = Date.now();

  const hoyStr = fechaHoy();
  const ahora = horaAhora();
  const ahoraMin = aMinutos(ahora);

  // Config, cursos y horario vienen de la cache del día; lo mutable se lee fresco.
  const base = await cargarBaseDia();

  // Modelo POR DÍA: un estado por alumno por jornada.
  //   - Presente: QR de asistencia (08:00-08:30)
  //   - Tardanza: QR de tardanza (09:00-10:00), genera 1 multa
  //   - Falta: no escaneó ningún QR del día (sin multa)
  const [asisRes, alumnosRes] = await Promise.all([
    supabaseAdmin.from("asistencia").select("alumno,estado,curso").eq("fecha", hoyStr),
    supabaseAdmin.from("alumnos").select("id").in("rol", ["Alumno", "Tesorera"]),
  ]);
  const asisHoy = asisRes.data;
  const alumnos = alumnosRes.data;

  // Clases obligatorias de hoy (los opcionales, p.ej. Taller, no se cierran).
  const clasesOblig = (base.lista as ClaseCierre[]).filter(
    (h) => !base.opcionales.has(normalizeName(h.curso))
  );
  // Primera clase obligatoria del día (referencia de la marca del día).
  const primera = primeraClaseObligatoria(base.lista, base.opcionales);
  // Fin de jornada = hora de fin de la última clase obligatoria.
  const finJornada = clasesOblig.reduce((max, c) => Math.max(max, aMinutos(c.hora_fin)), 0);

  const alumnosIds = (alumnos ?? []).map((a) => a.id).filter(esAlumnoRegistrado);

  // Quienes ya marcaron hoy (Presente o Tardanza) no deben recibir Falta.
  const marcaronHoy = new Set(
    (asisHoy ?? []).filter((a) => a.estado !== "Falta").map((a) => a.alumno)
  );

  const clasesCerradas: string[] = [];
  const tardanzas = 0;
  let faltas = 0;
  const errores: string[] = [];

  const plan = planificarCierre(primera, finJornada, alumnosIds, marcaronHoy, ahoraMin);

  if (plan.registros.length === 0) {
    if (primera) clasesCerradas.push("Jornada de hoy (sin faltas pendientes)");
    return { ok: true, cerradas: clasesCerradas, tardanzas, faltas };
  }

  const filasAsis = plan.registros.map((r) => ({
    alumno: r.alumnoId,
    curso: plan.curso,
    fecha: hoyStr,
    hora: ahora,
    estado: "Falta",
  }));

  const { error: eAsis } = await supabaseAdmin.from("asistencia").insert(filasAsis);
  if (eAsis) {
    errores.push(`Asistencia ${plan.curso}: ${eAsis.message}`);
  } else {
    faltas += filasAsis.length;
    clasesCerradas.push(plan.curso);
  }

  // NOTA: las Faltas NO generan multa. Las Tardanzas (con su multa) se crean
  // únicamente al escanear el QR de tardanza (09:00-10:00) en marcarPorDia.

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

  return marcarPorDia(token, session.id, session.nombres + " " + session.apellidos);
}

// Segunda vía de marcación: el alumno escribe el código de día (6 dígitos, estático)
// que dicta el docente y confirma su nombre para registrar su asistencia.
export async function marcarConCodigo(codigo: string, nombre: string): Promise<MarcarResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Sesión expirada" };
  if (!esAlumno(session.rol)) return { ok: false, error: "Solo alumnos pueden marcar con el código de día" };
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

  return marcarPorDia(c, session.id, session.nombres + " " + session.apellidos);
}

// Procesa la marcación por DÍA (QR/código estático):
//  - "asistencia": dentro de 08:00-08:30 -> Presente
//  - "tardanza":   dentro de 09:00-10:00 -> Tardanza
// Asociado a la primera clase obligatoria del día.
async function marcarPorDia(token: string, alumnoId: string, actorNombre: string): Promise<MarcarResult> {
  const t = String(token || "").trim();
  if (!t) return { ok: false, error: "Token vacío" };

  // Procesa cierres automáticos de clases y faltas/tardanzas pendientes antes de marcar
  await cerrarClasesPendientes();

  const hoyStr = fechaHoy();
  const ahoraMin = aMinutos(horaAhora());
  const secret = qrSecret();

  // Determina el tipo de marca según la firma/código de día
  let tipo: "asistencia" | "tardanza" | null = null;
  if (firmaDiaValida(t, hoyStr, "asistencia", secret) || codigoDiaValido(t, hoyStr, "asistencia", secret)) {
    tipo = "asistencia";
  } else if (firmaDiaValida(t, hoyStr, "tardanza", secret) || codigoDiaValido(t, hoyStr, "tardanza", secret)) {
    tipo = "tardanza";
  }
  if (!tipo) {
    return { ok: false, error: "QR o código inválido. Pide uno nuevo al docente." };
  }

  // Valida la ventana horaria de cada tipo
  const ventana = tipo === "asistencia" ? VENTANA_ASISTENCIA : VENTANA_TARDANZA;
  if (ahoraMin < ventana.inicio || ahoraMin >= ventana.fin) {
    const texto =
      tipo === "asistencia"
        ? "El QR de asistencia solo es válido de 8:00 a 8:30."
        : "El QR de tardanza solo es válido de 9:00 a 10:00.";
    return { ok: false, error: texto };
  }

  // Curso de referencia: primera clase obligatoria del día
  const base = await cargarBaseDia();
  const curso = primeraClaseObligatoria(base.lista, base.opcionales);
  if (!curso) return { ok: false, error: "No hay clases obligatorias hoy" };

  const { data: existentes } = await supabaseAdmin
    .from("asistencia")
    .select("id,estado,justificada")
    .eq("alumno", alumnoId)
    .eq("curso", curso)
    .eq("fecha", hoyStr);

  // Si ya marcó hoy en este curso, no volver a marcar
  const previo = (existentes ?? [])[0];
  if (previo) {
    if (tipo === "tardanza" && previo.estado === "Presente") {
      // Llegó a tiempo (Presente); la marca de tardanza no puede degradarlo.
      return { ok: false, error: "Ya registraste tu asistencia de hoy en " + curso };
    }
    if (previo.estado === "Falta" && !previo.justificada && tipo === "tardanza") {
      // Estaba en Falta y ahora llega tarde -> sube a Tardanza
      await supabaseAdmin.from("asistencia").update({ estado: "Tardanza" }).eq("id", previo.id);
      const { errores } = await subirFaltasSiLlego(alumnoId, hoyStr, base.montoTardanza);
      if (errores.length > 0) return { ok: false, error: errores[0] };
      await registrarAuditoria(
        "marcar_asistencia",
        `${actorNombre} subió Falta a Tardanza a ${alumnoId} en ${curso}`
      );
      return { ok: true, estado: "Tardanza", curso };
    }
    return { ok: false, error: "Ya registraste asistencia en " + curso + " hoy" };
  }

  const estado = tipo === "asistencia" ? "Presente" : "Tardanza";

  const { data: asisInsertada, error: errAsis } = await supabaseAdmin
    .from("asistencia")
    .insert({
      alumno: alumnoId,
      curso,
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
      motivo: "Llegó después de las 8:30 (QR de tardanza)",
      monto: base.montoTardanza,
      fecha: hoyStr,
      estado: "Pendiente",
      asistencia_id: asisInsertada?.id ?? null,
    });
    if (errMulta) return { ok: false, error: "Asistencia registrada pero no se pudo crear la multa: " + errMulta.message };
  }

  // El alumno llegó hoy: cualquier Falta previa del día sube a Tardanza
  const { errores } = await subirFaltasSiLlego(alumnoId, hoyStr, base.montoTardanza);
  if (errores.length > 0) return { ok: false, error: errores[0] };

  await registrarAuditoria(
    "marcar_asistencia",
    `${actorNombre} marcó ${estado} a ${alumnoId} en ${curso}`
  );

  return { ok: true, estado, curso };
}
