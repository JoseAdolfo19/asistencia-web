import UbicacionPanel from "@/components/panels/UbicacionPanel";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Marcar asistencia por ubicación | IES La Salle",
  description:
    "Marca tu asistencia con tu DNI dentro del recinto del instituto (radio de 100 m).",
};

// Página pública: no requiere iniciar sesión. La identidad se confirma con el
// DNI y la ubicación GPS dentro del instituto.
export default function MarcarUbicacionPage() {
  return <UbicacionPanel />;
}
