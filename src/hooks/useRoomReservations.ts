import { useCallback, useEffect, useState } from "react";
import { api, type ServerReservation } from "../api/client";
import { useCurrentUser } from "../store/hooks";

type Result = { key: string; reservations: ServerReservation[]; error: string | null };

/**
 * Reservas activas de salones entre `from` y `to` (YYYY-MM-DD, incluidos).
 * Con `from` vacío no consulta nada.
 */
export function useRoomReservations(from: string, to: string) {
  const currentUser = useCurrentUser();
  const [nonce, setNonce] = useState(0);
  const [result, setResult] = useState<Result | null>(null);

  const enabled = !!from && !!to;
  const key = `${currentUser.id}|${from}|${to}|${nonce}`;

  useEffect(() => {
    if (!enabled) return;
    let stale = false;
    api
      .listReservations(currentUser.id, { from, to })
      .then((reservations) => { if (!stale) setResult({ key, reservations, error: null }); })
      .catch((e: unknown) => {
        if (!stale) {
          setResult({
            key,
            reservations: [],
            error: e instanceof Error ? e.message : "No se pudieron cargar las reservas",
          });
        }
      });
    return () => { stale = true; };
  }, [enabled, key, currentUser.id, from, to]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  // Mientras llega la respuesta del rango nuevo se siguen mostrando las reservas
  // anteriores (evita parpadeo al cambiar de semana).
  const current = result?.key === key ? result : null;
  return {
    reservations: enabled ? (current ?? result)?.reservations ?? [] : [],
    loading: enabled && !current,
    error: enabled ? current?.error ?? null : null,
    reload,
  };
}
