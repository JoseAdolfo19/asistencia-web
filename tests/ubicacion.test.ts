import { describe, it, expect } from "vitest";
import {
  INSTITUTO,
  RADIO_ACEPTACION_M,
  distanciaHaversineMetros,
  ventanasUbicacionDia,
  ventanaUbicacionAbierta,
  textoVentanasDia,
} from "@/lib/ubicacion";

describe("distanciaHaversineMetros", () => {
  it("distancia cero al mismo punto", () => {
    expect(distanciaHaversineMetros(INSTITUTO.lat, INSTITUTO.lng, INSTITUTO.lat, INSTITUTO.lng)).toBeCloseTo(0, 5);
  });

  it("~111 m por cada 0.001° de latitud", () => {
    const d = distanciaHaversineMetros(INSTITUTO.lat, INSTITUTO.lng, INSTITUTO.lat + 0.001, INSTITUTO.lng);
    expect(d).toBeGreaterThan(100);
    expect(d).toBeLessThan(125);
  });

  it("un punto a ~50 m del instituto queda dentro del radio", () => {
    // 0.00045° de latitud ≈ 50 m
    const d = distanciaHaversineMetros(INSTITUTO.lat, INSTITUTO.lng, INSTITUTO.lat + 0.00045, INSTITUTO.lng);
    expect(d).toBeLessThan(RADIO_ACEPTACION_M);
  });

  it("un punto a ~500 m del instituto queda fuera del radio", () => {
    const d = distanciaHaversineMetros(INSTITUTO.lat, INSTITUTO.lng, INSTITUTO.lat + 0.0045, INSTITUTO.lng);
    expect(d).toBeGreaterThan(RADIO_ACEPTACION_M);
  });
});

describe("ventanasUbicacionDia", () => {
  it("días normales: presente 8:00-8:30 y tardanza 9:00-10:00", () => {
    for (const dia of ["Lunes", "Miércoles", "Jueves", "Viernes"]) {
      const vs = ventanasUbicacionDia(dia);
      expect(vs).toHaveLength(2);
      expect(vs[0].tipo).toBe("asistencia");
      expect(vs[0].inicio).toBe(480);
      expect(vs[0].fin).toBe(510);
      expect(vs[1].tipo).toBe("tardanza");
      expect(vs[1].inicio).toBe(540);
      expect(vs[1].fin).toBe(600);
    }
  });

  it("martes: solo presente de 9:30 a 9:40 (sin tardanza)", () => {
    const vs = ventanasUbicacionDia("Martes");
    expect(vs).toHaveLength(1);
    expect(vs[0].tipo).toBe("asistencia");
    expect(vs[0].inicio).toBe(570);
    expect(vs[0].fin).toBe(580);
  });

  it("fin de semana: sin ventanas", () => {
    expect(ventanasUbicacionDia("Sábado")).toHaveLength(0);
    expect(ventanasUbicacionDia("Domingo")).toHaveLength(0);
  });
});

describe("ventanaUbicacionAbierta", () => {
  it("lunes 8:15 -> asistencia", () => {
    expect(ventanaUbicacionAbierta("Lunes", 495)?.tipo).toBe("asistencia");
  });

  it("lunes 8:45 -> cerrada (entre ventanas)", () => {
    expect(ventanaUbicacionAbierta("Lunes", 525)).toBeNull();
  });

  it("lunes 9:30 -> tardanza", () => {
    expect(ventanaUbicacionAbierta("Lunes", 570)?.tipo).toBe("tardanza");
  });

  it("martes 9:35 -> asistencia (ventana especial)", () => {
    expect(ventanaUbicacionAbierta("Martes", 575)?.tipo).toBe("asistencia");
  });

  it("martes 9:00 y 9:45 -> cerrada (el martes no tiene tardanza)", () => {
    expect(ventanaUbicacionAbierta("Martes", 540)).toBeNull();
    expect(ventanaUbicacionAbierta("Martes", 585)).toBeNull();
  });
});

describe("textoVentanasDia", () => {
  it("menciona la ventana especial del martes", () => {
    expect(textoVentanasDia("Martes")).toContain("9:30 a 9:40");
    expect(textoVentanasDia("Martes")).not.toContain("Tardanza");
  });

  it("fin de semana avisa que no hay clases", () => {
    expect(textoVentanasDia("Domingo")).toContain("no hay clases");
  });
});
