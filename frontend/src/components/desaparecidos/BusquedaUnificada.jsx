// Búsqueda unificada del directorio (corazón de la reunificación). Una sola
// consulta (GET /api/buscar?q=) trae coincidencias en DOS lugares y se muestran
// en dos secciones: 'En reportes' (directorio de desaparecidos) y 'En hospitales'
// (ingresado/trasladado/herido, con hospital + cédula). Así una familia encuentra
// a su ser querido esté donde esté. Fallecidos no aparecen.
import { useEffect, useState } from 'react';
import http from '../../api';
import DesaparecidoCard from './DesaparecidoCard';
import { ESTADO_LISTA } from '../listas/listasUtils';

const buscar = (q) => http.get('/buscar', { params: { q } }).then((r) => r.data?.data ?? r.data);

export default function BusquedaUnificada({ q, onUpdate, onVerEnMapa }) {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | error

  useEffect(() => {
    const query = (q || '').trim();
    if (query.length < 2) return undefined;
    let vivo = true;
    setStatus('loading');
    buscar(query)
      .then((r) => {
        if (vivo) {
          setData(r);
          setStatus('ready');
        }
      })
      .catch(() => vivo && setStatus('error'));
    return () => {
      vivo = false;
    };
  }, [q]);

  const reportes = data?.reportes || [];
  const hospitales = data?.hospitales || [];
  const vacio = status === 'ready' && reportes.length === 0 && hospitales.length === 0;

  return (
    <div aria-live="polite">
      {status === 'loading' && <p className="py-8 text-center text-sm text-slate-500">Buscando…</p>}
      {status === 'error' && (
        <p className="py-8 text-center text-sm text-red-600">No se pudo buscar. Intenta de nuevo.</p>
      )}
      {vacio && (
        <p className="py-8 text-center text-sm text-slate-500">
          No se encontró a esa persona en reportes ni en hospitales.
        </p>
      )}

      {status === 'ready' && reportes.length > 0 && (
        <section aria-label="Coincidencias en reportes" className="mb-5">
          <h3 className="mb-2 text-sm font-bold text-slate-700">
            En reportes <span className="font-medium text-slate-400">({reportes.length})</span>
          </h3>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
            {reportes.map((p) => (
              <li key={p.id ?? `${p.nombre_completo}-${p.cedula}`}>
                <DesaparecidoCard persona={p} onUpdate={onUpdate} onVerEnMapa={onVerEnMapa} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {status === 'ready' && hospitales.length > 0 && (
        <section aria-label="Coincidencias en hospitales">
          <h3 className="mb-2 text-sm font-bold text-slate-700">
            En hospitales <span className="font-medium text-slate-400">({hospitales.length})</span>
          </h3>
          <ul className="divide-y divide-slate-100 rounded-xl bg-white ring-1 ring-slate-200">
            {hospitales.map((h, i) => (
              <li key={i} className="flex items-start gap-2 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-900">{h.nombre || '—'}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                    {h.cedula && <span className="tabular-nums">C.I. {h.cedula}</span>}
                    {h.hospital && <span className="font-medium text-slate-600">{h.hospital}</span>}
                    {(h.lugar || h.detalle) && <span>{h.lugar || h.detalle}</span>}
                  </div>
                </div>
                {h.estado && (
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${ESTADO_LISTA[h.estado] || ESTADO_LISTA.desconocido}`}>
                    {h.estado}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
