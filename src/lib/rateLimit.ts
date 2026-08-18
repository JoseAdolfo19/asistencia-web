import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Ventana genérica de rate limiting usando la tabla rate_limits.
// Devuelve true si la clave aún puede ejecutarse, false si excedió el límite.
export async function permitirRateLimit(
  clave: string,
  maximo: number,
  ventanaMs: number
): Promise<boolean> {
  try {
    const ahora = Date.now();
    const { data: fila } = await supabaseAdmin
      .from("rate_limits")
      .select("conteo,ventana_inicio")
      .eq("clave", clave)
      .maybeSingle();

    if (!fila) {
      await supabaseAdmin.from("rate_limits").insert({
        clave,
        conteo: 1,
        ventana_inicio: new Date(ahora).toISOString(),
      });
      return true;
    }

    const inicio = new Date(fila.ventana_inicio).getTime();
    if (ahora - inicio >= ventanaMs) {
      await supabaseAdmin
        .from("rate_limits")
        .update({ conteo: 1, ventana_inicio: new Date(ahora).toISOString() })
        .eq("clave", clave);
      return true;
    }

    if (fila.conteo >= maximo) return false;

    await supabaseAdmin
      .from("rate_limits")
      .update({ conteo: fila.conteo + 1 })
      .eq("clave", clave);
    return true;
  } catch {
    // Si la tabla aún no existe, no bloqueamos la operación
    return true;
  }
}