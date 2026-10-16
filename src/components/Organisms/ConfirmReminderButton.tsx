import { useState } from "react";
import { BellRing, Clock, Loader2 } from "lucide-react";
import Tooltip from "@mui/material/Tooltip";
import { api, ApiError } from "../../api/client";
import { useAppDispatch, useCurrentUser } from "../../store/hooks";
import { notify } from "../../store/notificationsSlice";
import { fetchTicketDetailAsync, setConfirmReminder } from "../../store/ticketsSlice";
import { formatRelative } from "../../lib/formatDate";
import type { Ticket } from "../../types/types";

type Props = {
  ticket: Ticket;
  /** "icon": solo icono (tablas); "full": botón con texto (detalle). */
  variant?: "icon" | "full";
  /** Se llama tras un envío correcto (p. ej. para refrescar la actividad). */
  onSent?: () => void;
};

/** Horas que faltan hasta `iso` (redondeando hacia arriba), o 0 si ya pasó. */
function hoursUntil(iso: string | null | undefined): number {
  if (!iso) return 0;
  const ms = new Date(iso).getTime() - Date.now();
  return ms > 0 ? Math.ceil(ms / 3_600_000) : 0;
}

/**
 * "Recordar confirmar": envía al solicitante un correo para que confirme el ticket
 * resuelto. Se confirma calificando, y el correo trae enlaces para hacerlo sin
 * iniciar sesión. Mostrarlo solo si `canRemindConfirm(user, ticket)`.
 *
 * Límite anti-spam: un recordatorio cada 24 h por ticket. El backend manda
 * `nextConfirmReminderAt` con cada ticket; mientras no llegue esa hora el botón
 * queda desactivado y explica cuándo se envió el último y cuándo podrá enviarse otro.
 */
export default function ConfirmReminderButton({ ticket, variant = "icon", onSent }: Props) {
  const dispatch = useAppDispatch();
  const currentUser = useCurrentUser();
  const [sending, setSending] = useState(false);

  const waitHours = hoursUntil(ticket.nextConfirmReminderAt);
  const cooling = waitHours > 0;
  const lastAgo = ticket.lastConfirmReminderAt ? formatRelative(new Date(ticket.lastConfirmReminderAt).getTime()) : null;
  const coolText = `Recordatorio enviado ${lastAgo ?? "recientemente"}. Podrás enviar otro en ${waitHours} h.`;

  const send = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (sending || cooling) return;
    setSending(true);
    try {
      const res = await api.sendConfirmReminder(currentUser.id, ticket.id);
      dispatch(setConfirmReminder({
        id: ticket.id,
        lastConfirmReminderAt: res.lastConfirmReminderAt,
        nextConfirmReminderAt: res.nextConfirmReminderAt,
      }));
      dispatch(notify({
        kind: "success",
        title: "Recordatorio enviado",
        message: `${ticket.id}: se pidió a ${ticket.createdBy} (${res.sentTo}) que confirme la solicitud.`,
        link: `/ticket-detail/${ticket.id}`,
      }));
      onSent?.();
    } catch (err) {
      const limited = err instanceof ApiError && err.status === 429;
      // Otro usuario lo envió hace poco: refrescar el ticket para mostrar la espera.
      if (limited) dispatch(fetchTicketDetailAsync(ticket.id));
      dispatch(notify({
        kind: limited ? "warning" : "error",
        title: "No se envió el recordatorio",
        message: err instanceof ApiError ? err.message : "Error de red",
      }));
    } finally {
      setSending(false);
    }
  };

  const icon = sending ? <Loader2 size={14} className="animate-spin" /> : cooling ? <Clock size={14} /> : <BellRing size={14} />;

  if (variant === "full") {
    return (
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={send}
          disabled={sending || cooling}
          className="w-full flex items-center justify-center gap-2 border border-[#0047AC] text-[#0047AC] rounded-md px-3 py-2 text-sm font-semibold hover:bg-blue-50 disabled:opacity-60 disabled:cursor-default disabled:hover:bg-transparent transition-colors"
        >
          {icon}
          {sending ? "Enviando..." : cooling ? `Disponible en ${waitHours} h` : "Recordar confirmar"}
        </button>
        {cooling ? (
          <p className="text-xs text-gray-500">{coolText}</p>
        ) : lastAgo ? (
          <p className="text-xs text-gray-400">Último recordatorio: {lastAgo}.</p>
        ) : null}
      </div>
    );
  }

  return (
    <Tooltip title={cooling ? coolText : `Recordar a ${ticket.createdBy} que confirme (correo)`} arrow>
      <span className="inline-flex">
        <button
          type="button"
          onClick={send}
          disabled={sending || cooling}
          aria-label={cooling ? coolText : "Recordar confirmar"}
          className={`p-1.5 rounded-md transition-colors disabled:cursor-default ${
            cooling ? "text-gray-300" : "text-gray-400 hover:text-[#0047AC] hover:bg-blue-50"
          }`}
        >
          {icon}
        </button>
      </span>
    </Tooltip>
  );
}
