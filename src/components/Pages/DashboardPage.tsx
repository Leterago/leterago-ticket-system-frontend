import { BarChart3, CheckCircle, AlertTriangle, Clock, Zap, CalendarDays, ChevronDown, Check, X, Star } from "lucide-react";
import PageHeader from "../Molecules/PageHeader";
import { useAppSelector, useCurrentUser } from "../../store/hooks";
import { useMemo, useState, useRef, useEffect } from "react";
import { api, type ResolutionStats } from "../../api/client";
import type { Ticket, DepartmentId } from "../../types/types";
import { DEPARTMENTS, getCategoriesForDepartments } from "../../config/catalog";

const ALL_DEPT_IDS: DepartmentId[] = ["compras", "servicios-generales", "mantenimiento-seguridad"];

// ─── Date helpers ─────────────────────────────────────────────────────────────
function toYMD(d: Date): string {
  return d.toISOString().split("T")[0];
}
function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}
function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
const MONTHS_ES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DAYS_ES   = ["Lu","Ma","Mi","Ju","Vi","Sá","Do"];

// ─── DateRangePicker ──────────────────────────────────────────────────────────
interface DateRange { from: string | null; to: string | null }

function formatDay(ymd: string): string {
  const [, m, d] = ymd.split("-");
  return `${parseInt(d)} ${MONTHS_ES[parseInt(m) - 1].slice(0, 3)}`;
}

