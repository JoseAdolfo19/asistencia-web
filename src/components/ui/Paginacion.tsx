"use client";

import { useEffect, useState } from "react";

type PaginacionProps<T> = {
  items: T[];
  pageSize?: number;
  children: (paginated: T[]) => React.ReactNode;
};

// Paginación client-side reutilizable: muestra solo `pageSize` (15 por defecto)
// elementos por página. Recibe el array completo ya cargado y `children` recibe
// la porción de la página actual, de modo que cada panel la use para renderizar
// su tabla/cards sin sobrecargar el DOM.
export default function Paginacion<T>({ items, pageSize = 15, children }: PaginacionProps<T>) {
  const [page, setPage] = useState(1);
  const totalPaginas = Math.max(1, Math.ceil(items.length / pageSize));

  useEffect(() => {
    setPage(1);
  }, [items.length]);

  useEffect(() => {
    if (page > totalPaginas) setPage(totalPaginas);
  }, [totalPaginas, page]);

  const inicio = (page - 1) * pageSize;
  const paginated = items.slice(inicio, inicio + pageSize);

  return (
    <div>
      {children(paginated)}
      {totalPaginas > 1 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
          <span>
            Mostrando {inicio + 1}-{Math.min(inicio + pageSize, items.length)} de {items.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ← Anterior
            </button>
            <span className="px-2">
              Página {page} de {totalPaginas}
            </span>
            <button
              type="button"
              disabled={page === totalPaginas}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Siguiente →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}