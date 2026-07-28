import { useEffect, useState } from 'react';

export interface Route {
  /** 'services' | 'service' | 'catalog' | 'logs' | 'settings' */
  name: string;
  /** id сервиса для '#service/<id>'. */
  param: string | null;
}

function parse(): Route {
  const hash = (location.hash || '#services').slice(1);
  const [name, param] = hash.split('/');
  return { name: name || 'services', param: param || null };
}

/** Навигация панели живёт в хэше: '#service/jellyfin' переживает перезагрузку. */
export function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>(parse);

  useEffect(() => {
    const onHash = (): void => {
      setRoute(parse());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  return route;
}

export function go(hash: string): void {
  location.hash = hash;
}