function DateRangePicker({
  value, onChange,
}: {
  value: DateRange;
  onChange: (r: DateRange) => void;
}) {
  const [open, setOpen]           = useState(false);
  const [viewDate, setViewDate]   = useState(new Date());
  const [selecting, setSelecting] = useState<"from" | "to">("from");
  const [hovered, setHovered]     = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const today = toYMD(new Date());

  const shortcuts = useMemo(() => {
    const now = new Date();
    return [
      { label: "Este mes",        from: toYMD(startOfMonth(now)),         to: toYMD(endOfMonth(now)) },
      { label: "Mes pasado",      from: toYMD(startOfMonth(addMonths(now,-1))), to: toYMD(endOfMonth(addMonths(now,-1))) },
      { label: "Últimos 3 meses", from: toYMD(startOfMonth(addMonths(now,-2))), to: toYMD(endOfMonth(now)) },
      { label: "Este año",        from: toYMD(new Date(now.getFullYear(),0,1)), to: toYMD(new Date(now.getFullYear(),11,31)) },
    ];
  }, []);

  const calDays = useMemo(() => {
    const year  = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const first = new Date(year, month, 1).getDay();
    const offset = first === 0 ? 6 : first - 1;
    const days: (string | null)[] = Array(offset).fill(null);
    const total = endOfMonth(new Date(year, month, 1)).getDate();
    for (let d = 1; d <= total; d++) days.push(toYMD(new Date(year, month, d)));
    while (days.length % 7 !== 0) days.push(null);
    return days;
  }, [viewDate]);

  const handleDayClick = (day: string) => {
    if (selecting === "from") {
      onChange({ from: day, to: null });
      setSelecting("to");
    } else {
      if (value.from && day < value.from) onChange({ from: day, to: value.from });
      else onChange({ from: value.from, to: day });
      setSelecting("from");
      setOpen(false);
    }
  };

  const isInRange = (day: string): boolean => {
    const f = value.from, t = value.to ?? hovered;
    if (!f || !t) return false;
    const lo = f < t ? f : t, hi = f < t ? t : f;
    return day > lo && day < hi;
  };

  const isEdge = (day: string) => day === value.from || day === value.to;

  const displayLabel = useMemo(() => {
    if (!value.from) return "";
    if (!value.to) return `Desde ${formatDay(value.from)}`;
    return `${formatDay(value.from)} – ${formatDay(value.to)}`;
  }, [value]);

  const hasValue = !!value.from;

  return (
    <div ref={ref} className="relative flex flex-col gap-1.5">
      {/* Trigger */}
      <div
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center justify-between gap-2 rounded-lg border bg-white py-[9px] px-3 text-sm cursor-pointer transition-colors ${
          open
            ? "border-[#0047AC] ring-2 ring-[#0047AC]/10"
            : "border-gray-300 hover:border-gray-400"
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <CalendarDays size={15} className="text-gray-500 shrink-0" />
          <span className={`truncate ${hasValue ? "text-gray-800" : "text-gray-500"}`}>
            {displayLabel || "Seleccionar período"}
          </span>
        </div>
        {hasValue ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange({ from: null, to: null }); setSelecting("from"); }}
            className="text-gray-400 hover:text-gray-600 shrink-0 cursor-pointer"
          >
            <X size={14} />
          </button>
        ) : (
          <ChevronDown
            size={15}
            className={`text-gray-400 transition-transform duration-200 shrink-0 ${open ? "rotate-180" : ""}`}
          />
        )}
      </div>

      {/* Panel */}
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 bg-white rounded-xl border border-gray-200 shadow-xl px-3 pt-3 pb-2 w-72">
          {/* Shortcuts */}
          <div className="flex flex-wrap gap-1.5 pb-3 mb-3 border-b border-gray-200">
            <p className="w-full text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Acceso rápido</p>
            {shortcuts.map((s) => {
              const active = value.from === s.from && value.to === s.to;
              return (
                <button
                  key={s.label}
                  onClick={() => { onChange({ from: s.from, to: s.to }); setOpen(false); }}
                  className={`text-xs px-2.5 py-1 rounded-md border font-semibold transition-all ${
                    active
                      ? "bg-[#0047AC] text-white border-[#0047AC]"
                      : "border-gray-300 text-gray-600 hover:border-[#0047AC] hover:text-[#0047AC]"
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>

          {/* Month nav */}
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={() => setViewDate((d) => addMonths(d, -1))}
              className="p-1.5 rounded-md hover:bg-gray-200 text-gray-500 transition-colors"
            >
              <ChevronDown size={14} className="rotate-90" />
            </button>
            <span className="text-sm font-semibold text-gray-800">
              {MONTHS_ES[viewDate.getMonth()]} {viewDate.getFullYear()}
            </span>
            <button
              onClick={() => setViewDate((d) => addMonths(d, 1))}
              className="p-1.5 rounded-md hover:bg-gray-200 text-gray-500 transition-colors"
            >
              <ChevronDown size={14} className="-rotate-90" />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS_ES.map((d) => (
              <div key={d} className="text-center text-[10px] font-bold text-gray-400 py-1">{d}</div>
            ))}
          </div>

          {/* Days */}
          <div className="grid grid-cols-7 gap-y-0.5">
            {calDays.map((day, i) => {
              if (!day) return <div key={i} />;
              const edge    = isEdge(day);
              const inRange = isInRange(day);
              const isToday = day === today;
              return (
                <button
                  key={day}
                  onClick={() => handleDayClick(day)}
                  onMouseEnter={() => selecting === "to" && setHovered(day)}
                  onMouseLeave={() => setHovered(null)}
                  className={`text-xs h-7 w-full font-medium transition-all rounded ${
                    edge
                      ? "bg-[#0047AC] text-white"
                      : inRange
                        ? "bg-[#0047AC]/10 text-[#0047AC]"
                        : "text-gray-700 hover:bg-gray-200"
                  } ${isToday && !edge ? "ring-1 ring-[#0047AC]/40" : ""}`}
                >
                  {day.split("-")[2].replace(/^0/, "")}
                </button>
              );
            })}
          </div>

          <p className="text-[10px] text-gray-400 text-center mt-2">
            {selecting === "from" ? "Selecciona la fecha de inicio" : "Selecciona la fecha de fin"}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── DeptMultiFilter ──────────────────────────────────────────────────────────
function DeptMultiFilter({
  available, selected, onChange,
}: {
  available: DepartmentId[];
  selected: DepartmentId[];
  onChange: (ids: DepartmentId[]) => void;
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

  const toggle = (id: DepartmentId) => {
    if (selected.includes(id)) {
      if (selected.length === 1) return;
      onChange(selected.filter((d) => d !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  const allSelected = selected.length === available.length;

  const displayLabel = allSelected
    ? "Todos los departamentos"
    : selected.length === 1
      ? DEPARTMENTS[selected[0]]?.label
      : `${selected.length} departamentos`;

  return (
    <div ref={ref} className="relative flex flex-col gap-1.5">
      {/* Trigger */}
      <div
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center justify-between gap-2 rounded-lg border bg-white py-[9px] px-3 text-sm cursor-pointer transition-colors ${
          open
            ? "border-[#0047AC] ring-2 ring-[#0047AC]/10"
            : "border-gray-300 hover:border-gray-400"
        }`}
      >
        <span className={selected.length === 0 ? "text-gray-500" : "text-gray-800"}>{displayLabel}</span>
        <div className="flex items-center gap-1.5 shrink-0">
          {!allSelected && (
            <span className="w-4 h-4 rounded-full bg-[#0047AC] text-white text-[9px] font-bold flex items-center justify-center">
              {selected.length}
            </span>
          )}
          <ChevronDown
            size={15}
            className={`text-gray-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          />
        </div>
      </div>

      {/* Panel */}
      {open && (
        <ul className="absolute top-full z-50 mt-1 w-full max-h-52 overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {/* All option */}
          <li
            onClick={() => onChange([...available])}
            className={`flex items-center gap-2.5 cursor-pointer px-3 py-2 text-sm transition-colors ${
              allSelected
                ? "bg-blue-50 text-[#0047AC]"
                : "text-gray-700 hover:bg-gray-200"
            }`}
          >
            <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
              allSelected ? "border-[#0047AC] bg-[#0047AC]" : "border-gray-300 bg-white"
            }`}>
              {allSelected && <Check size={10} className="text-white" strokeWidth={2.5} />}
            </div>
            Todos
          </li>

          {available.map((dId) => {
            const checked = selected.includes(dId);
            return (
              <li
                key={dId}
                onClick={() => toggle(dId)}
                className={`flex items-center gap-2.5 cursor-pointer px-3 py-2 text-sm transition-colors ${
                  checked
                    ? "bg-blue-50 text-[#0047AC]"
                    : "text-gray-700 hover:bg-gray-200"
                }`}
              >
                <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                  checked ? "border-[#0047AC] bg-[#0047AC]" : "border-gray-300 bg-white"
                }`}>
                  {checked && <Check size={10} className="text-white" strokeWidth={2.5} />}
                </div>
                {DEPARTMENTS[dId]?.label ?? dId}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { tickets } = useAppSelector((s) => s.tickets);
  const currentUser = useCurrentUser();

  // Department filter — only shown if user has 2+ departments
  const userDeptIds: DepartmentId[] = currentUser.role === "master"
    ? ALL_DEPT_IDS
    : currentUser.departments.map((d) => d.departmentId as DepartmentId);

  const [selectedDepts, setSelectedDepts] = useState<DepartmentId[]>(userDeptIds);
  const showDeptFilter = userDeptIds.length > 1;

  // Date range filter
  const [dateRange, setDateRange] = useState<{ from: string | null; to: string | null }>({ from: null, to: null });

  // Compute visible tickets applying both filters
  const visible: Ticket[] = useMemo(() => {
    const accessibleCats = getCategoriesForDepartments(selectedDepts);
    return tickets.filter((t) => {
      if (!accessibleCats.includes(t.categoryId)) return false;
      if (dateRange.from && t.createdAt < dateRange.from) return false;
      if (dateRange.to   && t.createdAt > dateRange.to)   return false;
      return true;
    });
  }, [tickets, selectedDepts, dateRange]);

  // Re-sync dept filter when user changes
  useEffect(() => { setSelectedDepts(userDeptIds); }, [currentUser.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const total          = visible.length;
  const completed      = visible.filter((t) => t.status === "confirmed").length;
  const awaitingReview = visible.filter((t) => t.status === "completed").length;
  const pending        = visible.filter((t) => t.status === "pending").length;
  const inProgress     = visible.filter((t) => t.status === "in_progress").length;
  const canceled       = visible.filter((t) => t.status === "canceled").length;

  const byDept = useMemo(() => {
    const map: Record<string, number> = {};
    visible.forEach((t) => { map[t.departmentId] = (map[t.departmentId] || 0) + 1; });
    return Object.entries(map).map(([deptId, count]) => ({
      label: DEPARTMENTS[deptId as DepartmentId]?.label ?? deptId,
      count,
    }));
  }, [visible]);

  const byPriority = useMemo(() => {
    const map: Record<string, number> = { urgent: 0, high: 0, medium: 0, low: 0 };
    visible.forEach((t) => { map[t.priority] = (map[t.priority] || 0) + 1; });
    return map;
  }, [visible]);

  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Satisfaction: average of rated tickets + response rate (rated / rateable).
  const ratedTickets = visible.filter((t) => t.rating != null);
  const rateable      = visible.filter((t) => t.status === "completed" || t.status === "confirmed");
  const avgRating     = ratedTickets.length
    ? ratedTickets.reduce((s, t) => s + (t.rating?.value ?? 0), 0) / ratedTickets.length
    : null;
  const responseRate  = rateable.length ? Math.round((ratedTickets.length / rateable.length) * 100) : 0;

  // Resolution stats fetched from server (event-based: assigned → status_changed:completed)
  const [resStats, setResStats] = useState<ResolutionStats>({ avgMs: null, count: 0 });
  useEffect(() => {
    api.getResolutionStats(currentUser.id, {
      fromDate: dateRange.from ?? undefined,
      toDate: dateRange.to ?? undefined,
      departmentIds: selectedDepts.length > 0 ? selectedDepts : undefined,
    }).then(setResStats).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange.from, dateRange.to, selectedDepts.join(","), currentUser.id]);

  function formatResolutionTime(stats: ResolutionStats): { value: string; unit: string } {
    if (stats.avgMs === null || stats.count === 0) return { value: "—", unit: "sin datos" };
    const hours = stats.avgMs / 3_600_000;
    if (hours < 1) return { value: `${Math.round(hours * 60)}`, unit: "minutos" };
    if (hours < 24) return { value: hours.toFixed(1), unit: "horas" };
    return { value: (hours / 24).toFixed(1), unit: "días" };
  }

  const resTime = formatResolutionTime(resStats);

  return (
    <div className="w-full min-h-screen p-6 max-w-screen-2xl mx-auto">
      <div className="mb-6">
        <PageHeader
          title="Panel de Control"
          description="Vista general del rendimiento y estado actual de los tickets."
        />

        {/* Filter bar */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Date range picker — always visible */}
          <DateRangePicker value={dateRange} onChange={setDateRange} />

          {/* Dept multi-filter — only for multi-dept users */}
          {showDeptFilter && (
            <DeptMultiFilter
              available={userDeptIds}
              selected={selectedDepts}
              onChange={setSelectedDepts}
            />
          )}

        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <StatCard title="Total Tickets"  value={String(total)}      icon={<BarChart3 size={32} className="text-[#0047AC]" />} />
        <StatCard title="Completados"    value={String(completed)}  icon={<CheckCircle size={32} className="text-[#0047AC]" />} />
        <StatCard title="En Progreso"    value={String(inProgress)} icon={<Clock size={32} className="text-[#0047AC]" />} />
        <StatCard title="Pendientes"     value={String(pending)}    icon={<AlertTriangle size={32} className="text-[#0047AC]" />} />
        <StatCard
          title="Satisfacción"
          value={avgRating !== null ? `${avgRating.toFixed(1)} / 5` : "—"}
          icon={<Star size={32} className="text-amber-400 fill-amber-400" />}
          sub={avgRating !== null ? `${ratedTickets.length} calif · ${responseRate}% resp.` : "Sin calificaciones"}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* Completion donut */}
        <div className="bg-white border border-gray-200 rounded-lg p-5 ">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Tasa de Completación</p>
          <div className="flex items-center justify-center py-4">
            <div className="relative w-28 h-28">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="38" fill="none" stroke="#f1f5f9" strokeWidth="10" />
                <circle
                  cx="50" cy="50" r="38" fill="none"
                  stroke="#0047AC" strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={`${completionRate * 2.39} 239`}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-bold text-gray-900">{completionRate}%</span>
              </div>
            </div>
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-2">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#0047AC]" />Completados</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-200" />Restantes</span>
          </div>
        </div>

        {/* By Department */}
        <div className="bg-white border border-gray-200 rounded-lg p-5 ">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Por Departamento</p>
          <div className="flex flex-col gap-3">
            {byDept.length === 0 && <p className="text-sm text-gray-400">Sin datos en el período</p>}
            {byDept.map(({ label, count }) => {
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <div key={label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium text-gray-700">{label}</span>
                    <span className="text-gray-500">{count} ({pct}%)</span>
                  </div>
                  <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                    <div className="h-2 bg-[#0047AC] rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Speed card */}
        <div className="flex flex-col gap-3 bg-gradient-to-br from-[#0047AC] to-blue-800 rounded-lg px-5 py-6 ">
          <p className="text-blue-200 text-xs font-semibold uppercase tracking-wider">Velocidad de Resolución</p>
          <div className="flex justify-between items-center">
            <div className="flex flex-col gap-2">
              <h2 className="text-white text-4xl font-bold">
                {resTime.value} <span className="text-sm text-blue-200 font-normal">{resTime.unit}</span>
              </h2>
              <span className="text-xs bg-blue-200/25 text-blue-100 px-2 py-1 rounded w-fit">
                Promedio asignación → resuelto
              </span>
            </div>
            <Zap className="text-blue-300/20" size={70} />
          </div>
          <div className="mt-2 pt-3 border-t border-blue-400/30 grid grid-cols-2 gap-2">
            <div>
              <p className="text-[10px] text-blue-300 uppercase">Cancelados</p>
              <p className="text-white font-bold text-lg">{canceled}</p>
            </div>
            <div>
              <p className="text-[10px] text-blue-300 uppercase">Sin confirmar</p>
              <p className="text-white font-bold text-lg">{awaitingReview}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Priority breakdown */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 ">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Desglose por Prioridad</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <PriorityBar label="Urgente" count={byPriority.urgent} total={total} color="bg-red-500"     textColor="text-red-600" />
          <PriorityBar label="Alta"    count={byPriority.high}   total={total} color="bg-amber-500"   textColor="text-amber-600" />
          <PriorityBar label="Media"   count={byPriority.medium} total={total} color="bg-[#0047AC]"   textColor="text-[#0047AC]" />
          <PriorityBar label="Baja"    count={byPriority.low}    total={total} color="bg-gray-400"    textColor="text-gray-600" />
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components (unchanged styles) ───────────────────────────────────────

function StatCard({ title, value, icon, sub }: {
  title: string; value: string; icon: React.ReactNode; sub?: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5">
      <div className="flex justify-between items-start mb-3">
        <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{title}</p>
        {icon}
      </div>
      <h3 className="text-4xl font-bold text-gray-900">{value}</h3>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function PriorityBar({ label, count, total, color, textColor }: {
  label: string; count: number; total: number; color: string; textColor: string;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between text-xs">
        <span className={`font-semibold ${textColor}`}>{label}</span>
        <span className="text-gray-500">{count}</span>
      </div>
      <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
        <div className={`h-2.5 ${color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-400">{pct}%</span>
    </div>
  );
}
