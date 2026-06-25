// Subir lista manuscrita: botón vistoso + modal. Sube una foto de una lista
// escrita a mano, elige el tipo y una descripción/fuente, y la manda a
// POST /api/listas/interpretar. Muestra el RESULTADO digitalizado en una tabla,
// con el indicador de coincidencia por fila contra la base de desaparecidos.
// Standalone (Bruno lo monta junto al header). Mobile-first, viewport-safe.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import http from '../../api';
import * as api from '../../api';
import './subirLista.css';
import { TIPOS, normalizarFilas } from './listasUtils';
import TablaPersonas from './TablaPersonas';

const interpretar = (formData) =>
  typeof api.interpretarLista === 'function'
    ? api.interpretarLista(formData)
    : http.post('/listas/interpretar', formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data?.data ?? r.data);

function Modal({ children, onClose, label }) {
  const closeRef = useRef(null);
  const prevFocus = useRef(null);
  const dialogRef = useRef(null);
  useEffect(() => {
    prevFocus.current = document.activeElement;
    closeRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'Tab') {
        // Focus-trap: ciclar dentro del diálogo (mismo patrón que Lightbox/Cluster).
        const nodes = dialogRef.current?.querySelectorAll(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
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
      document.body.style.overflow = prev;
      if (prevFocus.current?.focus) prevFocus.current.focus();
    };
  }, [onClose]);
  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-bold text-slate-900">{label}</h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-9 w-9 items-center justify-center rounded-full text-xl leading-none text-slate-500 hover:bg-slate-100"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export default function SubirListaManuscrita({ className = '' }) {
  const [abierto, setAbierto] = useState(false);
  const [foto, setFoto] = useState(null);
  const [tipo, setTipo] = useState('ingresados');
  const [fuente, setFuente] = useState(''); // hospital / fuente de la lista (obligatorio)
  const [fase, setFase] = useState('form'); // form | enviando | resultado | error
  const [filas, setFilas] = useState([]);
  const [tipoLista, setTipoLista] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const fileInputRef = useRef(null);

  // Vista previa de la imagen elegida (se libera al cambiar).
  useEffect(() => {
    if (!foto) {
      setPreviewUrl('');
      return undefined;
    }
    const url = URL.createObjectURL(foto);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [foto]);

  const tomarArchivo = (f) => {
    if (f && f.type.startsWith('image/')) setFoto(f);
  };
  const onDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    tomarArchivo(e.dataTransfer.files?.[0]);
  };

  const cerrar = () => {
    setAbierto(false);
    setFase('form');
    setFoto(null);
    setFuente('');
    setFilas([]);
    setTipoLista('');
  };

  const enviar = async (e) => {
    e.preventDefault();
    if (!foto || !fuente.trim() || fase === 'enviando') return;
    setFase('enviando');
    try {
      const fd = new FormData();
      fd.append('foto', foto);
      fd.append('tipo', tipo);
      // Fuente/hospital de la lista (sin esto la lista entra huérfana). Se manda
      // como 'fuente' y también como contexto en 'instrucciones' para la IA.
      fd.append('fuente', fuente.trim());
      fd.append('instrucciones', `Lista de ${tipo} del hospital/fuente: ${fuente.trim()}`);
      const res = await interpretar(fd);
      setFilas(normalizarFilas(res));
      setTipoLista(res?.tipo_lista || res?.tipoLista || '');
      setFase('resultado');
    } catch {
      setFase('error');
    }
  };

  return (
    <>
      {/* Layout horizontal: botón a la izquierda, explicación a la derecha. */}
      <div className={`flex flex-wrap items-center gap-3 ${className}`}>
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="sos-lista-btn inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white ring-1 ring-violet-300/60 hover:from-indigo-700 hover:to-violet-700"
        >
          {/* Documento con destello (flecha de subida + brillo): "subir foto de una lista". */}
          <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-7-7zm0 2 5 5h-5V4zM8 15l4-4 4 4h-3v4h-2v-4H8z" />
            <path d="M18.5 2.2l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z" />
          </svg>
          Subir lista manuscrita
        </button>
        <p className="hidden min-w-[12rem] flex-1 text-xs text-slate-600 sm:block">
          ¿Tienes una foto de una lista de un hospital (ingresados, traslados o fallecidos)? Súbela y la convertimos en digital.
        </p>
      </div>

      {abierto && (
        <Modal onClose={cerrar} label="Subir lista manuscrita">
          {fase === 'resultado' ? (
            <div>
              <p className="mb-3 text-xs text-slate-500">
                {filas.length} {filas.length === 1 ? 'fila interpretada' : 'filas interpretadas'}.
                {tipoLista && <span> Estado por defecto del tipo: <strong>{tipoLista}</strong>.</span>}
              </p>
              {filas.length === 0 ? (
                <p className="text-sm text-slate-500">No se pudo extraer ninguna fila de la imagen.</p>
              ) : (
                <TablaPersonas filas={filas} />
              )}
              <button
                type="button"
                onClick={cerrar}
                className="mt-4 min-h-[44px] w-full rounded-lg bg-slate-700 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Listo
              </button>
            </div>
          ) : (
            <form onSubmit={enviar} className="space-y-4">
              {/* Zona de arrastrar/elegir foto */}
              <div>
                <span className="mb-1.5 block text-sm font-semibold text-slate-700">1. Foto de la lista</span>
                <input
                  ref={fileInputRef}
                  id="lista-foto"
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => tomarArchivo(e.target.files?.[0])}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                  onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
                  onDrop={onDrop}
                  className={`flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-10 text-center transition ${
                    dragActive ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 bg-slate-50 hover:border-indigo-400 hover:bg-slate-100'
                  }`}
                >
                  {previewUrl ? (
                    <>
                      <img src={previewUrl} alt="Vista previa de la lista" className="max-h-44 rounded-lg object-contain" />
                      <span className="text-xs text-slate-500">Toca para cambiar la foto</span>
                    </>
                  ) : (
                    <>
                      <svg className="h-12 w-12 text-indigo-500" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M12 16a1 1 0 0 1-1-1V7.41L8.7 9.7 7.3 8.3 12 3.6l4.7 4.7-1.4 1.4L13 7.41V15a1 1 0 0 1-1 1zM5 19h14v2H5z" />
                      </svg>
                      <span className="text-sm font-bold text-slate-700">Arrastra una foto aquí o toca para elegir</span>
                      <span className="text-xs text-slate-400">Desde la galería o la cámara de tu teléfono</span>
                    </>
                  )}
                </button>
              </div>

              {/* Tipo de lista: chips grandes */}
              <div>
                <span className="mb-1.5 block text-sm font-semibold text-slate-700">2. Tipo de lista</span>
                <div className="flex flex-wrap gap-2">
                  {TIPOS.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setTipo(t.value)}
                      aria-pressed={tipo === t.value}
                      className={`min-h-[40px] rounded-full px-4 text-sm font-semibold ring-1 transition ${
                        tipo === t.value ? 'bg-indigo-600 text-white ring-indigo-600' : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              {/* Fuente / hospital: OBLIGATORIO (sin esto la lista queda huérfana). */}
              <div>
                <label htmlFor="lista-fuente" className="mb-1.5 block text-sm font-semibold text-slate-700">
                  3. ¿De qué hospital o fuente es esta lista?
                </label>
                <input
                  id="lista-fuente"
                  type="text"
                  value={fuente}
                  onChange={(e) => setFuente(e.target.value)}
                  placeholder="Ej: Hospital Pérez Carreño, refugio Escuela Bolívar…"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              {fase === 'error' && (
                <p className="text-xs text-red-600" role="alert">No se pudo interpretar la lista. Intenta con otra foto.</p>
              )}
              <button
                type="submit"
                disabled={!foto || !fuente.trim() || fase === 'enviando'}
                className="min-h-[48px] w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {fase === 'enviando' ? 'Interpretando…' : 'Interpretar lista'}
              </button>
              {!foto || !fuente.trim() ? (
                <p className="text-center text-[11px] text-slate-400">Agrega la foto y el hospital/fuente para continuar.</p>
              ) : null}
            </form>
          )}
        </Modal>
      )}
    </>
  );
}
