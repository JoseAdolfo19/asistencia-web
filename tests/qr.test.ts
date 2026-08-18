import { describe, it, expect } from "vitest";
import {
  generarFirmaQR,
  firmaValida,
  seedPara,
  seedActual,
  qrSecret,
  QR_REFRESH_SECONDS,
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

describe("qrSecret", () => {
  it("usa QR_SECRET de entorno o un default", () => {
    // No se manipula process.env para no afectar otros tests; solo se valida el tipo.
    expect(typeof qrSecret()).toBe("string");
    expect(QR_REFRESH_SECONDS).toBe(30);
  });
});