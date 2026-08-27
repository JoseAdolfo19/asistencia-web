import { describe, it, expect } from "vitest";
import {
  generarFirmaQR,
  firmaValida,
  seedPara,
  seedActual,
  qrSecret,
  QR_REFRESH_SECONDS,
  generarCodigoClase,
  codigoValido,
  generarFirmaDia,
  firmaDiaValida,
  generarCodigoDia,
  codigoDiaValido,
} from "@/lib/qr";

const SECRET = "test_secret";
const CLASE = 42;
const CURSO = "Matemáticas";
const FECHA = "2026-08-18";

describe("generarFirmaQR", () => {
  it("genera una firma de 64 hex estables para los mismos inputs", () => {
    const a = generarFirmaQR(CLASE, CURSO, FECHA, 1000, SECRET);
    const b = generarFirmaQR(CLASE, CURSO, FECHA, 1000, SECRET);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).toBe(b);
  });

  it("cambia si cambia el secreto (tokens firmados por el servidor)", () => {
    const a = generarFirmaQR(CLASE, CURSO, FECHA, 1000, SECRET);
    const b = generarFirmaQR(CLASE, CURSO, FECHA, 1000, "otro_secret");
    expect(a).not.toBe(b);
  });

  it("cambia si cambia curso, fecha o seed", () => {
    const base = generarFirmaQR(CLASE, CURSO, FECHA, 1000, SECRET);
    expect(generarFirmaQR(CLASE, "Historia", FECHA, 1000, SECRET)).not.toBe(base);
    expect(generarFirmaQR(CLASE, CURSO, "2026-08-19", 1000, SECRET)).not.toBe(base);
    expect(generarFirmaQR(CLASE, CURSO, FECHA, 1001, SECRET)).not.toBe(base);
  });
});

describe("seed / ventana de 30s", () => {
  it("calcula la semilla por ventanas de 30 segundos", () => {
    expect(seedPara(0)).toBe(0);
    expect(seedPara(29_999)).toBe(0);
    expect(seedPara(30_000)).toBe(1);
    expect(seedPara(60_000)).toBe(2);
  });
});

describe("firmaValida", () => {
  it("acepta la semilla actual", () => {
    const ms = 30_000 * 5 + 1_000;
    const token = generarFirmaQR(CLASE, CURSO, FECHA, seedActual(ms), SECRET);
    expect(firmaValida(token, CLASE, CURSO, FECHA, SECRET, ms)).toBe(true);
  });

  it("acepta la semilla anterior (tolerancia de 30s)", () => {
    const ms = 30_000 * 5 + 1_000;
    const token = generarFirmaQR(CLASE, CURSO, FECHA, seedActual(ms) - 1, SECRET);
    expect(firmaValida(token, CLASE, CURSO, FECHA, SECRET, ms)).toBe(true);
  });

  it("rechaza semillas más viejas, curso distinto o secreto distinto", () => {
    const ms = 30_000 * 5 + 1_000;
    const viejo = generarFirmaQR(CLASE, CURSO, FECHA, seedActual(ms) - 2, SECRET);
    expect(firmaValida(viejo, CLASE, CURSO, FECHA, SECRET, ms)).toBe(false);

    const otroCurso = generarFirmaQR(CLASE, "Historia", FECHA, seedActual(ms), SECRET);
    expect(firmaValida(otroCurso, CLASE, CURSO, FECHA, SECRET, ms)).toBe(false);

    const otroSecret = generarFirmaQR(CLASE, CURSO, FECHA, seedActual(ms), "x");
    expect(firmaValida(otroSecret, CLASE, CURSO, FECHA, SECRET, ms)).toBe(false);
  });

  it("rechaza tokens inválidos", () => {
    expect(firmaValida("no-es-un-token", CLASE, CURSO, FECHA, SECRET, Date.now())).toBe(false);
  });
});

describe("generarCodigoClase", () => {
  it("genera un código de 6 dígitos estable para los mismos inputs", () => {
    const a = generarCodigoClase(CLASE, CURSO, FECHA, 1000, SECRET);
    const b = generarCodigoClase(CLASE, CURSO, FECHA, 1000, SECRET);
    expect(a).toMatch(/^\d{6}$/);
    expect(a).toBe(b);
  });

  it("cambia si cambia el secreto o el seed", () => {
    const base = generarCodigoClase(CLASE, CURSO, FECHA, 1000, SECRET);
    expect(generarCodigoClase(CLASE, CURSO, FECHA, 1000, "x")).not.toBe(base);
    expect(generarCodigoClase(CLASE, CURSO, FECHA, 1001, SECRET)).not.toBe(base);
  });
});

