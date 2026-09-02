import { NextRequest, NextResponse } from "next/server";
import { ejecutarCierreClases } from "@/lib/marcar";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Ruta protegida que ejecuta el cierre automático de clases y generación de
// multas. La llama un cron server-side (GitHub Actions) cada pocos minutos para
// que las multas se creen aunque ningún docente tenga abierta la pantalla de
// escaneo. Se autentica con el header Authorization: Bearer <CRON_SECRET>.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");

  if (!secret || token !== secret) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  const res = await ejecutarCierreClases();
  return NextResponse.json(res);
}