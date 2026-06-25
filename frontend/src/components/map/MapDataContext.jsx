// Provider que alimenta las capas del mapa y el panel de control.
// - Carga datos via api.js (listPersonas/listAtrapados/listEdificios).
// - Si el backend aun no responde (Enzo trabajando), cae a datos MOCK de forma
//   transparente, asi las capas se ven en vivo desde ya.
// - Mantiene el estado de visibilidad de capas y filtros por estado, compartido
//   entre <MapLayers> (dentro del mapa) y <LayersPanel> (overlay fuera del mapa).
import { createContext, useContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { listPersonas, listAtrapados, listEdificios } from '../../api';
import { mockPersonas, mockAtrapados, mockEdificios } from './mockMapData';

const MapDataContext = createContext(null);

const initialVisibility = { personas: true, atrapados: true, edificios: true };
const initialFilters = { personas: 'todos', atrapados: 'todos', edificios: 'todos' };

export function MapDataProvider({ children, pollMs = 20000, useMock = false }) {
  const [data, setData] = useState({ personas: [], atrapados: [], edificios: [] });
  const [source, setSource] = useState('loading'); // 'loading' | 'api' | 'mock'
  const [visibility, setVisibility] = useState(initialVisibility);
  const [filters, setFilters] = useState(initialFilters);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    if (useMock) {
      setData({ personas: mockPersonas, atrapados: mockAtrapados, edificios: mockEdificios });
      setSource('mock');
      return;
    }
    try {
      const [personas, atrapados, edificios] = await Promise.all([
        listPersonas(),
        listAtrapados(),
        listEdificios(),
      ]);
      if (!mounted.current) return;
      // Si el backend responde pero aun no hay nada cargado, usamos mock para
      // que el mapa no se vea vacio durante el desarrollo.
      const vacio = !personas?.length && !atrapados?.length && !edificios?.length;
      if (vacio) {
        setData({ personas: mockPersonas, atrapados: mockAtrapados, edificios: mockEdificios });
        setSource('mock');
      } else {
        setData({
          personas: personas || [],
          atrapados: atrapados || [],
          edificios: edificios || [],
        });
        setSource('api');
      }
    } catch {
      if (!mounted.current) return;
      // Backend caido / endpoint aun no existe -> mock.
      setData({ personas: mockPersonas, atrapados: mockAtrapados, edificios: mockEdificios });
      setSource('mock');
    }
  }, [useMock]);

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
      // atrapados con rescate urgente activo
      urgentes: data.atrapados.filter((a) => a.estado === 'atrapado').length,
    }),
    [data],
  );

  const value = useMemo(
    () => ({ data, source, visibility, filters, counts, toggleLayer, setFilter, refresh: load }),
    [data, source, visibility, filters, counts, toggleLayer, setFilter, load],
  );

  return <MapDataContext.Provider value={value}>{children}</MapDataContext.Provider>;
}

export function useMapData() {
  const ctx = useContext(MapDataContext);
  if (!ctx) throw new Error('useMapData debe usarse dentro de <MapDataProvider>');
  return ctx;
}