describe("codigoValido", () => {
  it("acepta la semilla actual y la anterior, rechaza más viejas", () => {
    const ms = 30_000 * 5 + 1_000;
    const actual = generarCodigoClase(CLASE, CURSO, FECHA, seedActual(ms), SECRET);
    const anterior = generarCodigoClase(CLASE, CURSO, FECHA, seedActual(ms) - 1, SECRET);
    const viejo = generarCodigoClase(CLASE, CURSO, FECHA, seedActual(ms) - 2, SECRET);
    expect(codigoValido(actual, CLASE, CURSO, FECHA, SECRET, ms)).toBe(true);
    expect(codigoValido(anterior, CLASE, CURSO, FECHA, SECRET, ms)).toBe(true);
    expect(codigoValido(viejo, CLASE, CURSO, FECHA, SECRET, ms)).toBe(false);
  });

  it("rechaza códigos de otra clase, otro curso u otro secreto", () => {
    const ms = 30_000 * 5 + 1_000;
    const code = generarCodigoClase(CLASE, CURSO, FECHA, seedActual(ms), SECRET);
    expect(codigoValido(code, 99, CURSO, FECHA, SECRET, ms)).toBe(false);
    expect(codigoValido(code, CLASE, "Historia", FECHA, SECRET, ms)).toBe(false);
    expect(codigoValido(code, CLASE, CURSO, FECHA, "x", ms)).toBe(false);
  });

  it("rechaza formatos inválidos", () => {
    expect(codigoValido("12ab", CLASE, CURSO, FECHA, SECRET, Date.now())).toBe(false);
    expect(codigoValido("12345", CLASE, CURSO, FECHA, SECRET, Date.now())).toBe(false);
    expect(codigoValido("", CLASE, CURSO, FECHA, SECRET, Date.now())).toBe(false);
  });
});

describe("qrSecret", () => {
  it("usa QR_SECRET de entorno o un default", () => {
    // No se manipula process.env para no afectar otros tests; solo se valida el tipo.
    expect(typeof qrSecret()).toBe("string");
    expect(QR_REFRESH_SECONDS).toBe(30);
  });
});

describe("QR / código de día (estático, no rota)", () => {
  it("generarFirmaDia es estable todo el día (sin seed)", () => {
    const a = generarFirmaDia(FECHA, "asistencia", SECRET);
    const b = generarFirmaDia(FECHA, "asistencia", SECRET);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).toBe(b);
  });

  it("asistencia y tardanza generan firmas distintas", () => {
    expect(generarFirmaDia(FECHA, "asistencia", SECRET)).not.toBe(
      generarFirmaDia(FECHA, "tardanza", SECRET)
    );
  });

  it("firmaDiaValida acepta solo el tipo y fecha correctos", () => {
    const tokAsis = generarFirmaDia(FECHA, "asistencia", SECRET);
    const tokTard = generarFirmaDia(FECHA, "tardanza", SECRET);
    expect(firmaDiaValida(tokAsis, FECHA, "asistencia", SECRET)).toBe(true);
    expect(firmaDiaValida(tokAsis, FECHA, "tardanza", SECRET)).toBe(false);
    expect(firmaDiaValida(tokTard, FECHA, "tardanza", SECRET)).toBe(true);
    expect(firmaDiaValida(tokAsis, "2026-08-19", "asistencia", SECRET)).toBe(false);
    expect(firmaDiaValida(tokAsis, FECHA, "asistencia", "otro_secret")).toBe(false);
    expect(firmaDiaValida("basura", FECHA, "asistencia", SECRET)).toBe(false);
  });

  it("generarCodigoDia produce 6 dígitos estables y distintos por tipo", () => {
    const a = generarCodigoDia(FECHA, "asistencia", SECRET);
    const b = generarCodigoDia(FECHA, "asistencia", SECRET);
    expect(a).toMatch(/^\d{6}$/);
    expect(a).toBe(b);
    expect(generarCodigoDia(FECHA, "tardanza", SECRET)).not.toBe(a);
  });

  it("codigoDiaValido acepta solo el tipo correcto y rechaza inválidos", () => {
    const cod = generarCodigoDia(FECHA, "tardanza", SECRET);
    expect(codigoDiaValido(cod, FECHA, "tardanza", SECRET)).toBe(true);
    expect(codigoDiaValido(cod, FECHA, "asistencia", SECRET)).toBe(false);
    expect(codigoDiaValido(cod, FECHA, "tardanza", "x")).toBe(false);
    expect(codigoDiaValido("123456", FECHA, "tardanza", SECRET)).toBe(false);
    expect(codigoDiaValido("12ab", FECHA, "tardanza", SECRET)).toBe(false);
    expect(codigoDiaValido("", FECHA, "tardanza", SECRET)).toBe(false);
  });
});