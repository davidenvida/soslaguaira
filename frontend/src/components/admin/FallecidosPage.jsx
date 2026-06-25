// Página PRIVADA admin de fallecidos (Bruno la cablea en /fallecidos). No
// pública: los fallecidos no se listan en el directorio. Lee
// GET /api/intel/personas?estado=fallecido con header X-Admin-Token. Token de
// ?token= o input. Vista sobria y cuidada: nombre, última ubicación, fuente.
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
  return d.toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' });
};

const nombre = (o) => o?.nombre_completo || o?.nombreCompleto || o?.nombre || 'Sin nombre';
const ubicacion = (o) => o?.ultima_ubicacion || o?.ultimaUbicacion || o?.parroquia || '';
const fuente = (o) => o?.fuente_url || o?.fuenteUrl || '';

export default function FallecidosPage() {
  const [token, setToken] = useState(tokenDeUrl);
  const [input, setInput] = useState('');
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState(token ? 'loading' : 'idle'); // idle | loading | ready | error | denied

  useEffect(() => {
    if (!token) return undefined;
    let vivo = true;
    setStatus('loading');
    http
      .get('/intel/personas', { params: { estado: 'fallecido', limit: 500 }, headers: { 'X-Admin-Token': token } })
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
        <h1 className="mb-1 text-lg font-bold text-slate-900">Fallecidos</h1>
        <p className="mb-4 text-xs text-slate-500">
          {status === 'denied' ? 'Token inválido. Inténtalo de nuevo.' : 'Vista privada. Ingresa el token de administrador.'}
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (input.trim()) setToken(input.trim());
          }}
          className="space-y-2"
        >
          <label htmlFor="fall-token" className="sr-only">Token de administrador</label>
          <input
            id="fall-token"
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
            Ver
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl p-4 sm:p-6">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <h1 className="text-xl font-bold text-slate-900">Fallecidos</h1>
        {status === 'ready' && (
          <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-slate-600">
            {items.length}
          </span>
        )}
      </div>
      <p className="mb-5 text-xs text-slate-500">Vista privada · no aparece en el directorio público.</p>

      {status === 'loading' && <p className="py-12 text-center text-sm text-slate-500" aria-live="polite">Cargando…</p>}
      {status === 'error' && (
        <p className="py-12 text-center text-sm text-red-600" aria-live="polite">No se pudo cargar la lista.</p>
      )}
      {status === 'ready' && items.length === 0 && (
        <p className="py-12 text-center text-sm text-slate-500">No hay registros.</p>
      )}

      {status === 'ready' && items.length > 0 && (
        <ul className="divide-y divide-slate-200 rounded-xl bg-white ring-1 ring-slate-200">
          {items.map((p, i) => (
            <li key={p.id ?? i} className="px-4 py-3">
              <div className="text-sm font-semibold text-slate-900">{nombre(p)}</div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                {ubicacion(p) && <span>{ubicacion(p)}</span>}
                {fmtFecha(p.fecha_reporte || p.fechaReporte) && <span>{fmtFecha(p.fecha_reporte || p.fechaReporte)}</span>}
                {fuente(p) && (
                  <a href={fuente(p)} target="_blank" rel="noopener noreferrer" className="font-semibold text-slate-600 hover:underline">
                    Fuente
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
