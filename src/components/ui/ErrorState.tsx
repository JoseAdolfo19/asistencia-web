export default function ErrorState({
  mensaje = "No se pudo cargar la información.",
  onReintentar,
}: {
  mensaje?: string;
  onReintentar?: () => void;
}) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center text-sm text-red-700">
      <p>{mensaje}</p>
      {onReintentar && (
        <button
          onClick={onReintentar}
          className="mt-2 inline-flex items-center gap-1 rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
        >
          Reintentar
        </button>
      )}
    </div>
  );
}