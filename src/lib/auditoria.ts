import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession } from "@/lib/session";

export async function registrarAuditoria(
  accion: string,
  detalle: string
): Promise<void> {
  try {
    const session = await getSession();
    await supabaseAdmin.from("auditoria").insert({
      usuario_id: session?.id ?? null,
      usuario_nombre: session ? `${session.nombres} ${session.apellidos}` : null,
      rol: session?.rol ?? null,
      accion,
      detalle,
    });
  } catch {
    // El log no debe romper la acción principal
  }
}
