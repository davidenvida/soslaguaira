// Provider que alimenta las capas del mapa y el panel de control.
// - Carga datos via api.js (listPersonas/listAtrapados/listEdificios).
// - Si el backend aun no responde (Enzo trabajando), cae a datos MOCK de forma
//   transparente, asi las capas se ven en vivo desde ya.
// - Mantiene el estado de visibilidad de capas y filtros por estado, compartido
//   entre <MapLayers> (dentro del mapa) y <LayersPanel> (overlay fuera del mapa).
import { createContext, useContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as api from '../../api';
import { listPersonas, listAtrapados, listEdificios } from '../../api';
import { mockPersonas, mockAtrapados, mockEdificios, mockDesaparecidosGeo } from './mockMapData';

const MapDataContext = createContext(null);

const initialVisibility = { personas: true, atrapados: true, edificios: true, desaparecidos: true };
const initialFilters = { personas: 'todos', atrapados: 'todos', edificios: 'todos', desaparecidos: 'todos' };

// Intel geocodificado para la capa de desaparecidos. Pide un lote grande (son
// ~65) y se queda con los que tienen lat/lng. Si el método/endpoint aún no
// existe o nada está geocodificado, devuelve [] y el provider cae a mock.
async function fetchDesaparecidosGeo() {
  if (typeof api.intelPersonas !== 'function') return [];
  const res = await api.intelPersonas({ limit: 500 });
  const arr = Array.isArray(res) ? res : res?.items || res?.data || [];
  return arr.filter(
    (d) => (d?.duplicate_of ?? null) === null && typeof d?.lat === 'number' && typeof d?.lng === 'number',
  );
}

export function MapDataProvider({ children, pollMs = 20000, useMock = false, destacarId = null }) {
  const [data, setData] = useState({ personas: [], atrapados: [], edificios: [], desaparecidos: [] });
  const [source, setSource] = useState('loading'); // 'loading' | 'api' | 'mock'
  const [visibility, setVisibility] = useState(initialVisibility);
  const [filters, setFilters] = useState(initialFilters);
  const [heatmap, setHeatmap] = useState(false); // mapa de calor (densidad) vs marcadores
  const mounted = useRef(true);

  const toggleHeatmap = useCallback(() => setHeatmap((h) => !h), []);

  const allMock = useCallback(() => {
    setData({
      personas: mockPersonas,
      atrapados: mockAtrapados,
      edificios: mockEdificios,
      desaparecidos: mockDesaparecidosGeo,
    });
    setSource('mock');
  }, []);

  const load = useCallback(async () => {
    if (useMock) {
      allMock();
      return;
    }
    try {
      const [personas, atrapados, edificios, desaparecidos] = await Promise.all([
        listPersonas(),
        listAtrapados(),
        listEdificios(),
        fetchDesaparecidosGeo().catch(() => []),
      ]);
      if (!mounted.current) return;
      // Si el backend responde pero aun no hay nada cargado, usamos mock para
      // que el mapa no se vea vacio durante el desarrollo.
      const vacio = !personas?.length && !atrapados?.length && !edificios?.length && !desaparecidos?.length;
      if (vacio) {
        allMock();
      } else {
        setData({
          personas: personas || [],
          atrapados: atrapados || [],
          edificios: edificios || [],
          // El geocodificado puede ir más lento; si aún no hay, mostramos mock geo.
          desaparecidos: desaparecidos?.length ? desaparecidos : mockDesaparecidosGeo,
        });
        setSource('api');
      }
    } catch {
      if (!mounted.current) return;
      // Backend caido / endpoint aun no existe -> mock.
      allMock();
    }
  }, [useMock, allMock]);

  useEffect(() => {
    mounted.current = true;
    load();
    if (!pollMs) return () => { mounted.current = false; };
    const id = setInterval(load, pollMs);
    return () => {
      mounted.current = false;
      clearInterval(id);
    };
  }, [load, pollMs]);

  const toggleLayer = useCallback((key) => {
    setVisibility((v) => ({ ...v, [key]: !v[key] }));
  }, []);

  const setFilter = useCallback((key, value) => {
    setFilters((f) => ({ ...f, [key]: value }));
  }, []);

  const counts = useMemo(
    () => ({
      personas: data.personas.length,
      atrapados: data.atrapados.length,
      edificios: data.edificios.length,
      desaparecidos: data.desaparecidos.length,
      // atrapados con rescate urgente activo
      urgentes: data.atrapados.filter((a) => a.estado === 'atrapado').length,
    }),
    [data],
  );

  const value = useMemo(
    () => ({ data, source, visibility, filters, counts, toggleLayer, setFilter, refresh: load, destacarId, heatmap, toggleHeatmap }),
    [data, source, visibility, filters, counts, toggleLayer, setFilter, load, destacarId, heatmap, toggleHeatmap],
  );

  return <MapDataContext.Provider value={value}>{children}</MapDataContext.Provider>;
}

export function useMapData() {
  const ctx = useContext(MapDataContext);
  if (!ctx) throw new Error('useMapData debe usarse dentro de <MapDataProvider>');
  return ctx;
}
