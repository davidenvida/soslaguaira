// Buzón de sugerencias standalone (Bruno lo monta al pie del directorio).
// Textarea + contacto opcional + enviar. Usa api.enviarSugerencia({texto,contacto}).
// Discreto, mobile-first y accesible (labels). No envía si el texto está vacío.
import { useState } from 'react';
import http from '../../api';
import * as api from '../../api';

// Tolerante al named export; si no existe, cae al http.post directo.
const enviar = (payload) =>
  typeof api.enviarSugerencia === 'function'
    ? api.enviarSugerencia(payload)
    : http.post('/sugerencias', payload).then((r) => r.data);

export default function BuzonSugerencias({ className = '' }) {
  const [texto, setTexto] = useState('');
  const [contacto, setContacto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [exito, setExito] = useState(false);
  const [error, setError] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (enviando || !texto.trim()) return;
    setEnviando(true);
    setError(false);
    try {
      await enviar({ texto: texto.trim(), contacto: contacto.trim() });
      setExito(true);
      setTexto('');
      setContacto('');
    } catch {
      setError(true);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <section className={`mx-auto w-full max-w-md ${className}`} aria-label="Sugerencias">
      <h3 className="text-sm font-bold text-slate-800">Sugerencias</h3>

      {exito ? (
        <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700" role="status">
          Gracias, recibimos tu sugerencia.
        </p>
      ) : (
        <form onSubmit={onSubmit} className="mt-2 space-y-2">
          <div>
            <label htmlFor="sug-texto" className="sr-only">Tu sugerencia</label>
            <textarea
              id="sug-texto"
              rows={3}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Cuéntanos cómo mejorar la plataforma…"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base text-slate-800 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300"
            />
          </div>
          <div>
            <label htmlFor="sug-contacto" className="sr-only">Contacto (opcional)</label>
            <input
              id="sug-contacto"
              type="text"
              value={contacto}
              onChange={(e) => setContacto(e.target.value)}
              placeholder="Contacto (opcional): correo o teléfono"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base text-slate-800 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300"
            />
          </div>
          <button
            type="submit"
            disabled={enviando || !texto.trim()}
            className="min-h-[44px] w-full rounded-lg bg-slate-700 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {enviando ? 'Enviando…' : 'Enviar'}
          </button>
          {error && (
            <p className="text-center text-xs text-red-600" role="alert">
              No se pudo enviar. Intenta de nuevo.
            </p>
          )}
        </form>
      )}
    </section>
  );
}
