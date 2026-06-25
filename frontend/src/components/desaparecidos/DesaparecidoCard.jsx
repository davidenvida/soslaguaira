// Tarjeta de una persona desaparecida. Foto (ampliable en lightbox), badge de
// estado, datos, contacto, enlace al post original y botón para marcarla a salvo.
// Backend snake_case (verificado); igual leo camelCase como respaldo.
import { useState } from 'react';
import http, { fotoUrl as toBackendUrl } from '../../api';
import * as api from '../../api';
import Lightbox from '../ui/Lightbox';
import FuenteIcono from '../ui/FuenteIcono';
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

// POST de solicitud de retiro (takedown). Tolerante al named export de api.js.
const flagIntel = (id, payload) =>
  typeof api.flagIntelPersona === 'function'
    ? api.flagIntelPersona(id, payload)
    : http.post(`/intel/personas/${id}/flag`, payload);

function Placeholder() {
  return (
    <div className="flex aspect-[4/5] w-full items-center justify-center bg-slate-100 text-slate-300">
      <svg width="56" height="56" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-5.33 0-8 2.67-8 6v2h16v-2c0-3.33-2.67-6-8-6Z" />
      </svg>
    </div>
  );
}

export default function DesaparecidoCard({ persona, onUpdate, onVerEnMapa }) {
  const [imgError, setImgError] = useState(false);
  const [zoom, setZoom] = useState(false);
  const [marcando, setMarcando] = useState(false);
  const [errorMarca, setErrorMarca] = useState(false);
  const [confAbierto, setConfAbierto] = useState(false);
  const [confNombre, setConfNombre] = useState('');
  const [confContacto, setConfContacto] = useState('');
  const [confNota, setConfNota] = useState('');
  const [flagAbierto, setFlagAbierto] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [enviandoFlag, setEnviandoFlag] = useState(false);
  const [flagEnviado, setFlagEnviado] = useState(false);
  const [flagError, setFlagError] = useState(false);

  const foto = resolveFoto(persona);
  const nom = nombre(persona);
  const ubic = ubicacion(persona);
  const url = fuente(persona);
  const cont = contacto(persona);
  const f = fmtFecha(fecha(persona));
  const yaASalvo = persona.estado === 'a_salvo';
  const tieneMapa = typeof persona.lat === 'number' && typeof persona.lng === 'number';

  const confirmacionValida = confNombre.trim() && confContacto.trim();

  // Confirmar a salvo requiere identificar a quien lo reporta: marcar a salvo
  // DETIENE la búsqueda, así que dejamos rastro de quién y cómo contactarlo.
  const confirmarASalvo = async (e) => {
    e?.preventDefault();
    if (marcando || yaASalvo || !confirmacionValida) return;
    setMarcando(true);
    setErrorMarca(false);
    try {
      await patchIntel(persona.id, {
        estado: 'a_salvo',
        confirmado_por: confNombre.trim(),
        confirmado_contacto: confContacto.trim(),
        nota: confNota.trim() || 'Marcada a salvo desde el directorio web',
      });
      onUpdate?.(persona.id, { estado: 'a_salvo' });
      setConfAbierto(false);
    } catch {
      setErrorMarca(true);
    } finally {
      setMarcando(false);
    }
  };

  // Revertir: marcar a salvo pudo ser un error -> volver a desaparecido reactiva
  // la búsqueda.
  const revertirADesaparecido = async () => {
    if (marcando) return;
    setMarcando(true);
    setErrorMarca(false);
    try {
      await patchIntel(persona.id, { estado: 'desaparecido', nota: 'Revertida a desaparecido desde el directorio web' });
      onUpdate?.(persona.id, { estado: 'desaparecido' });
    } catch {
      setErrorMarca(true);
    } finally {
      setMarcando(false);
    }
  };

  const solicitarRetiro = async () => {
    if (enviandoFlag) return;
    setEnviandoFlag(true);
    setFlagError(false);
    try {
      await flagIntel(persona.id, {
        motivo: motivo.trim() || 'Solicitud de retiro desde el directorio web',
      });
      setFlagEnviado(true);
      setFlagAbierto(false);
    } catch {
      setFlagError(true);
    } finally {
      setEnviandoFlag(false);
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
          aria-label={`Ampliar foto de ${nom}`}
          title="Ampliar foto"
          className="aspect-[4/5] w-full cursor-zoom-in bg-slate-100 object-cover object-top focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600"
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
              className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:underline"
            >
              <FuenteIcono url={url} />
              Ver publicación
              <span className="sr-only"> (abre en nueva pestaña)</span>
            </a>
          )}
        </div>

        {/* Saltar al mapa centrado en esta persona (solo si está geolocalizada). */}
        {tieneMapa && typeof onVerEnMapa === 'function' && (
          <button
            type="button"
            onClick={() => onVerEnMapa(persona)}
            className="mt-2 inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-lg bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700 ring-1 ring-violet-200 hover:bg-violet-100"
          >
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2a7 7 0 0 0-7 7c0 4 7 13 7 13s7-9 7-13a7 7 0 0 0-7-7zm0 9a2 2 0 1 1 0-4 2 2 0 0 1 0 4z" />
            </svg>
            Ver en el mapa
          </button>
        )}

        {/* Mantiene el directorio vivo: marcar como encontrada / a salvo.
            Pide identificar a quien confirma (detiene la búsqueda). */}
        {!yaASalvo ? (
          confAbierto ? (
            <form onSubmit={confirmarASalvo} className="mt-2 space-y-2">
              <p className="text-[11px] font-semibold text-slate-600">Confirmar que está a salvo</p>
              <div>
                <label htmlFor={`conf-nombre-${persona.id}`} className="sr-only">Tu nombre</label>
                <input
                  id={`conf-nombre-${persona.id}`}
                  type="text"
                  required
                  value={confNombre}
                  onChange={(e) => setConfNombre(e.target.value)}
                  placeholder="Tu nombre *"
                  className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label htmlFor={`conf-contacto-${persona.id}`} className="sr-only">Tu contacto o teléfono</label>
                <input
                  id={`conf-contacto-${persona.id}`}
                  type="text"
                  required
                  value={confContacto}
                  onChange={(e) => setConfContacto(e.target.value)}
                  placeholder="Tu contacto o teléfono *"
                  className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label htmlFor={`conf-nota-${persona.id}`} className="sr-only">Nota (opcional)</label>
                <textarea
                  id={`conf-nota-${persona.id}`}
                  rows={2}
                  value={confNota}
                  onChange={(e) => setConfNota(e.target.value)}
                  placeholder="Nota (opcional): dónde, cómo se confirmó…"
                  className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={marcando || !confirmacionValida}
                  className="min-h-[44px] flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {marcando ? 'Confirmando…' : 'Confirmar a salvo'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfAbierto(false)}
                  className="rounded-lg px-3 py-2 text-xs font-medium text-slate-500 hover:text-slate-700"
                >
                  Cancelar
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setConfAbierto(true)}
              className="mt-2 min-h-[44px] w-full rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
            >
              Marcar encontrado / a salvo
            </button>
          )
        ) : (
          <div className="mt-2 space-y-1">
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-center text-xs font-semibold text-emerald-700">
              ✓ Reportada a salvo
              {(persona.confirmado_por || persona.confirmadoPor) && (
                <span className="mt-0.5 block text-[10px] font-normal text-emerald-600">
                  Confirmado por {persona.confirmado_por || persona.confirmadoPor}
                </span>
              )}
            </p>
            <button
              type="button"
              onClick={revertirADesaparecido}
              disabled={marcando}
              className="w-full text-center text-[11px] text-slate-400 hover:text-slate-600 hover:underline disabled:opacity-60"
            >
              {marcando ? 'Revirtiendo…' : 'Revertir (volver a desaparecido)'}
            </button>
          </div>
        )}
        {errorMarca && (
          <p className="mt-1 text-center text-[11px] text-red-600" role="alert">
            No se pudo actualizar. Intenta de nuevo.
          </p>
        )}

        {/* Privacidad: solicitud discreta de retiro de la ficha. */}
        {flagEnviado ? (
          <p className="mt-2 text-center text-[11px] text-slate-400">
            Solicitud enviada. Gracias.
          </p>
        ) : flagAbierto ? (
          <div className="mt-2 space-y-1.5">
            <label htmlFor={`motivo-${persona.id}`} className="sr-only">
              Motivo de la solicitud de retiro
            </label>
            <textarea
              id={`motivo-${persona.id}`}
              rows={2}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Motivo (opcional): soy familiar, dato incorrecto…"
              className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-700 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={solicitarRetiro}
                disabled={enviandoFlag}
                className="flex-1 rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {enviandoFlag ? 'Enviando…' : 'Enviar solicitud'}
              </button>
              <button
                type="button"
                onClick={() => setFlagAbierto(false)}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700"
              >
                Cancelar
              </button>
            </div>
            {flagError && (
              <p className="text-center text-[11px] text-red-600" role="alert">
                No se pudo enviar. Intenta de nuevo.
              </p>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setFlagAbierto(true)}
            className="mt-2 self-center text-[11px] text-slate-400 hover:text-slate-600 hover:underline"
          >
            Solicitar quitar esta ficha
          </button>
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
