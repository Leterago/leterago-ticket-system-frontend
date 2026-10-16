import { Search, ChevronLeft, ChevronRight, ChevronDown, Check, Eye, CalendarRange } from "lucide-react";
import { getInitials } from "../../lib/initials";
import { formatDate } from "../../lib/formatDate";
import { useMemo, useState, useRef, useEffect } from "react";
import type { Ticket } from "../../types/types";
import Badged from "../Atoms/Badged";
import { useAppSelector, useCurrentUser, useAppDispatch } from "../../store/hooks";
import { useNavigate } from "react-router-dom";
import { CATEGORIES, DEPARTMENTS, DEPARTMENT_IDS_WITH_CATEGORIES, getCategoriesForDepartments } from "../../config/catalog";
import type { DepartmentId } from "../../types/types";
import { updateTicketAsync, rateTicketAsync } from "../../store/ticketsSlice";
import { canConfirm, canRemindConfirm, canSeeAllTickets, viewableDepartmentIds } from "../../store/permissions";
import ConfirmReminderButton from "../Organisms/ConfirmReminderButton";
import { addDays, toYmd } from "../../lib/calendarDates";
import StarRating from "../Atoms/StarRating";
import Tooltip from "@mui/material/Tooltip";

const ALL_DEPT_IDS = DEPARTMENT_IDS_WITH_CATEGORIES;

// Opciones del selector "Filas por página" (vista compacta). Elegir más filas
// renderiza más y, al no haber alto fijo, agranda la tabla automáticamente.
const PAGE_SIZE_OPTIONS = [8, 15, 25, 50, 100];
const DEFAULT_PAGE_SIZE = 8;

