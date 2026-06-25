// Página oculta de sugerencias (Bruno la cablea en /sugerencias). Lee
// GET /api/sugerencias con header X-Admin-Token. El token se toma de ?token=
// en la URL o se pide en un input. Lista las sugerencias de forma legible.
import { useEffect, useState } from 'react';
import http from '../../api';

const tokenDeUrl = () => {
  try {
    return new URLSearchParams(window.location.search).get('token') || '';
  } catch {
    return '';
  }
};

const fmtFecha = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('es-VE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export default function SugerenciasPage() {
  const [token, setToken] = useState(tokenDeUrl);
  const [input, setInput] = useState('');
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState(token ? 'loading' : 'idle'); // idle | loading | ready | error | denied

  useEffect(() => {
    if (!token) return undefined;
    let vivo = true;
    setStatus('loading');
    http
      .get('/sugerencias', { headers: { 'X-Admin-Token': token } })
      .then((res) => {
        if (!vivo) return;
        const body = res.data;
        const lista = Array.isArray(body) ? body : body?.data?.items || body?.data || body?.items || [];
        setItems(lista);
        setStatus('ready');
      })
      .catch((err) => {
        if (!vivo) return;
        const code = err?.response?.status;
        setStatus(code === 401 || code === 403 ? 'denied' : 'error');
      });
    return () => {
      vivo = false;
    };
  }, [token]);

  if (!token || status === 'denied') {
    return (
      <main className="mx-auto flex min-h-[60vh] w-full max-w-sm flex-col justify-center p-6">
        <h1 className="mb-1 text-lg font-bold text-slate-900">Sugerencias</h1>
        <p className="mb-4 text-xs text-slate-500">
          {status === 'denied' ? 'Token inválido. Inténtalo de nuevo.' : 'Ingresa el token de administrador para ver las sugerencias.'}
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (input.trim()) setToken(input.trim());
          }}
          className="space-y-2"
        >
          <label htmlFor="admin-token" className="sr-only">Token de administrador</label>
          <input
            id="admin-token"
            type="password"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Token de administrador"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base text-slate-800 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300"
          />
          <button
            type="submit"
            className="min-h-[44px] w-full rounded-lg bg-slate-700 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Ver sugerencias
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl p-4 sm:p-6">
      <div className="mb-4 flex items-baseline justify-between gap-2">
        <h1 className="text-xl font-bold text-slate-900">Sugerencias</h1>
        {status === 'ready' && (
          <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-slate-600">
            {items.length}
          </span>
        )}
      </div>

      {status === 'loading' && <p className="py-12 text-center text-sm text-slate-500" aria-live="polite">Cargando…</p>}
      {status === 'error' && (
        <p className="py-12 text-center text-sm text-red-600" aria-live="polite">No se pudieron cargar las sugerencias.</p>
      )}
      {status === 'ready' && items.length === 0 && (
        <p className="py-12 text-center text-sm text-slate-500">No hay sugerencias aún.</p>
      )}

      {status === 'ready' && items.length > 0 && (
        <ul className="space-y-3">
          {items.map((s, i) => (
            <li key={s.id ?? i} className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
              <p className="whitespace-pre-wrap text-sm text-slate-800" style={{ overflowWrap: 'anywhere' }}>
                {s.texto || s.mensaje || ''}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                {(s.contacto || s.contact) && (
                  <span className="text-slate-500">Contacto: {s.contacto || s.contact}</span>
                )}
                <span>{fmtFecha(s.created_at || s.fecha || s.createdAt)}</span>
                {(s.pais || s.country) && <span>{s.pais || s.country}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
