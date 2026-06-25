import { useEffect, useState } from 'react';
import { mockGetMatch, estadoLabel, distanciaKm } from './mockData';
import { EstadoBadge } from './PersonSearch';

/**
 * Vista de MATCH: dada una persona (un "busco"), muestra las coincidencias
 * con reportes "a salvo" (o viceversa). Usa GET /api/personas/:id/match.
 *
 * Props:
 *  - persona            -> objeto persona origen (al menos { id, nombre, lat, lng }).
 *  - fetchMatch(id)     -> Promise<Array<{...persona, score?}>>.
 *                          Cablear con api.js -> matchPersona. Devuelve array directo. Default: mock.
 *  - onContactar(match) -> opcional, al tocar "Contactar".
 *  - onVerEnMapa(match) -> opcional, al tocar "Ver en mapa".
 */
export default function MatchView({ persona, fetchMatch = mockGetMatch, onContactar, onVerEnMapa }) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!persona?.id) return;
    let activo = true;
    setLoading(true);
    setError(null);
    fetchMatch(persona.id)
      .then((data) => {
        if (!activo) return;
        // Backend: { base, matches }. Robusto si api.js ya extrae el array.
        const lista = Array.isArray(data) ? data : data?.matches ?? [];
        setMatches(lista);
      })
      .catch(() => activo && setError('Error de conexión. Reintenta.'))
      .finally(() => activo && setLoading(false));
    return () => {
      activo = false;
    };
  }, [persona?.id, fetchMatch]);

  if (!persona) return null;

  return (
    <section className="w-full max-w-xl mx-auto p-3 sm:p-4" aria-label="Coincidencias">
      <header className="mb-3">
        <p className="text-xs uppercase tracking-wide text-slate-400">Coincidencias para</p>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-slate-800 truncate">{persona.nombre}</h2>
          <EstadoBadge estado={persona.estado} />
        </div>
      </header>

      <div aria-live="polite">
        {loading && <p className="text-sm text-slate-500 py-6 text-center" role="status">Buscando coincidencias…</p>}

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        {!loading && !error && matches.length === 0 && (
          <p className="rounded-lg bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">
            Aún no hay coincidencias. El sistema sigue cruzando reportes.
          </p>
        )}

        <ul className="space-y-3">
          {matches.map((m) => {
            // distance_meters del backend; fallback a cálculo local (mock viejo).
            const metros = m.distance_meters != null
              ? m.distance_meters
              : persona.lat != null && m.lat != null
                ? Math.round(distanciaKm(persona.lat, persona.lng, m.lat, m.lng) * 1000)
                : null;
            return (
              <li key={m.id} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                <div className="flex items-center gap-3">
                  <Foto m={m} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-800 truncate">{m.nombre}</p>
                      <ScoreBadge score={m.match_score} />
                    </div>
                    <p className="text-xs text-slate-500 truncate">
                      {estadoLabel(m.estado)}
                      {m.direccion ? ` · ${m.direccion}` : ''}
                      {metros != null ? ` · ${metros < 1000 ? `${metros} m` : `${(metros / 1000).toFixed(1)} km`}` : ''}
                    </p>
                  </div>
                </div>

                {m.descripcion && <p className="mt-2 text-sm text-slate-600">{m.descripcion}</p>}

                <div className="mt-3 flex flex-wrap gap-2">
                  {m.contacto_telefono && (
                    <a
                      href={`tel:${m.contacto_telefono.replace(/[^+\d]/g, '')}`}
                      onClick={() => onContactar?.(m)}
                      className="flex-1 min-w-[8rem] text-center rounded-xl bg-emerald-600 px-3 py-2.5 text-sm font-semibold text-white active:bg-emerald-700"
                    >
                      Llamar {m.contacto_nombre ? `a ${m.contacto_nombre.split(' ')[0]}` : ''}
                    </a>
                  )}
                  {onVerEnMapa && m.lat != null && (
                    <button
                      type="button"
                      onClick={() => onVerEnMapa(m)}
                      className="flex-1 min-w-[8rem] rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-semibold text-slate-700 active:bg-slate-50"
                    >
                      Ver en mapa
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function Foto({ m }) {
  if (m.foto_url) {
    return <img src={m.foto_url} alt={`Foto de ${m.nombre}`} className="h-12 w-12 rounded-full object-cover bg-slate-100 shrink-0" loading="lazy" />;
  }
  const ini = m.nombre.split(/\s+/).slice(0, 2).map((s) => s[0]).join('').toUpperCase();
  return (
    <span aria-hidden="true" className="h-12 w-12 rounded-full bg-emerald-100 text-emerald-700 grid place-items-center text-sm font-semibold shrink-0">
      {ini}
    </span>
  );
}

function ScoreBadge({ score }) {
  if (score == null) return null;
  // match_score viene en rango 0..1.
  const alto = score >= 0.8;
  const medio = score >= 0.5 && score < 0.8;
  const cls = alto ? 'bg-emerald-100 text-emerald-800' : medio ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600';
  const txt = alto ? 'Muy probable' : medio ? 'Probable' : 'Posible';
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>{txt}</span>;
}
