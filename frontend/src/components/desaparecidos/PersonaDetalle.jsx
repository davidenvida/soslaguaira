// Ficha completa de una persona desaparecida (modal). Muestra TODO el registro
// (la data ya viene en el objeto, sin backend) + acciones: ver publicación, ver
// en el mapa (opcional), marcar a salvo (form de quién confirma) y revertir.
// Se abre desde el ClusterModal del mapa (y, opcionalmente, desde el directorio).
// Accesible (dialog modal, Escape, backdrop, scroll lock) y viewport-safe.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import http, { fotoUrl as toBackendUrl } from '../../api';
import * as api from '../../api';
import Lightbox from '../ui/Lightbox';
import FuenteIcono from '../ui/FuenteIcono';
import { estadoLabel, estadoColor } from './estados';
import { fmtFechaHora } from '../../utils/fecha';

const resolveFoto = (o) => toBackendUrl(o?.foto_url || o?.fotoUrl || '');
const nombre = (o) => o?.nombre_completo || o?.nombreCompleto || o?.nombre || 'Sin nombre';
const ubicacion = (o) => o?.ultima_ubicacion || o?.ultimaUbicacion || '';
const fuente = (o) => o?.fuente_url || o?.fuenteUrl || '';
const contacto = (o) => o?.contacto || o?.contacto_nombre || '';
const sector = (o) => o?.sector_o_edificio || o?.sectorOEdificio || '';

const patchIntel = (id, payload) =>
  typeof api.updateIntelPersona === 'function'
    ? api.updateIntelPersona(id, payload)
    : http.patch(`/intel/personas/${id}`, payload);

function Fila({ label, children }) {
  if (!children) return null;
  return (
    <p className="text-sm text-slate-700">
      <span className="font-semibold text-slate-500">{label}: </span>
      {children}
    </p>
  );
}

