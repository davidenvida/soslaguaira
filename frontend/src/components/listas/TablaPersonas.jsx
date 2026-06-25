// Tabla de personas digitalizadas de una lista (nombre/estado, cédula,
// coincidencia con la base). Compartida por el resultado de interpretar y por el
// detalle de una lista guardada.
import { ESTADO_LISTA, MATCH } from './listasUtils';

export default function TablaPersonas({ filas }) {
  if (!filas || filas.length === 0) {
    return <p className="text-sm text-slate-500">No hay personas en esta lista.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="text-slate-400">
          <tr>
            <th className="py-1 pr-2 font-semibold">Nombre</th>
            <th className="py-1 pr-2 font-semibold">Cédula</th>
            <th className="py-1 font-semibold">Coincidencia</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {filas.map((f, i) => {
            const m = MATCH[f.matchTipo] || MATCH.ninguna;
            return (
              <tr key={i} className="align-top">
                <td className="py-2 pr-2 text-slate-800">
                  {f.nombre}
                  {f.estado && (
                    <div className="mt-0.5">
                      <span
                        className={`inline-block rounded-full px-1.5 py-0.5 text-[9px] font-bold ${ESTADO_LISTA[f.estado] || ESTADO_LISTA.desconocido}`}
                      >
                        {f.estado}
                      </span>
                      {f.estadoHeredado && <span className="ml-1 text-[9px] text-slate-400">según tipo</span>}
                    </div>
                  )}
                </td>
                <td className="py-2 pr-2 tabular-nums text-slate-600">{f.cedula || '—'}</td>
                <td className="py-2">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${m.cls}`}>{m.label}</span>
                  {f.personaNombre && (
                    <div className="mt-0.5 text-[11px] text-slate-500">
                      {f.personaNombre}
                      {f.personaEstado ? ` · ${f.personaEstado}` : ''}
                      {f.otras > 0 && ` (+${f.otras})`}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
