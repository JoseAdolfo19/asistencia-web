import { describe, it, expect } from "vitest";
import { chequeosContrasena, contrasenaFuerte, validarNuevaContrasena } from "@/lib/password";

describe("chequeosContrasena", () => {
  it("detecta los 5 requisitos en una contraseña fuerte", () => {
    const c = chequeosContrasena("Contrasena123!");
    expect(c).toEqual({ largo: true, mayuscula: true, minuscula: true, numero: true, simbolo: true });
  });

  it("marca largo como false si tiene menos de 10 caracteres", () => {
    expect(chequeosContrasena("Abc12!").largo).toBe(false);
  });

  it("detecta la falta de cada tipo de carácter", () => {
    expect(chequeosContrasena("CONTRASENA123!").minuscula).toBe(false);
    expect(chequeosContrasena("contrasena123!").mayuscula).toBe(false);
    expect(chequeosContrasena("ContrasenaAAA!").numero).toBe(false);
    expect(chequeosContrasena("Contrasena123").simbolo).toBe(false);
  });
});

describe("contrasenaFuerte", () => {
  it("acepta solo contraseñas con todos los requisitos", () => {
    expect(contrasenaFuerte("Contrasena123!")).toBe(true);
    expect(contrasenaFuerte("corta12!")).toBe(false);
    expect(contrasenaFuerte("SOLOMAYUSCULAS12!")).toBe(false);
    expect(contrasenaFuerte("sin-numero")).toBe(false);
  });
});

describe("validarNuevaContrasena", () => {
  const dni = "60995974";
  const nombre = "Michelle Christel";

  it("devuelve null para una contraseña fuerte", () => {
    expect(validarNuevaContrasena("Michelle2026!", dni, nombre)).toBeNull();
  });

  it("rechaza contraseñas cortas", () => {
    expect(validarNuevaContrasena("M12!abc", dni, nombre)).toMatch(/10 caracteres/);
  });

  it("rechaza contraseñas sin número", () => {
    expect(validarNuevaContrasena("Michelle!ABC", dni, nombre)).toMatch(/número/);
  });

  it("rechaza contraseñas sin símbolo", () => {
    expect(validarNuevaContrasena("Michelle1234", dni, nombre)).toMatch(/símbolo/);
  });

  it("rechaza usar el DNI", () => {
    expect(validarNuevaContrasena("60995974", dni, nombre)).toMatch(/DNI/);
  });

  it("rechaza usar el primer nombre", () => {
    expect(validarNuevaContrasena("MICHELLE", dni, nombre)).toMatch(/nombre/);
  });
});