function TicketsTable({ viewMode = "compact" }: { viewMode?: "compact" | "extended" }) {
  const { tickets } = useAppSelector((s) => s.tickets);
  const currentUser = useCurrentUser();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [confirming, setConfirming] = useState<Set<string>>(new Set());
  const [ratingIds, setRatingIds] = useState<Set<string>>(new Set());

  // Departamentos visibles (para el filtro y el scoping): todos si ve_all, si no los
  // departamentos donde su rol concede view_department. Por permiso, sin nombres de rol.
  const workingDeptIds: DepartmentId[] = canSeeAllTickets(currentUser)
    ? ALL_DEPT_IDS
    : viewableDepartmentIds(currentUser);

  const visible: Ticket[] = useMemo(() => {
    if (canSeeAllTickets(currentUser)) return tickets;
    const accessibleCats = getCategoriesForDepartments(workingDeptIds);
    return tickets.filter(
      (t) =>
        accessibleCats.includes(t.categoryId) ||
        t.createdById === currentUser.id ||
        t.assignedToId === currentUser.id,
    );
  }, [tickets, currentUser]); // eslint-disable-line react-hooks/exhaustive-deps

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [deptFilter, setDeptFilter] = useState("all");
  const [dateRange, setDateRange] = useState<DateRange>(EMPTY_RANGE);
  // Vista extendida: filtra "Pendiente de Confirmación" por solicitante (createdById),
  // p. ej. para dejar solo los tickets de una persona y enviarle una captura.
  const [pendingRequester, setPendingRequester] = useState("all");
  const [page, setPage] = useState(1);
  // Filas por página elegidas por el usuario; se recuerda entre recargas.
  const [pageSize, setPageSize] = useState<number>(() => {
    const saved = Number(localStorage.getItem("mesa_tickets_page_size"));
    return PAGE_SIZE_OPTIONS.includes(saved) ? saved : DEFAULT_PAGE_SIZE;
  });
  useEffect(() => {
    localStorage.setItem("mesa_tickets_page_size", String(pageSize));
  }, [pageSize]);

  const filtered = useMemo(() => {
    return visible.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (priorityFilter !== "all" && r.priority !== priorityFilter) return false;
      if (deptFilter !== "all" && r.departmentId !== deptFilter) return false;
      if (!inRange(r.createdAt, dateRange)) return false;
      const q = search.toLowerCase();
      return (
        r.id.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q) ||
        (r.assignedTo || "").toLowerCase().includes(q)
      );
    });
  }, [visible, search, statusFilter, priorityFilter, deptFilter, dateRange]);

  // Extended view: same filters but no status filter (statuses become sections)
  const filteredExtended = useMemo(() => {
    return visible.filter((r) => {
      if (priorityFilter !== "all" && r.priority !== priorityFilter) return false;
      if (deptFilter !== "all" && r.departmentId !== deptFilter) return false;
      if (!inRange(r.createdAt, dateRange)) return false;
      const q = search.toLowerCase();
      return (
        r.id.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q) ||
        (r.assignedTo || "").toLowerCase().includes(q)
      );
    });
  }, [visible, search, priorityFilter, deptFilter, dateRange]);

  const resolvedTickets = useMemo(
    () => filteredExtended.filter((t) => t.status === "completed"),
    [filteredExtended],
  );
  // Solicitantes con tickets pendientes de confirmar (por id; el nombre es solo etiqueta),
  // de más a menos tickets.
  const pendingRequesters = useMemo(() => {
    const byId = new Map<string, { name: string; count: number }>();
    for (const t of resolvedTickets) {
      const r = byId.get(t.createdById) ?? { name: t.createdBy, count: 0 };
      r.count += 1;
      byId.set(t.createdById, r);
    }
    return [...byId.entries()]
      .map(([id, r]) => ({ id, ...r }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [resolvedTickets]);
  const pendingTickets = useMemo(
    () => (pendingRequester === "all" ? resolvedTickets : resolvedTickets.filter((t) => t.createdById === pendingRequester)),
    [resolvedTickets, pendingRequester],
  );
  const pendingRequesterName =
    pendingRequester === "all"
      ? null
      : pendingRequesters.find((r) => r.id === pendingRequester)?.name
        ?? tickets.find((t) => t.createdById === pendingRequester)?.createdBy
        ?? null;
  const confirmedTickets = useMemo(
    () => filteredExtended.filter((t) => t.status === "confirmed"),
    [filteredExtended],
  );
  const activeTickets = useMemo(
    () => filteredExtended.filter((t) => t.status !== "completed" && t.status !== "confirmed"),
    [filteredExtended],
  );

  const handleConfirm = async (ticket: Ticket, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirming.has(ticket.id)) return;
    setConfirming((prev) => new Set([...prev, ticket.id]));
    try {
      await dispatch(updateTicketAsync({ id: ticket.id, changes: { status: "confirmed" } }));
    } finally {
      setConfirming((prev) => {
        const next = new Set(prev);
        next.delete(ticket.id);
        return next;
      });
    }
  };

  const handleRate = async (ticket: Ticket, value: number) => {
    if (ratingIds.has(ticket.id)) return;
    setRatingIds((prev) => new Set([...prev, ticket.id]));
    try {
      await dispatch(rateTicketAsync({ id: ticket.id, value, comment: ticket.rating?.comment ?? undefined }));
    } finally {
      setRatingIds((prev) => {
        const next = new Set(prev);
        next.delete(ticket.id);
        return next;
      });
    }
  };

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const rows = filtered.slice((page - 1) * pageSize, page * pageSize);

  const showDeptFilter = workingDeptIds.length > 1;

  const hasDateRange = !!(dateRange.from || dateRange.to);
  const hasActiveFilters = search || priorityFilter !== "all" || deptFilter !== "all" || hasDateRange || pendingRequester !== "all";
  const hasActiveFiltersCompact = search || statusFilter !== "all" || priorityFilter !== "all" || deptFilter !== "all" || hasDateRange;

  // ── Extended view ──────────────────────────────────────────────────────────
  if (viewMode === "extended") {
    return (
      <div className="flex flex-col gap-5">
        {/* Shared filter bar */}
        <div className="flex flex-wrap items-center gap-3 p-4 bg-white border border-gray-200 rounded-lg">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-300" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por ID, título o responsable..."
              className="w-full rounded-md border border-gray-200 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#0047AC] transition-all"
            />
          </div>

          {showDeptFilter && (
            <FilterSelect
              value={deptFilter}
              onChange={setDeptFilter}
              label="Área"
              className="w-56"
              options={[
                { value: "all", label: "Todos los departamentos" },
                ...workingDeptIds.map((dId) => ({ value: dId, label: DEPARTMENTS[dId].label })),
              ]}
            />
          )}

          <DateRangeFilter value={dateRange} onChange={setDateRange} />

          <FilterSelect
            value={priorityFilter}
            onChange={setPriorityFilter}
            label="Prioridad"
            className="w-36"
            options={[
              { value: "all",    label: "Todas" },
              { value: "urgent", label: "Urgente" },
              { value: "high",   label: "Alta" },
              { value: "medium", label: "Media" },
              { value: "low",    label: "Baja" },
            ]}
          />

          {hasActiveFilters && (
            <button
              onClick={() => { setSearch(""); setPriorityFilter("all"); setDeptFilter("all"); setDateRange(EMPTY_RANGE); setPendingRequester("all"); }}
              className="text-xs text-[#0047AC] font-semibold hover:underline whitespace-nowrap"
            >
              Limpiar filtros
            </button>
          )}
        </div>

        {/* Section 1: Resueltos — pending confirmation */}
        <ExtendedSection
          title={pendingRequesterName ? `Pendiente de Confirmación · ${pendingRequesterName}` : "Pendiente de Confirmación"}
          tickets={pendingTickets}
          emptyMessage={
            pendingRequesterName
              ? `${pendingRequesterName} no tiene tickets pendientes de confirmación.`
              : "No hay tickets resueltos pendientes de confirmación."
          }
          headerExtra={
            (pendingRequesters.length > 0 || pendingRequester !== "all") && (
              <FilterSelect
                value={pendingRequester}
                onChange={setPendingRequester}
                label="Solicitante"
                className="w-64"
                options={[
                  { value: "all", label: "Todos" },
                  ...pendingRequesters.map((r) => ({ value: r.id, label: `${r.name} (${r.count})` })),
                  // Mantener la opción elegida aunque ya no le queden pendientes.
                  ...(pendingRequester !== "all" && !pendingRequesters.some((r) => r.id === pendingRequester)
                    ? [{ value: pendingRequester, label: `${pendingRequesterName ?? pendingRequester} (0)` }]
                    : []),
                ]}
              />
            )
          }
          onRowClick={(id) => navigate(`/ticket-detail/${id}`)}
          actionColumn={(ticket) => {
            const confirmButton = canConfirm(currentUser, ticket) ? (
              <button
                onClick={(e) => handleConfirm(ticket, e)}
                disabled={confirming.has(ticket.id)}
                title="Confirmar"
                className="group inline-flex items-center justify-center h-7 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {confirming.has(ticket.id) ? (
                  <span className="text-xs font-semibold text-emerald-700">Confirmando...</span>
                ) : (
                  <>
                    <span className="text-xs font-semibold text-emerald-700 group-hover:hidden">Confirmar</span>
                    <span className="hidden group-hover:block">
                      <Badged variant="confirmed" />
                    </span>
                  </>
                )}
              </button>
            ) : null;
            const remind = canRemindConfirm(currentUser, ticket);
            if (!confirmButton && !remind) return null;
            return (
              <div className="flex items-center gap-1">
                {confirmButton}
                {remind && <ConfirmReminderButton ticket={ticket} />}
              </div>
            );
          }}
          accentColor="border-l-4 border-l-emerald-400"
        />

        {/* Section 2: Solicitudes Activas */}
        <ExtendedSection
          title="Solicitudes Activas"
          tickets={activeTickets}
          emptyMessage="No hay solicitudes activas."
          onRowClick={(id) => navigate(`/ticket-detail/${id}`)}
          actionColumn={(ticket) => (
            <Tooltip title="Ver detalles" arrow>
              <button
                onClick={(e) => { e.stopPropagation(); navigate(`/ticket-detail/${ticket.id}`); }}
                className="p-1.5 rounded-md text-gray-400 hover:text-[#0047AC] hover:bg-blue-50 transition-colors"
              >
                <Eye size={16} />
              </button>
            </Tooltip>
          )}
          accentColor="border-l-4 border-l-gray-300"
        />

        {/* Section 3: Confirmados */}
        <ExtendedSection
          title="Tickets Confirmados"
          tickets={confirmedTickets}
          emptyMessage="No hay tickets confirmados."
          onRowClick={(id) => navigate(`/ticket-detail/${id}`)}
          actionColumn={(ticket) => {
            const isCreator = ticket.createdById === currentUser.id;
            return (
              <div onClick={(e) => e.stopPropagation()}>
                <StarRating
                  value={ticket.rating?.value ?? 0}
                  size={16}
                  onChange={isCreator ? (v) => handleRate(ticket, v) : undefined}
                  disabled={ratingIds.has(ticket.id)}
                />
              </div>
            );
          }}
          accentColor="border-l-4 border-l-blue-400"
        />
      </div>
    );
  }

  // ── Compact view (default) ─────────────────────────────────────────────────
  return (
    <div className="flex flex-col bg-white border border-gray-200 rounded-lg overflow-hidden">
      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 p-4 border-b border-gray-100">
        {/* Buscador reducido (deja espacio para los dropdowns a la derecha) */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-300" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar por ID, título o responsable..."
            className="w-full rounded-md border border-gray-200 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#0047AC] transition-all"
          />
        </div>

        {/* Dropdowns agrupados a la derecha; "Filas" queda al final (extremo derecho). */}
        <div className="flex flex-wrap items-center gap-3 sm:ml-auto">
          {showDeptFilter && (
            <FilterSelect
              value={deptFilter}
              onChange={(v) => { setDeptFilter(v); setPage(1); }}
              label="Área"
              className="w-56"
              options={[
                { value: "all", label: "Todos los departamentos" },
                ...workingDeptIds.map((dId) => ({ value: dId, label: DEPARTMENTS[dId].label })),
              ]}
            />
          )}

          <DateRangeFilter value={dateRange} onChange={(v) => { setDateRange(v); setPage(1); }} />

          <FilterSelect
            value={priorityFilter}
            onChange={(v) => { setPriorityFilter(v); setPage(1); }}
            label="Prioridad"
            className="w-36"
            options={[
              { value: "all",    label: "Todas" },
              { value: "urgent", label: "Urgente" },
              { value: "high",   label: "Alta" },
              { value: "medium", label: "Media" },
              { value: "low",    label: "Baja" },
            ]}
          />

          <FilterSelect
            value={statusFilter}
            onChange={(v) => { setStatusFilter(v); setPage(1); }}
            label="Estado"
            className="w-44"
            options={[
              { value: "all",         label: "Todos" },
              { value: "pending",     label: "Pendiente" },
              { value: "in_progress", label: "En progreso" },
              { value: "completed",   label: "Resuelto" },
              { value: "confirmed",   label: "Confirmado" },
              { value: "canceled",    label: "Cancelado" },
            ]}
          />

          {hasActiveFiltersCompact && (
            <button
              onClick={() => { setSearch(""); setStatusFilter("all"); setPriorityFilter("all"); setDeptFilter("all"); setDateRange(EMPTY_RANGE); setPage(1); }}
              className="text-xs text-[#0047AC] font-semibold hover:underline whitespace-nowrap"
            >
              Limpiar filtros
            </button>
          )}

          <FilterSelect
            value={String(pageSize)}
            onChange={(v) => { setPageSize(Number(v)); setPage(1); }}
            label="Filas"
            className="w-32"
            options={PAGE_SIZE_OPTIONS.map((n) => ({ value: String(n), label: String(n) }))}
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <Th>ID</Th>
              <Th>Título</Th>
              <Th>Creado por</Th>
              <Th>Departamento / Categoría</Th>
              <Th center>Prioridad</Th>
              <Th>Asignado a</Th>
              <Th center>Estado</Th>
              <Th>Fecha de creación</Th>
              <Th center>Acción</Th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center py-16 text-gray-400 text-sm">
                  No se encontraron tickets con los filtros aplicados.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <TicketRow
                key={row.id}
                row={row}
                onClick={() => navigate(`/ticket-detail/${row.id}`)}
                action={canRemindConfirm(currentUser, row) ? <ConfirmReminderButton ticket={row} /> : null}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-xs text-gray-500">
        <span>
          {filtered.length === 0
            ? "0 registros"
            : `Mostrando ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, filtered.length)} de ${filtered.length} registros`}
        </span>
        <div className="flex items-center gap-2">
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            className="p-1.5 rounded border border-gray-200 disabled:opacity-30 hover:bg-gray-50 transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`w-7 h-7 rounded text-xs font-medium transition-colors ${
                p === page ? "bg-[#0047AC] text-white" : "hover:bg-gray-100 text-gray-600"
              }`}
            >
              {p}
            </button>
          ))}
          <button
            disabled={page === totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="p-1.5 rounded border border-gray-200 disabled:opacity-30 hover:bg-gray-50 transition-colors"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Shared row component ───────────────────────────────────────────────────────

function TicketRow({ row, onClick, action }: { row: Ticket; onClick: () => void; action?: React.ReactNode }) {
  const dept = DEPARTMENTS[row.departmentId];
  const cat = CATEGORIES[row.categoryId];
  return (
    <tr
      className="border-b border-gray-50 hover:bg-blue-50/40 transition-colors cursor-pointer group"
      onClick={onClick}
    >
      <Td>
        <span className="text-[#0047AC] font-bold text-xs font-mono">{row.id}</span>
      </Td>
      <Td>
        <span className="text-gray-900 font-semibold text-sm line-clamp-1 max-w-52 block">{row.title}</span>
        {row.description && (
          <p className="text-gray-400 text-xs line-clamp-1 max-w-52">{row.description}</p>
        )}
      </Td>
      <Td>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-blue-100 text-[#0047AC] text-xs font-bold flex items-center justify-center shrink-0">
            {getInitials(row.createdBy)}
          </div>
          <span className="text-gray-700 text-xs whitespace-nowrap">{row.createdBy}</span>
        </div>
      </Td>
      <Td>
        <div className="flex flex-col gap-0.5">
          <span className="text-gray-700 text-xs font-semibold">{dept?.label ?? row.departmentId}</span>
          <span className="text-gray-400 text-xs">{cat?.label ?? row.categoryId}</span>
        </div>
      </Td>
      <Td><div className="flex justify-center"><Badged variant={row.priority} /></div></Td>
      <Td>
        {row.assignedTo ? (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#0047AC] text-white text-xs font-bold flex items-center justify-center shrink-0">
              {getInitials(row.assignedTo)}
            </div>
            <span className="text-gray-700 text-xs whitespace-nowrap">{row.assignedTo}</span>
          </div>
        ) : (
          <span className="text-gray-400 text-xs italic">Sin asignar</span>
        )}
      </Td>
      <Td><div className="flex justify-center"><Badged variant={row.status} /></div></Td>
      <Td>
        <span className="text-gray-500 text-xs whitespace-nowrap">{formatDate(row.createdAt)}</span>
      </Td>
      <Td><div className="flex justify-center">{action}</div></Td>
    </tr>
  );
}

// ── Extended section ───────────────────────────────────────────────────────────

function ExtendedSection({
  title,
  tickets,
  emptyMessage,
  onRowClick,
  actionColumn,
  accentColor,
  headerExtra,
}: {
  title: string;
  tickets: Ticket[];
  emptyMessage: string;
  onRowClick: (id: string) => void;
  actionColumn?: (ticket: Ticket) => React.ReactNode;
  accentColor?: string;
  /** Controles extra en la cabecera (p. ej. un filtro propio de la sección). */
  headerExtra?: React.ReactNode;
}) {
  const hasAction = !!actionColumn;
  return (
    <div className={`flex flex-col bg-white border border-gray-200 rounded-lg overflow-hidden ${accentColor ?? ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
        <div className="flex items-center gap-3 ml-auto">
          {headerExtra}
          <span className="text-xs text-gray-400 font-medium whitespace-nowrap">{tickets.length} ticket{tickets.length !== 1 ? "s" : ""}</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full table-fixed border-collapse text-sm">
          <colgroup>
            <col className="w-[6%]" />
            <col className="w-[19%]" />
            <col className="w-[12%]" />
            <col className="w-[14%]" />
            <col className="w-[9%]" />
            <col className="w-[12%]" />
            <col className="w-[10%]" />
            <col className="w-[9%]" />
            {hasAction && <col className="w-[9%]" />}
          </colgroup>
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <Th>ID</Th>
              <Th>Título</Th>
              <Th>Creado por</Th>
              <Th>Departamento / Categoría</Th>
              <Th center>Prioridad</Th>
              <Th>Asignado a</Th>
              <Th center>Estado</Th>
              <Th>Fecha de creación</Th>
              {hasAction && <Th center>Acción</Th>}
            </tr>
          </thead>
          <tbody>
            {tickets.length === 0 && (
              <tr>
                <td colSpan={hasAction ? 9 : 8} className="text-center py-10 text-gray-400 text-sm">
                  {emptyMessage}
                </td>
              </tr>
            )}
            {tickets.map((ticket) => {
              const dept = DEPARTMENTS[ticket.departmentId];
              const cat = CATEGORIES[ticket.categoryId];
              const action = actionColumn ? actionColumn(ticket) : null;
              return (
                <tr
                  key={ticket.id}
                  className="border-b border-gray-50 hover:bg-blue-50/40 transition-colors cursor-pointer"
                  onClick={() => onRowClick(ticket.id)}
                >
                  <Td>
                    <span className="text-[#0047AC] font-bold text-xs font-mono">{ticket.id}</span>
                  </Td>
                  <Td>
                    <span className="text-gray-900 font-semibold text-sm line-clamp-1 block">{ticket.title}</span>
                    {ticket.description && (
                      <p className="text-gray-400 text-xs line-clamp-1">{ticket.description}</p>
                    )}
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-[#0047AC] text-xs font-bold flex items-center justify-center shrink-0">
                        {getInitials(ticket.createdBy)}
                      </div>
                      <span className="text-gray-700 text-xs truncate">{ticket.createdBy}</span>
                    </div>
                  </Td>
                  <Td>
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="text-gray-700 text-xs font-semibold truncate">{dept?.label ?? ticket.departmentId}</span>
                      <span className="text-gray-400 text-xs truncate">{cat?.label ?? ticket.categoryId}</span>
                    </div>
                  </Td>
                  <Td><div className="flex justify-center"><Badged variant={ticket.priority} /></div></Td>
                  <Td>
                    {ticket.assignedTo ? (
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-[#0047AC] text-white text-xs font-bold flex items-center justify-center shrink-0">
                          {getInitials(ticket.assignedTo)}
                        </div>
                        <span className="text-gray-700 text-xs truncate">{ticket.assignedTo}</span>
                      </div>
                    ) : (
                      <span className="text-gray-400 text-xs italic">Sin asignar</span>
                    )}
                  </Td>
                  <Td><div className="flex justify-center"><Badged variant={ticket.status} /></div></Td>
                  <Td>
                    <span className="text-gray-500 text-xs whitespace-nowrap">{formatDate(ticket.createdAt)}</span>
                  </Td>
                  {hasAction && (
                    <Td>
                      <div className="flex justify-center">{action}</div>
                    </Td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Primitives ─────────────────────────────────────────────────────────────────

const Th = ({ children, center }: { children?: React.ReactNode; center?: boolean }) => (
  <th className={`px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400 ${center ? "text-center" : "text-left"}`}>
    {children}
  </th>
);

const Td = ({ children }: { children?: React.ReactNode }) => (
  <td className="px-4 py-3">{children}</td>
);

interface FilterOption { value: string; label: string; }

function FilterSelect({ value, onChange, label, options, className }: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  options: FilterOption[];
  className?: string;
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

  const selected = options.find((o) => o.value === value) ?? options[0];
  const isDefault = value === options[0]?.value;

  return (
    <div ref={ref} className={`relative ${className ?? ""}`}>
      <div
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between gap-2 rounded-lg border bg-white py-[9px] px-3 text-sm cursor-pointer transition-colors ${
          open
            ? "border-[#0047AC] ring-2 ring-[#0047AC]/10"
            : "border-gray-300 hover:border-gray-400"
        }`}
      >
        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap shrink-0">{label}:</span>
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`truncate ${isDefault ? "text-gray-500" : "text-gray-800 font-medium"}`}>{selected?.label}</span>
          <ChevronDown
            size={13}
            className={`text-gray-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          />
        </div>
      </div>

      {open && (
        <ul className="absolute top-full z-50 mt-1 min-w-full w-max max-h-56 overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {options.map((opt) => {
            const active = opt.value === value;
            return (
              <li
                key={opt.value}
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={`flex items-center gap-2.5 cursor-pointer px-3 py-2 text-sm whitespace-nowrap transition-colors ${
                  active
                    ? "bg-blue-50 text-[#0047AC] font-medium"
                    : "text-gray-700 hover:bg-gray-200"
                }`}
              >
                <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                  active ? "border-[#0047AC] bg-[#0047AC]" : "border-gray-300 bg-white"
                }`}>
                  {active && <Check size={9} className="text-white" strokeWidth={2.5} />}
                </div>
                {opt.label}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ── Filtro por rango de fechas (fecha de creación) ─────────────────────────────

type DateRange = { from: string; to: string }; // YYYY-MM-DD; "" = sin límite
const EMPTY_RANGE: DateRange = { from: "", to: "" };

function inRange(createdAt: string, range: DateRange): boolean {
  if (!range.from && !range.to) return true;
  const d = toYmd(new Date(createdAt)); // día local de creación
  if (range.from && d < range.from) return false;
  if (range.to && d > range.to) return false;
  return true;
}

function datePresets(): { key: string; label: string; range: DateRange }[] {
  const today = new Date();
  const t = toYmd(today);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const prevMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const prevMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
  return [
    { key: "today", label: "Hoy",             range: { from: t, to: t } },
    { key: "7d",    label: "Últimos 7 días",  range: { from: toYmd(addDays(today, -6)), to: t } },
    { key: "30d",   label: "Últimos 30 días", range: { from: toYmd(addDays(today, -29)), to: t } },
    { key: "month", label: "Este mes",        range: { from: toYmd(monthStart), to: t } },
    { key: "prev",  label: "Mes pasado",      range: { from: toYmd(prevMonthStart), to: toYmd(prevMonthEnd) } },
    { key: "year",  label: "Este año",        range: { from: `${today.getFullYear()}-01-01`, to: t } },
  ];
}

/** "2026-10-05" → "05/10/26" */
const shortDate = (ymd: string) => {
  const [y, m, d] = ymd.split("-");
  return `${d}/${m}/${y.slice(2)}`;
};

function dateRangeLabel(range: DateRange): string {
  if (!range.from && !range.to) return "Todas";
  const preset = datePresets().find((p) => p.range.from === range.from && p.range.to === range.to);
  if (preset) return preset.label;
  if (range.from && range.to) {
    return range.from === range.to ? shortDate(range.from) : `${shortDate(range.from)} – ${shortDate(range.to)}`;
  }
  return range.from ? `Desde ${shortDate(range.from)}` : `Hasta ${shortDate(range.to)}`;
}

function DateRangeFilter({ value, onChange }: { value: DateRange; onChange: (v: DateRange) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const active = !!(value.from || value.to);
  const invalid = !!(value.from && value.to && value.from > value.to);
  const dateInput =
    "w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-sm outline-none focus:border-[#0047AC]";

  return (
    <div ref={ref} className="relative">
      <div
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center justify-between gap-2 rounded-lg border bg-white py-[9px] px-3 text-sm cursor-pointer transition-colors ${
          open ? "border-[#0047AC] ring-2 ring-[#0047AC]/10" : "border-gray-300 hover:border-gray-400"
        }`}
      >
        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">Fecha:</span>
        <div className="flex items-center gap-1.5 min-w-0">
          <CalendarRange size={13} className={active ? "text-[#0047AC]" : "text-gray-400"} />
          <span className={`truncate whitespace-nowrap ${active ? "text-gray-800 font-medium" : "text-gray-500"}`}>
            {dateRangeLabel(value)}
          </span>
          <ChevronDown size={13} className={`text-gray-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        </div>
      </div>

      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 w-72 rounded-lg border border-gray-200 bg-white shadow-lg p-3 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-1.5">
            {datePresets().map((p) => {
              const on = p.range.from === value.from && p.range.to === value.to;
              return (
                <button
                  type="button"
                  key={p.key}
                  onClick={() => { onChange(p.range); setOpen(false); }}
                  className={`px-2.5 py-1.5 rounded-md text-xs font-medium text-left transition-colors ${
                    on ? "bg-blue-50 text-[#0047AC]" : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          <div className="border-t border-gray-100 pt-3 grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
              Desde
              <input
                type="date"
                value={value.from}
                max={value.to || undefined}
                onChange={(e) => onChange({ ...value, from: e.target.value })}
                className={dateInput}
              />
            </label>
            <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
              Hasta
              <input
                type="date"
                value={value.to}
                min={value.from || undefined}
                onChange={(e) => onChange({ ...value, to: e.target.value })}
                className={dateInput}
              />
            </label>
          </div>
          {invalid && <p className="text-xs text-red-500">La fecha "Desde" debe ser anterior a "Hasta".</p>}
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-gray-400">Por fecha de creación</span>
            {active && (
              <button
                type="button"
                onClick={() => { onChange(EMPTY_RANGE); setOpen(false); }}
                className="text-xs text-[#0047AC] font-semibold hover:underline"
              >
                Quitar fechas
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default TicketsTable;
