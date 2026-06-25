// Tarjeta de una persona desaparecida. Foto con placeholder, badge de estado,
// datos y enlace al post original. Backend es snake_case (verificado por Bruno);
// igual leo camelCase como respaldo.
import { useState } from 'react';
import { estadoLabel, estadoColor } from './estados';

// /uploads/... lo proxya Vite; http(s) directo se respeta tal cual.
const resolveFoto = (o) => o?.foto_url || o?.fotoUrl || '';
const nombre = (o) => o?.nombre_completo || o?.nombreCompleto || o?.nombre || 'Sin nombre';
const ubicacion = (o) => o?.ultima_ubicacion || o?.ultimaUbicacion || '';
const fuente = (o) => o?.fuente_url || o?.fuenteUrl || '';
const fecha = (o) => o?.fecha_reporte || o?.fechaReporte || '';

const fmtFecha = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' });
};

function Placeholder() {
  return (
    <div className="flex h-44 w-full items-center justify-center bg-slate-100 text-slate-300">
      <svg width="56" height="56" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-5.33 0-8 2.67-8 6v2h16v-2c0-3.33-2.67-6-8-6Z" />
      </svg>
    </div>
  );
}

export default function DesaparecidoCard({ persona }) {
  const [imgError, setImgError] = useState(false);
  const foto = resolveFoto(persona);
  const nom = nombre(persona);
  const ubic = ubicacion(persona);
  const url = fuente(persona);
  const f = fmtFecha(fecha(persona));

  return (
    <article className="flex flex-col overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
      {foto && !imgError ? (
        <img
          src={foto}
          alt={`Foto de ${nom}`}
          loading="lazy"
          onError={() => setImgError(true)}
          className="h-44 w-full bg-slate-100 object-cover"
        />
      ) : (
        <Placeholder />
      )}

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-bold leading-tight text-slate-900">{nom}</h3>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${estadoColor(persona.estado)}`}>
            {estadoLabel(persona.estado)}
          </span>
        </div>

        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
          {persona.edad != null && persona.edad !== '' && <span>{persona.edad} años</span>}
          {persona.parroquia && <span>{persona.parroquia}</span>}
        </div>

        {ubic && (
          <p className="text-xs text-slate-600">
            <span className="font-semibold text-slate-500">Última ubicación: </span>
            {ubic}
          </p>
        )}

        {persona.descripcion && (
          <p className="text-xs leading-snug text-slate-700 line-clamp-3">{persona.descripcion}</p>
        )}

        <div className="mt-auto flex items-center justify-between pt-2">
          {f && <span className="text-[11px] text-slate-400">{f}</span>}
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-red-600 hover:underline"
            >
              Ver publicación <span aria-hidden="true">→</span>
              <span className="sr-only"> (abre en nueva pestaña)</span>
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
