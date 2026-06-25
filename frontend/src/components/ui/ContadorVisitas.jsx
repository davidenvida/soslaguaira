// Contador discreto de visitas. Lee api.visitasResumen() al montar y lo muestra
// como texto sutil (total + hoy). Si el endpoint no responde, no renderiza nada
// (no estorba). Pensado para el pie de página o una esquina del header.
import { useEffect, useState } from 'react';
import * as api from '../../api';

export default function ContadorVisitas({ className = '' }) {
  const [resumen, setResumen] = useState(null);

  useEffect(() => {
    if (typeof api.visitasResumen !== 'function') return undefined;
    let vivo = true;
    api
      .visitasResumen()
      .then((r) => {
        if (vivo && r) setResumen(r);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  if (!resumen) return null;
  const total = resumen.total ?? 0;
  const hoy = resumen.hoy ?? null;

  return (
    <span className={`inline-flex items-center gap-1 text-xs text-slate-400 ${className}`} title="Visitas al sitio">
      <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 5c-5 0-9.27 3.11-11 7 1.73 3.89 6 7 11 7s9.27-3.11 11-7c-1.73-3.89-6-7-11-7zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" />
      </svg>
      {total.toLocaleString('es-VE')} visitas{hoy != null ? ` · ${hoy} hoy` : ''}
    </span>
  );
}
