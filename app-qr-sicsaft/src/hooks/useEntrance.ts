import { useEffect, useState } from 'react';

// Dispara una transición de entrada al montar. A diferencia de @keyframes /
// @starting-style (que en este proyecto se quedan atascados en el primer
// frame — ver fix de Dialog/Sheet), esto reusa el mismo patrón que sí
// funciona ahí: cambiar una clase DESPUÉS del primer render para que sea
// una `transition` real, no una animación. Usa setTimeout en vez de
// requestAnimationFrame a propósito: rAF depende del pipeline de
// renderizado/composición, que en algunos entornos (o pestañas en segundo
// plano) puede no dispararse nunca; setTimeout no depende de eso.
export function useEntrance(): boolean {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setShown(true), 0);
    return () => clearTimeout(id);
  }, []);

  return shown;
}
