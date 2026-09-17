import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

/**
 * RUTA ADMINISTRATIVA TEMPORAL
 * Esta ruta permite marcar la asistencia como 'presente' para fechas específicas.
 * Se autentica mediante un parámetro `secret` en la URL.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const providedSecret = searchParams.get("secret");

  // Usamos ADMIN_SECRET del env para seguridad
  const secret = process.env.ADMIN_SECRET;

  if (!secret || !providedSecret || providedSecret !== secret) {
    return NextResponse.json(
      { ok: false, error: "No autorizado. Se requiere un secreto válido configurado en el servidor." },
      { status: 401 }
    );
  }

  const targetDates = ["2026-09-07", "2026-09-11", "2026-09-14"];
  let totalUpdated = 0;
  const results = [];

  try {
    for (const date of targetDates) {
      const { data, error } = await supabaseAdmin
        .from("asistencia")
        .update({ estado: "presente" })
        .eq("fecha", date)
        .select();

      if (error) {
        results.push({ date, status: "error", error: error.message });
      } else {
        const count = data ? data.length : 0;
        totalUpdated += count;
        results.push({ date, status: "success", updated: count });
      }
    }

    return NextResponse.json({
      ok: true,
      message: `Se actualizaron ${totalUpdated} registros en total.`,
      details: results,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: `Error interno: ${err.message}` },
      { status: 500 }
    );
  }
}
