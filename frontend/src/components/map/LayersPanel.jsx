// Panel de control del mapa (overlay). Va FUERA de <MapBase>, como hermano,
// dentro de un contenedor 'relative'. Controla visibilidad de capas y filtros
// por estado, y muestra leyenda de colores. Mobile-first: colapsable.
import { useState } from 'react';
import { useMapData } from './MapDataContext';
import { PERSONA_ESTADOS, ATRAPADO_ESTADOS, EDIFICIO_ESTADOS } from './mapColors';

const ESTADOS_POR_CAPA = {
  personas: PERSONA_ESTADOS,
  atrapados: ATRAPADO_ESTADOS,
  edificios: EDIFICIO_ESTADOS,
};

const TITULOS = {
  personas: 'Personas',
  atrapados: 'Atrapados',
  edificios: 'Edificios',
};

function CapaControl({ capa }) {
  const { visibility, filters, counts, toggleLayer, setFilter } = useMapData();
  const estados = ESTADOS_POR_CAPA[capa];
  const activa = visibility[capa];

  return (
    <div className="border-t border-gray-100 pt-2 first:border-t-0 first:pt-0">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={activa}
            onChange={() => toggleLayer(capa)}
            className="h-4 w-4 accent-red-600"
          />
          <span className="text-sm font-semibold text-gray-800">{TITULOS[capa]}</span>
        </label>
        <span className="text-xs font-medium text-gray-500">{counts[capa]}</span>
      </div>

      {activa && (
        <select
          value={filters[capa]}
          onChange={(e) => setFilter(capa, e.target.value)}
          className="mt-2 w-full rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700"
        >
          <option value="todos">Todos los estados</option>
          {Object.entries(estados).map(([key, { label }]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      )}

      {activa && (
        <ul className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1">
          {Object.entries(estados).map(([key, { color, label }]) => (
            <li key={key} className="flex items-center gap-1.5 text-[11px] text-gray-600">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} />
              {label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function LayersPanel() {
  const { counts, source, refresh } = useMapData();
  // Abierto en desktop, colapsado en movil (no tapar el mapa). Breakpoint sm de Tailwind.
  const [abierto, setAbierto] = useState(
    () => typeof window === 'undefined' || window.innerWidth >= 640,
  );

  return (
    <div className="absolute right-3 top-3 z-[1000] w-60 max-w-[calc(100%-1.5rem)]">
      <div className="rounded-xl bg-white/95 shadow-lg ring-1 ring-black/5 backdrop-blur">
        <button
          type="button"
          onClick={() => setAbierto((a) => !a)}
          className="flex w-full items-center justify-between gap-2 px-3 py-2"
        >
          <span className="flex items-center gap-2 text-sm font-bold text-gray-900">
            Capas del mapa
            {counts.urgentes > 0 && (
              <span className="animate-pulse rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">
                {counts.urgentes} urgente{counts.urgentes > 1 ? 's' : ''}
              </span>
            )}
          </span>
          <span className="text-gray-400">{abierto ? '▾' : '▸'}</span>
        </button>

        {abierto && (
          <div className="space-y-2 px-3 pb-3">
            <CapaControl capa="atrapados" />
            <CapaControl capa="personas" />
            <CapaControl capa="edificios" />

            <div className="flex items-center justify-between border-t border-gray-100 pt-2">
              <span className="text-[10px] text-gray-400">
                {source === 'mock' ? 'Datos de prueba' : source === 'api' ? 'En vivo' : 'Cargando…'}
              </span>
              <button
                type="button"
                onClick={refresh}
                className="text-[11px] font-medium text-red-600 hover:underline"
              >
                Actualizar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
