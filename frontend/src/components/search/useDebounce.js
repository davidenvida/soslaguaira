import { useEffect, useState } from 'react';

// Devuelve el valor "estabilizado" tras `delay` ms sin cambios.
// Mobile-first: evita disparar requests en cada tecla con conectividad mala.
export default function useDebounce(value, delay = 400) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debounced;
}
