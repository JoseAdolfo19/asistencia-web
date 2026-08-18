import "server-only";

import crypto from "crypto";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type SessionUser = {
  id: string;
  dni: string;
  nombres: string;
  apellidos: string;
  correo: string;
  rol: string;
  qr_autorizado: boolean;
  debe_cambiar_password: boolean;
  session_version: number;
};

const COOKIE_NAME = "lasalle_session";

export function makeToken(correo: string, ts: number, version: number): string {
  return crypto
    .createHash("sha256")
    .update(correo + "|" + ts + "|" + version + "|lasalle_session", "utf8")
    .digest("hex");
}

export async function createSession(user: SessionUser): Promise<void> {
  const ts = Date.now();
  const token = makeToken(user.correo, ts, user.session_version);
  const value = JSON.stringify({ user, ts, token });
  const store = await cookies();
  store.set(COOKIE_NAME, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
}

export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as {
      user: SessionUser;
      ts: number;
      token: string;
    };
    const version = parsed.user.session_version ?? 0;
    if (makeToken(parsed.user.correo, parsed.ts, version) !== parsed.token) return null;

    // Si el admin incrementó session_version (cerrar sesión en todos los
    // dispositivos), esta cookie queda invalidada. La consulta es indexada
    // y solo lee una columna; si la columna aún no existe, se ignora.
    const { data: alumno } = await supabaseAdmin
      .from("alumnos")
      .select("session_version")
      .eq("id", parsed.user.id)
      .maybeSingle();

    if (alumno && alumno.session_version !== version) return null;

    return parsed.user;
  } catch {
    return null;
  }
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
