// Formato de fecha/hora en hora de Venezuela (America/Caracas).
// Ej: fmtFechaHora('2026-06-26T00:08:20Z') -> '25/06/2026 8:08 pm'
export function fmtFechaHora(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = new Intl.DateTimeFormat('es-VE', {
    timeZone: 'America/Caracas',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
    .formatToParts(d)
    .reduce((acc, part) => {
      acc[part.type] = part.value;
      return acc;
    }, {});
  // dayPeriod en es-VE viene como "p. m." -> normalizamos a "pm".
  const ampm = (p.dayPeriod || '').toLowerCase().replace(/[.\s]/g, '');
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute} ${ampm}`.trim();
}
