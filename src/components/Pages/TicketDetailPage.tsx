import { useParams, useNavigate } from "react-router-dom";
import { useAppSelector, useAppDispatch, useCurrentUser } from "../../store/hooks";
import {
  updateTicketAsync,
  deleteTicketAsync,
  fetchTicketDetailAsync,
  rateTicketAsync,
} from "../../store/ticketsSlice";
import type { TicketStatus, TicketPriority } from "../../types/types";
import Badge from "../Atoms/Badged";
import {
  ArrowLeft,
  ChevronDown, Pencil, Trash2, X, Check, Settings, Download,
} from "lucide-react";
import { exportMantenimientoDocx } from "../../lib/exportMantenimiento";
import type { SolicitudMantenimientoPayload } from "../../forms/SolicitudMantenimientoForm";
import { useState, useRef, useEffect, useMemo } from "react";
import { type User as AssigneeUser } from "../Organisms/AssigneePicker";
import { canEditTicket, canChangeStatus, canAssign, canConfirm, canChangeStatusInDept } from "../../store/permissions";
import { getCategoryForm } from "../../forms/registry";
import TicketDetailsPanel from "../Organisms/TicketDetailsPanel";
import TicketRatingCard from "../Organisms/TicketRatingCard";
import TicketComments from "../Organisms/TicketComments";
import { formatDateTime } from "../../lib/formatDate";
import { api } from "../../api/client";
import type { TicketEvent } from "../../types/types";

const statusOptions: TicketStatus[] = ["pending", "in_progress", "completed", "confirmed", "canceled"];
// Avanzar el estado exige que el ticket tenga un asignado (espeja la regla del
// backend en lib/catalog.ts). "pending" y "canceled" no requieren asignado.
const STATUSES_REQUIRING_ASSIGNEE: TicketStatus[] = ["in_progress", "completed", "confirmed"];
const statusRequiresAssignee = (s: TicketStatus) => STATUSES_REQUIRING_ASSIGNEE.includes(s);
const statusLabels: Record<TicketStatus, string> = {
  pending: "Pendiente", in_progress: "En progreso", completed: "Resuelto",
  confirmed: "Confirmado", canceled: "Cancelado",
};
const priorityLabels: Record<TicketPriority, string> = {
  urgent: "Urgente", high: "Alta", medium: "Media", low: "Baja",
};

function eventDisplay(e: TicketEvent): { title: string; color: string } {
  const sl = statusLabels as Record<string, string>;
  const pl = priorityLabels as Record<string, string>;
  switch (e.type) {
    case "created":          return { title: "Ticket creado",                                color: "bg-[#0047AC]"   };
    case "status_changed":   return { title: `Estado → ${sl[e.to ?? ""] ?? e.to}`,          color: "bg-emerald-500" };
    case "assigned":         return { title: `Asignado a ${e.to}`,                          color: "bg-indigo-400"  };
    case "unassigned":       return { title: "Asignación removida",                         color: "bg-orange-400"  };
    case "priority_changed": return { title: `Prioridad → ${pl[e.to ?? ""] ?? e.to}`,       color: "bg-amber-400"   };
    case "title_changed":    return { title: "Título actualizado",                          color: "bg-gray-400"    };
    case "payload_updated":  return { title: "Detalles actualizados",                       color: "bg-purple-400"  };
    case "rated":            return { title: `Calificado con ${e.to} ★`,                    color: "bg-amber-400"   };
    default:                 return { title: e.type,                                        color: "bg-gray-400"    };
  }
}

