export type RegistroAsistenciaDashboard = {
  fecha: string;
  curso: string;
  estado: string;
  justificada: boolean | null;
};

export type RegistroMultaDashboard = {
  estado: string;
  monto: number;
};

export type EstadoCount = { estado: string; total: number };
export type PorCurso = {
  curso: string;
  Presente: number;
  Tardanza: number;
  Falta: number;
  Justificada: number;
};
export type PorDia = {
  fecha: string;
  Presente: number;
  Tardanza: number;
  Falta: number;
  Justificada: number;
};
export type ResumenMultas = {
  pendiente: number;
  pagado: number;
  montoPendiente: number;
  montoPagado: number;
};

type ContadoresAsistencia = Omit<PorCurso, "curso">;
type EstadoAsistencia = "Presente" | "Tardanza" | "Falta";

function esEstadoAsistencia(estado: string): estado is EstadoAsistencia {
  return estado === "Presente" || estado === "Tardanza" || estado === "Falta";
}

function contadoresVacios(): ContadoresAsistencia {
  return { Presente: 0, Tardanza: 0, Falta: 0, Justificada: 0 };
}

export function resumirDashboard(
  registros: RegistroAsistenciaDashboard[],
  multas: RegistroMultaDashboard[],
  hoy: string
): {
  estadoHoy: EstadoCount[];
  porCurso: PorCurso[];
  porDia: PorDia[];
  multas: ResumenMultas;
} {
  const conteoHoy = new Map<string, number>();
  const porCurso = new Map<string, ContadoresAsistencia>();
  const porDia = new Map<string, ContadoresAsistencia>();

  for (const registro of registros) {
    const estado = registro.estado;
    if (registro.fecha === hoy && esEstadoAsistencia(estado)) {
      conteoHoy.set(estado, (conteoHoy.get(estado) ?? 0) + 1);
    }

    const curso = porCurso.get(registro.curso) ?? contadoresVacios();
    const dia = porDia.get(registro.fecha) ?? contadoresVacios();

    if (registro.justificada) {
      curso.Justificada++;
      dia.Justificada++;
    }

    if (esEstadoAsistencia(estado)) {
      if (!registro.justificada) curso[estado]++;
      dia[estado]++;
    }

    porCurso.set(registro.curso, curso);
    porDia.set(registro.fecha, dia);
  }

  let multasPendientes = 0;
  let multasPagadas = 0;
  let montoPendiente = 0;
  let montoPagado = 0;
  for (const multa of multas) {
    if (multa.estado === "Pagado") {
      multasPagadas++;
      montoPagado += Number(multa.monto ?? 0);
    } else if (multa.estado !== "Anulada") {
      multasPendientes++;
      montoPendiente += Number(multa.monto ?? 0);
    }
  }

  return {
    estadoHoy: ["Presente", "Tardanza", "Falta"]
      .map((estado) => ({ estado, total: conteoHoy.get(estado) ?? 0 }))
      .filter((conteo) => conteo.total > 0),
    porCurso: [...porCurso.entries()].map(([curso, conteos]) => ({ curso, ...conteos })),
    porDia: [...porDia.entries()]
      .sort(([fechaA], [fechaB]) => fechaA.localeCompare(fechaB))
      .slice(-7)
      .map(([fecha, conteos]) => ({ fecha: fecha.slice(5), ...conteos })),
    multas: {
      pendiente: multasPendientes,
      pagado: multasPagadas,
      montoPendiente,
      montoPagado,
    },
  };
}
