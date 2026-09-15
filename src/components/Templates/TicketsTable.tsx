import { Search, ChevronLeft, ChevronRight, ChevronDown, Check, Eye } from "lucide-react";
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
import { canConfirm, canSeeAllTickets, viewableDepartmentIds } from "../../store/permissions";
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
      const q = search.toLowerCase();
      return (
        r.id.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q) ||
        (r.assignedTo || "").toLowerCase().includes(q)
      );
    });
  }, [visible, search, statusFilter, priorityFilter, deptFilter]);

  // Extended view: same filters but no status filter (statuses become sections)
  const filteredExtended = useMemo(() => {
    return visible.filter((r) => {
      if (priorityFilter !== "all" && r.priority !== priorityFilter) return false;
      if (deptFilter !== "all" && r.departmentId !== deptFilter) return false;
      const q = search.toLowerCase();
      return (
        r.id.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q) ||
        (r.assignedTo || "").toLowerCase().includes(q)
      );
    });
  }, [visible, search, priorityFilter, deptFilter]);

  const resolvedTickets = useMemo(
    () => filteredExtended.filter((t) => t.status === "completed"),
    [filteredExtended],
  );
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

  const hasActiveFilters = search || priorityFilter !== "all" || deptFilter !== "all";
  const hasActiveFiltersCompact = search || statusFilter !== "all" || priorityFilter !== "all" || deptFilter !== "all";

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
              onClick={() => { setSearch(""); setPriorityFilter("all"); setDeptFilter("all"); }}
              className="text-xs text-[#0047AC] font-semibold hover:underline whitespace-nowrap"
            >
              Limpiar filtros
            </button>
          )}
        </div>

        {/* Section 1: Resueltos — pending confirmation */}
        <ExtendedSection
          title="Pendiente de Confirmación"
          tickets={resolvedTickets}
          emptyMessage="No hay tickets resueltos pendientes de confirmación."
          onRowClick={(id) => navigate(`/ticket-detail/${id}`)}
          actionColumn={(ticket) =>
            canConfirm(currentUser, ticket) ? (
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
            ) : null
          }
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
              onClick={() => { setSearch(""); setStatusFilter("all"); setPriorityFilter("all"); setDeptFilter("all"); setPage(1); }}
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
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-16 text-gray-400 text-sm">
                  No se encontraron tickets con los filtros aplicados.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <TicketRow key={row.id} row={row} onClick={() => navigate(`/ticket-detail/${row.id}`)} />
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

function TicketRow({ row, onClick }: { row: Ticket; onClick: () => void }) {
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
}: {
  title: string;
  tickets: Ticket[];
  emptyMessage: string;
  onRowClick: (id: string) => void;
  actionColumn?: (ticket: Ticket) => React.ReactNode;
  accentColor?: string;
}) {
  const hasAction = !!actionColumn;
  return (
    <div className={`flex flex-col bg-white border border-gray-200 rounded-lg overflow-hidden ${accentColor ?? ""}`}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
        <span className="text-xs text-gray-400 font-medium">{tickets.length} ticket{tickets.length !== 1 ? "s" : ""}</span>
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

export default TicketsTable;