// ─── Box-style dropdown ───────────────────────────────────────────────────────
function BoxDropdown<T extends string>({
  label, displayValue, options, optionLabels, current, onSelect,
  disabledOptions, disabledHint,
}: {
  label: string; displayValue: React.ReactNode;
  options: T[]; optionLabels: Record<T, string>;
  current: T; onSelect: (v: T) => void;
  disabledOptions?: T[]; disabledHint?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex flex-row items-center gap-3 bg-white border border-gray-300 rounded-lg px-3 py-2 hover:border-[#0047AC] hover:bg-blue-50/30 transition-colors"
      >
        <span className="text-[10px] font-bold text-gray-600 uppercase tracking-wider shrink-0">{label}</span>
        <div className="flex items-center gap-1.5">
          {displayValue}
          <ChevronDown size={13} className={`text-gray-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </button>
      {open && (
        <div className="absolute right-0 top-[calc(100%+6px)] bg-white border border-gray-300 rounded-lg shadow-sm z-50 overflow-hidden min-w-44">
          {options.map((opt) => {
            const disabled = !!disabledOptions?.includes(opt) && opt !== current;
            return (
              <button
                key={opt}
                disabled={disabled}
                title={disabled ? disabledHint : undefined}
                onClick={() => { if (disabled) return; onSelect(opt); setOpen(false); }}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between
                  ${disabled ? "opacity-40 cursor-not-allowed" : "hover:bg-gray-50"}
                  ${opt === current ? "font-semibold text-[#0047AC]" : "text-gray-700"}`}
              >
                {optionLabels[opt]}
                {opt === current && <Check size={13} className="text-[#0047AC]" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Delete modal ─────────────────────────────────────────────────────────────
function DeleteModal({
  ticketId, onConfirm, onCancel,
}: { ticketId: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-sm max-w-sm w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-gray-900">¿Eliminar ticket?</h3>
          <button onClick={onCancel} className="p-1.5 rounded hover:bg-gray-100 text-gray-400">
            <X size={16} />
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-6">
          Esta acción es permanente. El ticket{" "}
          <span className="font-bold text-gray-800 font-mono">{ticketId}</span> será eliminado.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-md text-sm font-semibold hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={onConfirm}
            className="flex-1 bg-red-500 text-white py-2.5 rounded-md text-sm font-semibold hover:bg-red-600">
            Eliminar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function TicketDetail() {
  const { id }      = useParams<{ id: string }>();
  const { tickets } = useAppSelector((s) => s.tickets);
  const currentUser = useCurrentUser();
  const allUsers    = useAppSelector((s) => s.users.list);
  const dispatch    = useAppDispatch();
  const navigate    = useNavigate();

  // Hydrate this ticket's payload (the list endpoint doesn't return it).
  useEffect(() => {
    if (id) dispatch(fetchTicketDetailAsync(id));
  }, [dispatch, id]);

  const ticket = tickets.find((t) => t.id === id) ?? tickets[0];

  // Permission flags derived from permissions.ts
  const canEdit        = ticket ? canEditTicket(currentUser, ticket)  : false;
  const canStatus      = ticket ? canChangeStatus(currentUser, ticket) : false;
  const canAssignPerm  = ticket ? canAssign(currentUser, ticket)       : false;
  const canConfirmNow  = ticket
    ? canConfirm(currentUser, ticket) && ticket.status === "completed"
    : false;

  // Rating: only the creator can rate, and only once the ticket is resolved.
  const canRate = !!ticket
    && ticket.createdById === currentUser.id
    && (ticket.status === "completed" || ticket.status === "confirmed");

  const submitRating = async (value: number, comment: string) => {
    if (!ticket || ratingSaving) return;
    setRatingSaving(true);
    try {
      await dispatch(rateTicketAsync({ id: ticket.id, value, comment }));
    } finally {
      setRatingSaving(false);
    }
  };

  // "confirmed" is gated by role + transition (only admin/master, only from "completed").
  // Always include it if it's the current value, so the select keeps a valid option.
  const allowedStatuses: TicketStatus[] = statusOptions.filter((s) => {
    if (s !== "confirmed") return true;
    if (!ticket) return false;
    return ticket.status === "confirmed" || canConfirmNow;
  });

  // Edit mode state
  const [editing,         setEditing]         = useState(false);
  const [showDelete,      setShowDelete]      = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [exporting,       setExporting]       = useState(false);
  const [ratingSaving,    setRatingSaving]    = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setShowActionsMenu(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const [events, setEvents] = useState<TicketEvent[]>([]);

  useEffect(() => {
    if (id && currentUser) {
      api.listEvents(currentUser.id, id)
        .then(setEvents)
        .catch(() => {});
    }
  }, [id, currentUser.id]);

  const [editTitle,       setEditTitle]       = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editStatus,      setEditStatus]      = useState<TicketStatus>("pending");
  const [editPriority,    setEditPriority]    = useState<TicketPriority>("medium");
  const [editAssignedTo,  setEditAssignedTo]  = useState<AssigneeUser | null>(null);
  const [editPayload,     setEditPayload]     = useState<unknown>(undefined);

  // Category-specific form (read-only by default; editable while `editing`)
  const formDef = useMemo(
    () => (ticket ? getCategoryForm(ticket.categoryId) : undefined),
    [ticket?.categoryId],
  );

  // Sugerencias del selector "Asignado a": solo quienes pueden CAMBIAR EL ESTADO
  // de tickets en el departamento del ticket (master, admin del departamento, o
  // miembro cuyo rol concede tickets.change_status). Espeja el backend.
  const assigneeUsers: AssigneeUser[] = useMemo(() => {
    if (!ticket) return [];
    return allUsers
      .filter((u) => canChangeStatusInDept(u, ticket.departmentId))
      .map((u) => ({ id: u.id, name: u.name }));
  }, [allUsers, ticket]);

  if (!ticket) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-gray-500 text-sm">Ticket no encontrado.</p>
        <button onClick={() => navigate("/tickets")}
          className="text-[#0047AC] text-sm font-semibold hover:underline">
          Volver a Tickets
        </button>
      </div>
    );
  }

  const startEdit = async () => {
    let payloadForEdit = ticket.payload;
    if (formDef && payloadForEdit == null) {
      const result = await dispatch(fetchTicketDetailAsync(ticket.id));
      if (fetchTicketDetailAsync.fulfilled.match(result)) {
        payloadForEdit = (result.payload as { payload?: unknown }).payload ?? null;
      }
    }
    setEditTitle(ticket.title);
    setEditDescription(ticket.description ?? "");
    setEditStatus(ticket.status);
    setEditPriority(ticket.priority);
    const match = ticket.assignedToId
      ? assigneeUsers.find((u) => String(u.id) === String(ticket.assignedToId)) ?? null
      : null;
    setEditAssignedTo(match);
    setEditPayload({ ...(formDef?.defaultValue as Record<string, unknown> ?? {}), ...(payloadForEdit as Record<string, unknown> ?? {}) });
    setEditing(true);
  };

  const saveEdit = async () => {
    await dispatch(updateTicketAsync({
      id: ticket.id,
      changes: {
        title:        editTitle,
        description:  editDescription,
        status:       editStatus,
        priority:     editPriority,
        assignedToId: editAssignedTo ? String(editAssignedTo.id) : null,
        payload:      formDef ? editPayload : undefined,
      },
    }));
    setEditing(false);
    api.listEvents(currentUser.id, ticket.id).then(setEvents).catch(() => {});
  };

  return (
    <>
      {showDelete && (
        <DeleteModal
          ticketId={ticket.id}
          onConfirm={() => { dispatch(deleteTicketAsync(ticket.id)); navigate("/tickets"); }}
          onCancel={() => setShowDelete(false)}
        />
      )}

      <div className="min-h-screen bg-gray-50 p-6 max-w-7xl mx-auto">

        {/* ── Top action bar ── */}
        <div className="py-2 flex items-center justify-between gap-4 flex-wrap mb-6">
          {/* Left: back + code badge */}
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => navigate(-1)}
              className="-ml-2 p-2 rounded-md hover:bg-gray-100 text-gray-500 transition-all"
            >
              <ArrowLeft size={18} />
            </button>
            {/* Ticket code badge — blue outline, same height as the status button */}
            <span className="h-[46px] flex items-center px-3 text-sm font-extrabold font-mono tracking-wider text-[#0047AC] bg-white border border-[#0047AC] rounded-lg">
              {ticket.id}
            </span>
          </div>

          {/* Right: action boxes */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Status box — visible to anyone who can change status */}
            {(canEdit || canStatus) && !editing && (
              <BoxDropdown
                label="Estado"
                displayValue={<Badge variant={ticket.status} />}
                options={allowedStatuses}
                optionLabels={statusLabels}
                current={ticket.status}
                disabledOptions={ticket.assignedToId ? undefined : STATUSES_REQUIRING_ASSIGNEE}
                disabledHint="Asigna el ticket a alguien antes de avanzar su estado."
                onSelect={async (s) => {
                  if (!ticket.assignedToId && statusRequiresAssignee(s)) return;
                  await dispatch(updateTicketAsync({ id: ticket.id, changes: { status: s } }));
                  api.listEvents(currentUser.id, ticket.id).then(setEvents).catch(() => {});
                }}
              />
            )}

            {/* Actions — admin/master only */}
            {canEdit && !editing && (
              <div ref={menuRef} className="relative">
                <button
                  onClick={() => setShowActionsMenu((v) => !v)}
                  className="p-2 rounded-md hover:bg-gray-100 text-gray-500 transition-all"
                ><Settings size={24} /></button>
                {showActionsMenu && (
                  <div className="absolute right-0 top-[calc(100%+6px)] z-50 bg-white border border-gray-300 rounded-lg shadow-sm min-w-36 overflow-hidden">
                    <button
                      onClick={() => { startEdit(); setShowActionsMenu(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left"
                    >
                      <Pencil size={13} />Editar
                    </button>
                    <div className="border-t border-gray-100" />
                    <button
                      onClick={() => { setShowDelete(true); setShowActionsMenu(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors text-left"
                    >
                      <Trash2 size={13} />Eliminar
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Edit mode: Cancel + Save */}
            {editing && (
              <>
                <button
                  onClick={() => setEditing(false)}
                  className="flex items-center gap-1.5 border border-gray-300 rounded-md px-3 py-2 text-sm bg-white hover:bg-gray-50 font-semibold text-gray-600"
                >
                  <X size={13} />Cancelar
                </button>
                <button
                  onClick={saveEdit}
                  className="flex items-center gap-1.5 bg-[#0047AC] text-white rounded-md px-4 py-2 text-sm font-semibold hover:bg-blue-700"
                >
                  <Check size={13} />Guardar
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── Title ── */}
        {editing ? (
          <input
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="w-full text-2xl font-bold text-gray-900 bg-transparent border-b border-gray-300 py-2 mb-6 outline-none focus:border-[#0047AC] transition-colors"
          />
        ) : (
          <h1 className="text-2xl font-bold text-gray-900 mb-6">{ticket.title}</h1>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* ── Left ── */}
          <div className="lg:col-span-2 flex flex-col gap-4">

            {/* Description */}
            <div className="bg-white rounded-lg border border-gray-300 p-5 ">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">
                Descripción
              </p>
              {editing ? (
                <textarea
                  rows={8}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 rounded-md px-3.5 py-2.5 text-sm outline-none focus:border-[#0047AC] resize-none"
                />
              ) : (
                <p className="text-sm text-gray-600 leading-relaxed">
                  {ticket.description || "Sin descripción registrada."}
                </p>
              )}
            </div>



            {/* Category-specific form (read-only when not editing) */}
            {formDef && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between px-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                    Detalles de la solicitud
                  </p>
                  {ticket.categoryId === "solicitud-mantenimiento" && !editing && (
                    <button
                      onClick={async () => {
                        if (exporting) return;
                        setExporting(true);
                        try {
                          const merged = {
                            ...(formDef.defaultValue as Record<string, unknown>),
                            ...(ticket.payload as Record<string, unknown> ?? {}),
                          } as SolicitudMantenimientoPayload;
                          await exportMantenimientoDocx(ticket, merged);
                        } finally {
                          setExporting(false);
                        }
                      }}
                      disabled={exporting}
                      className="flex items-center gap-1.5 text-xs font-semibold text-[#0047AC] hover:text-blue-700 disabled:opacity-50 transition-colors"
                    >
                      <Download size={13} />
                      {exporting ? "Generando..." : "Descargar Word"}
                    </button>
                  )}
                </div>
                <formDef.Component
                  value={editing
                    ? editPayload
                    : { ...(formDef.defaultValue as Record<string, unknown>), ...(ticket.payload as Record<string, unknown> ?? {}) }
                  }
                  onChange={editing ? setEditPayload : () => {}}
                  readOnly={!editing}
                  showExecSection={true}
                />
              </div>
            )}

            {/* Comments */}
            <TicketComments ticketId={ticket.id} />
          </div>

          {/* ── Right ── */}
          <div className="flex flex-col gap-4">

            {/* Priority card */}
            {!editing && (() => {
              const { bg, sub } = {
                urgent: { bg: "from-[#ef4444] to-[#dc2626]", sub: "text-red-200"    },
                high:   { bg: "from-[#f97316] to-[#ea580c]", sub: "text-orange-200" },
                medium: { bg: "from-[#eab308] to-[#ca8a04]", sub: "text-yellow-100" },
                low:    { bg: "from-[#22c55e] to-[#16a34a]", sub: "text-green-200"  },
              }[ticket.priority];
              return (
                <div className={`bg-gradient-to-br ${bg} rounded-lg p-5 text-white`}>
                  <p className={`text-[10px] font-bold uppercase tracking-widest ${sub} mb-2`}>Prioridad</p>
                  <p className="text-2xl font-bold">{priorityLabels[ticket.priority]}</p>
                  <p className={`text-xs ${sub} mt-1`}>
                    {ticket.priority === "urgent" && "SLA: 1–2 horas"}
                    {ticket.priority === "high"   && "SLA: 12–24 horas"}
                    {ticket.priority === "medium" && "SLA: 2–4 días"}
                    {ticket.priority === "low"    && "SLA: 4–7 días"}
                  </p>
                </div>
              );
            })()}

            {editing ? (
              <TicketDetailsPanel
                readOnly={false}
                categoryId={ticket.categoryId}
                departmentId={ticket.departmentId}
                priority={editPriority}
                onPriorityChange={setEditPriority}
                canAssign={canAssignPerm}
                assigneeUsers={assigneeUsers}
                assignedTo={editAssignedTo}
                onAssignedToChange={setEditAssignedTo}
              />
            ) : (
              <TicketDetailsPanel
                readOnly={true}
                categoryId={ticket.categoryId}
                departmentId={ticket.departmentId}
                createdBy={ticket.createdBy}
                assignedToName={ticket.assignedTo}
                assignedToId={ticket.assignedToId}
                currentUserId={currentUser.id}
                createdAt={ticket.createdAt}
                updatedAt={ticket.updatedAt}
              />
            )}

            {/* Satisfaction rating */}
            {!editing && (
              <TicketRatingCard
                rating={ticket.rating}
                canRate={canRate}
                saving={ratingSaving}
                onSubmit={submitRating}
              />
            )}

            {/* Activity */}
            <div className="bg-white rounded-lg border border-gray-300 p-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4">
                Actividad
              </p>
              <div className="flex flex-col">
                {events.length === 0 && (
                  <p className="text-sm text-gray-400 italic">Sin actividad registrada.</p>
                )}
                {events.map((e, i) => {
                  const { title, color } = eventDisplay(e);
                  return (
                    <TimelineItem
                      key={e.id}
                      color={color}
                      title={title}
                      subtitle={`${e.user.name} · ${formatDateTime(e.createdAt)}`}
                      last={i === events.length - 1}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}


function TimelineItem({ color, title, subtitle, last }: {
  color: string; title: string; subtitle: string; last?: boolean;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className={`w-2.5 h-2.5 rounded-full ${color} shrink-0 mt-1`} />
        {!last && <div className="w-px flex-1 bg-gray-200 my-1" />}
      </div>
      <div className="pb-4">
        <p className="text-sm font-semibold text-gray-800">{title}</p>
        <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
      </div>
    </div>
  );
}
