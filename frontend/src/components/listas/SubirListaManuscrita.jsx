// Subir lista manuscrita: botón vistoso + modal. Sube una foto de una lista
// escrita a mano, elige el tipo y una descripción/fuente, y la manda a
// POST /api/listas/interpretar. Muestra el RESULTADO digitalizado en una tabla,
// con el indicador de coincidencia por fila contra la base de desaparecidos.
// Standalone (Bruno lo monta junto al header). Mobile-first, viewport-safe.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import http from '../../api';
import * as api from '../../api';

const TIPOS = [
  { value: 'ingresados', label: 'Ingresados' },
  { value: 'trasladados', label: 'Trasladados' },
  { value: 'fallecidos', label: 'Fallecidos' },
  { value: 'refugiados', label: 'Refugiados' },
  { value: 'otro', label: 'Otro' },
];

// Normaliza data.personas a filas para la tabla. Cada persona trae un array
// `coincidencias` (0/1/varias) contra la base; tomamos la mejor (mayor score):
// confianza 'alta' (cédula) = confirmada; 'media' (nombre) = posible; vacío = ninguna.
const normalizarFilas = (res) => {
  const personas = res?.personas || res?.data?.personas || (Array.isArray(res) ? res : []);
  return (Array.isArray(personas) ? personas : []).map((p) => {
    const coincs = Array.isArray(p.coincidencias) ? p.coincidencias : [];
    const best = coincs.slice().sort((a, b) => (b.score || 0) - (a.score || 0))[0];
    const matchTipo = !best ? 'ninguna' : best.confianza === 'alta' ? 'cedula' : 'posible';
    return {
      nombre: p.nombre || p.nombre_completo || '—',
      cedula: p.cedula || '',
      estado: p.estado || '',
      matchTipo,
      personaNombre: best?.nombre_completo || '',
      personaEstado: best?.estado || '',
      otras: coincs.length > 1 ? coincs.length - 1 : 0,
    };
  });
};

const MATCH = {
  cedula: { label: 'Confirmada (cédula)', cls: 'bg-emerald-100 text-emerald-800' },
  posible: { label: 'Posible', cls: 'bg-amber-100 text-amber-800' },
  ninguna: { label: 'Sin coincidencia', cls: 'bg-slate-100 text-slate-600' },
};

const interpretar = (formData) =>
  typeof api.interpretarLista === 'function'
    ? api.interpretarLista(formData)
    : http.post('/listas/interpretar', formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data?.data ?? r.data);

function Modal({ children, onClose, label }) {
  const closeRef = useRef(null);
  const prevFocus = useRef(null);
  useEffect(() => {
    prevFocus.current = document.activeElement;
    closeRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
      if (prevFocus.current?.focus) prevFocus.current.focus();
    };
  }, [onClose]);
  return createPortal(
    <div
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
  const [descripcion, setDescripcion] = useState('');
  const [fase, setFase] = useState('form'); // form | enviando | resultado | error
  const [filas, setFilas] = useState([]);

  const cerrar = () => {
    setAbierto(false);
    setFase('form');
    setFoto(null);
    setDescripcion('');
    setFilas([]);
  };

  const enviar = async (e) => {
    e.preventDefault();
    if (!foto || fase === 'enviando') return;
    setFase('enviando');
    try {
      const fd = new FormData();
      fd.append('foto', foto);
      fd.append('tipo', tipo);
      // El backend usa 'instrucciones' para guiar la interpretación; mandamos
      // ahí la descripción/fuente (y también como 'descripcion' por compatibilidad).
      fd.append('descripcion', descripcion.trim());
      fd.append('instrucciones', descripcion.trim());
      const res = await interpretar(fd);
      setFilas(normalizarFilas(res));
      setFase('resultado');
    } catch {
      setFase('error');
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className={`inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 ${className}`}
      >
        <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 16a1 1 0 0 1-1-1V7.41L8.7 9.7 7.3 8.3 12 3.6l4.7 4.7-1.4 1.4L13 7.41V15a1 1 0 0 1-1 1zM5 19h14v2H5z" />
        </svg>
        Subir lista manuscrita
      </button>

      {abierto && (
        <Modal onClose={cerrar} label="Subir lista manuscrita">
          {fase === 'resultado' ? (
            <div>
              <p className="mb-3 text-xs text-slate-500">
                {filas.length} {filas.length === 1 ? 'fila interpretada' : 'filas interpretadas'}.
              </p>
              {filas.length === 0 ? (
                <p className="text-sm text-slate-500">No se pudo extraer ninguna fila de la imagen.</p>
              ) : (
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
                              {f.estado && <div className="text-[10px] text-slate-400">{f.estado}</div>}
                            </td>
                            <td className="py-2 pr-2 tabular-nums text-slate-600">{f.cedula || '—'}</td>
                            <td className="py-2">
                              <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${m.cls}`}>
                                {m.label}
                              </span>
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
            <form onSubmit={enviar} className="space-y-3">
              <div>
                <label htmlFor="lista-foto" className="mb-1 block text-xs font-semibold text-slate-600">
                  Foto de la lista *
                </label>
                <input
                  id="lista-foto"
                  type="file"
                  accept="image/*"
                  required
                  onChange={(e) => setFoto(e.target.files?.[0] || null)}
                  className="w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-700"
                />
              </div>
              <div>
                <label htmlFor="lista-tipo" className="mb-1 block text-xs font-semibold text-slate-600">Tipo de lista *</label>
                <select
                  id="lista-tipo"
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {TIPOS.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="lista-desc" className="mb-1 block text-xs font-semibold text-slate-600">Descripción / fuente</label>
                <textarea
                  id="lista-desc"
                  rows={2}
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Ej: refugio Escuela Bolívar, entregada por la Cruz Roja…"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              {fase === 'error' && (
                <p className="text-xs text-red-600" role="alert">No se pudo interpretar la lista. Intenta con otra foto.</p>
              )}
              <button
                type="submit"
                disabled={!foto || fase === 'enviando'}
                className="min-h-[44px] w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {fase === 'enviando' ? 'Interpretando…' : 'Interpretar lista'}
              </button>
            </form>
          )}
        </Modal>
      )}
    </>
  );
}