export default function PersonaDetalle({ persona, onClose, onUpdate, onVerEnMapa }) {
  const closeRef = useRef(null);
  const prevFocus = useRef(null);
  const dialogRef = useRef(null);
  const [zoom, setZoom] = useState(false);
  const [marcando, setMarcando] = useState(false);
  const [errorMarca, setErrorMarca] = useState(false);
  const [confAbierto, setConfAbierto] = useState(false);
  const [confNombre, setConfNombre] = useState('');
  const [confContacto, setConfContacto] = useState('');
  const [confNota, setConfNota] = useState('');
  const [estadoLocal, setEstadoLocal] = useState(persona.estado);

  useEffect(() => {
    prevFocus.current = document.activeElement;
    closeRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'Tab') {
        // Focus-trap: ciclar dentro del diálogo (mismo patrón que Lightbox/App).
        const nodes = dialogRef.current?.querySelectorAll(
          'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (!nodes || nodes.length === 0) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      if (prevFocus.current && prevFocus.current.focus) prevFocus.current.focus();
    };
  }, [onClose]);

  const foto = resolveFoto(persona);
  const nom = nombre(persona);
  const url = fuente(persona);
  const yaASalvo = estadoLocal === 'a_salvo';
  const confirmacionValida = confNombre.trim() && confContacto.trim();

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
        nota: confNota.trim() || 'Marcada a salvo desde la ficha',
      });
      setEstadoLocal('a_salvo');
      onUpdate?.(persona.id, { estado: 'a_salvo' });
      setConfAbierto(false);
    } catch {
      setErrorMarca(true);
    } finally {
      setMarcando(false);
    }
  };

  const revertir = async () => {
    if (marcando) return;
    setMarcando(true);
    setErrorMarca(false);
    try {
      await patchIntel(persona.id, { estado: 'desaparecido', nota: 'Revertida a desaparecido desde la ficha' });
      setEstadoLocal('desaparecido');
      onUpdate?.(persona.id, { estado: 'desaparecido' });
    } catch {
      setErrorMarca(true);
    } finally {
      setMarcando(false);
    }
  };

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Ficha de ${nom}`}
      className="fixed inset-0 z-[2100] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <h2 className="truncate text-sm font-bold text-slate-900">{nom}</h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xl leading-none text-slate-500 hover:bg-slate-100"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {foto ? (
            <img
              src={foto}
              alt={`Foto de ${nom}`}
              loading="lazy"
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
              className="aspect-[4/5] max-h-72 w-full cursor-zoom-in bg-slate-100 object-cover object-top focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600"
            />
          ) : (
            <div className="flex aspect-[4/5] max-h-72 w-full items-center justify-center bg-slate-100 text-slate-300">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-5.33 0-8 2.67-8 6v2h16v-2c0-3.33-2.67-6-8-6Z" />
              </svg>
            </div>
          )}

          <div className="space-y-1.5 p-4">
            <div className="flex items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${estadoColor(estadoLocal)}`}
              >
                {estadoLabel(estadoLocal)}
              </span>
              {persona.edad != null && persona.edad !== '' && (
                <span className="text-xs text-slate-500">{persona.edad} años</span>
              )}
            </div>

            <Fila label="Parroquia">{persona.parroquia}</Fila>
            <Fila label="Última ubicación">{ubicacion(persona)}</Fila>
            <Fila label="Sector / edificio">{sector(persona)}</Fila>
            <Fila label="Contacto">{contacto(persona)}</Fila>
            <Fila label="Reportante">
              {persona.reportante
                ? `${persona.reportante}${persona.relacion ? ` (${persona.relacion})` : ''}`
                : ''}
            </Fila>
            {persona.descripcion && <p className="text-sm leading-snug text-slate-700">{persona.descripcion}</p>}
            <Fila label="Publicado">{fmtFechaHora(persona.created_at || persona.createdAt || persona.fecha_reporte || persona.fechaReporte)}</Fila>
            {yaASalvo && (persona.confirmado_por || persona.confirmadoPor) && (
              <p className="text-xs text-emerald-600">
                Confirmado por {persona.confirmado_por || persona.confirmadoPor}
              </p>
            )}

            {/* Acciones */}
            <div className="space-y-2 pt-2">
              {url && (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-red-600 hover:underline"
                >
                  <FuenteIcono url={url} size={16} />
                  Ver publicación
                  <span className="sr-only"> (abre en nueva pestaña)</span>
                </a>
              )}

              {typeof onVerEnMapa === 'function' && (
                <button
                  type="button"
                  onClick={() => onVerEnMapa(persona)}
                  className="flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-lg bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-700 ring-1 ring-violet-200 hover:bg-violet-100"
                >
                  Ver en el mapa
                </button>
              )}

              {!yaASalvo ? (
                confAbierto ? (
                  <form onSubmit={confirmarASalvo} className="space-y-2">
                    <p className="text-xs font-semibold text-slate-600">Confirmar que está a salvo</p>
                    <label htmlFor="pd-nombre" className="sr-only">Tu nombre</label>
                    <input
                      id="pd-nombre"
                      type="text"
                      required
                      value={confNombre}
                      onChange={(e) => setConfNombre(e.target.value)}
                      placeholder="Tu nombre *"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <label htmlFor="pd-contacto" className="sr-only">Tu contacto o teléfono</label>
                    <input
                      id="pd-contacto"
                      type="text"
                      required
                      value={confContacto}
                      onChange={(e) => setConfContacto(e.target.value)}
                      placeholder="Tu contacto o teléfono *"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <label htmlFor="pd-nota" className="sr-only">Nota (opcional)</label>
                    <textarea
                      id="pd-nota"
                      rows={2}
                      value={confNota}
                      onChange={(e) => setConfNota(e.target.value)}
                      placeholder="Nota (opcional): dónde, cómo se confirmó…"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={marcando || !confirmacionValida}
                        className="min-h-[44px] flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                      >
                        {marcando ? 'Confirmando…' : 'Confirmar a salvo'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfAbierto(false)}
                        className="rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:text-slate-700"
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfAbierto(true)}
                    className="min-h-[44px] w-full rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                  >
                    Marcar encontrado / a salvo
                  </button>
                )
              ) : (
                <div className="space-y-1">
                  <p className="rounded-lg bg-emerald-50 px-3 py-2 text-center text-sm font-semibold text-emerald-700">
                    ✓ Reportada a salvo
                  </p>
                  <button
                    type="button"
                    onClick={revertir}
                    disabled={marcando}
                    className="w-full text-center text-xs text-slate-400 hover:text-slate-600 hover:underline disabled:opacity-60"
                  >
                    {marcando ? 'Revirtiendo…' : 'Revertir (volver a desaparecido)'}
                  </button>
                </div>
              )}
              {errorMarca && (
                <p className="text-center text-xs text-red-600" role="alert">
                  No se pudo actualizar. Intenta de nuevo.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {zoom && (
        <Lightbox src={foto} alt={`Foto de ${nom}`} caption={nom} onClose={() => setZoom(false)} />
      )}
    </div>,
    document.body,
  );
}
