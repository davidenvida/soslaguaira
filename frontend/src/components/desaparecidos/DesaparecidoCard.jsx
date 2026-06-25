// Tarjeta de una persona desaparecida. Foto (ampliable en lightbox), badge de
// estado, datos, contacto, enlace al post original y botón para marcarla a salvo.
// Backend snake_case (verificado); igual leo camelCase como respaldo.
import { useState } from 'react';
import http, { fotoUrl as toBackendUrl } from '../../api';
import * as api from '../../api';
import Lightbox from '../ui/Lightbox';
import { estadoLabel, estadoColor } from './estados';

// Pasa la foto por el helper de api.js: /uploads/... -> dominio backend en prod
// (proxy de Vite en dev); URL absoluta -> tal cual.
const resolveFoto = (o) => toBackendUrl(o?.foto_url || o?.fotoUrl || '');
const nombre = (o) => o?.nombre_completo || o?.nombreCompleto || o?.nombre || 'Sin nombre';
const ubicacion = (o) => o?.ultima_ubicacion || o?.ultimaUbicacion || '';
const fuente = (o) => o?.fuente_url || o?.fuenteUrl || '';
const fecha = (o) => o?.fecha_reporte || o?.fechaReporte || '';
const contacto = (o) => o?.contacto || o?.contacto_nombre || '';

const fmtFecha = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' });
};

// PATCH del intel. Usa el named export de api.js si existe; si no, cae al
// http.patch directo para no bloquearse.
const patchIntel = (id, payload) =>
  typeof api.updateIntelPersona === 'function'
    ? api.updateIntelPersona(id, payload)
    : http.patch(`/intel/personas/${id}`, payload);

function Placeholder() {
  return (
    <div className="flex h-44 w-full items-center justify-center bg-slate-100 text-slate-300">
      <svg width="56" height="56" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-5.33 0-8 2.67-8 6v2h16v-2c0-3.33-2.67-6-8-6Z" />
      </svg>
    </div>
  );
}

export default function DesaparecidoCard({ persona, onUpdate }) {
  const [imgError, setImgError] = useState(false);
  const [zoom, setZoom] = useState(false);
  const [marcando, setMarcando] = useState(false);
  const [errorMarca, setErrorMarca] = useState(false);

  const foto = resolveFoto(persona);
  const nom = nombre(persona);
  const ubic = ubicacion(persona);
  const url = fuente(persona);
  const cont = contacto(persona);
  const f = fmtFecha(fecha(persona));
  const yaASalvo = persona.estado === 'a_salvo';

  const marcarASalvo = async () => {
    if (marcando || yaASalvo) return;
    setMarcando(true);
    setErrorMarca(false);
    try {
      // La nota se anexa a `notas` en backend (trazabilidad del origen del cambio).
      await patchIntel(persona.id, { estado: 'a_salvo', nota: 'Marcada a salvo desde el directorio web' });
      onUpdate?.(persona.id, { estado: 'a_salvo' });
    } catch {
      setErrorMarca(true);
    } finally {
      setMarcando(false);
    }
  };

  return (
    <article className="flex flex-col overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
      {foto && !imgError ? (
        <img
          src={foto}
          alt={`Foto de ${nom}`}
          loading="lazy"
          onError={() => setImgError(true)}
          onClick={() => setZoom(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setZoom(true);
            }
          }}
          role="button"
          tabIndex={0}
          title="Ampliar foto"
          className="h-44 w-full cursor-zoom-in bg-slate-100 object-cover"
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

        {cont && (
          <p className="text-xs text-slate-600">
            <span className="font-semibold text-slate-500">Contacto: </span>
            {cont}
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

        {/* Mantiene el directorio vivo: marcar como encontrada / a salvo. */}
        {!yaASalvo ? (
          <button
            type="button"
            onClick={marcarASalvo}
            disabled={marcando}
            className="mt-2 w-full rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {marcando ? 'Marcando…' : 'Marcar encontrado / a salvo'}
          </button>
        ) : (
          <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-center text-xs font-semibold text-emerald-700">
            ✓ Reportada a salvo
          </p>
        )}
        {errorMarca && (
          <p className="mt-1 text-center text-[11px] text-red-600" role="alert">
            No se pudo actualizar. Intenta de nuevo.
          </p>
        )}
      </div>

      {zoom && (
        <Lightbox
          src={foto}
          alt={`Foto de ${nom}`}
          caption={f ? `${nom} · ${f}` : nom}
          onClose={() => setZoom(false)}
        />
      )}
    </article>
  );
}
