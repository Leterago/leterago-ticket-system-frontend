import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useNavigate } from "react-router-dom";
import Tooltip from "@mui/material/Tooltip";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { SALONES, salonColor } from "../../config/catalog";
import { useRoomReservations } from "../../hooks/useRoomReservations";
import type { ServerReservation } from "../../api/client";
import {
  addDays,
  formatDuration,
  formatFechaLarga,
  formatTime12,
  fromMinutes,
  parseYmd,
  slotHasEnded,
  slotsOverlap,
  startOfWeek,
  toMinutes,
  toYmd,
  type TimeSlot,
} from "../../lib/calendarDates";

// Calendario de salones al estilo de Microsoft Teams: vistas Día / Semana laboral /
// Semana, rejilla de 30 min, línea de "ahora", reservas como bloques del color del
// salón (rayadas si siguen pendientes) y selección de franja arrastrando sobre la
// rejilla. Los datos salen de GET /reservations (useRoomReservations).

export type CalendarView = "day" | "workweek" | "week";

const HOUR_PX = 48;
const SLOT_MIN = 30;
const SLOT_PX = (HOUR_PX * SLOT_MIN) / 60;
const DAY_PX = HOUR_PX * 24;
const MIN_EVENT_PX = 20;
const DEFAULT_SCROLL_HOUR = 7;

const VIEW_LABELS: Record<CalendarView, string> = {
  day: "Día",
  workweek: "Semana laboral",
  week: "Semana",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente de confirmar",
  in_progress: "En gestión",
  completed: "Resuelta",
  confirmed: "Confirmada",
};

const minToPx = (min: number) => (min * HOUR_PX) / 60;

export interface RoomCalendarProps {
  /** YYYY-MM-DD. Al cambiar, el calendario salta a esa fecha. */
  focusDate?: string;
  /** Salón elegido en el formulario: el calendario se filtra a ese salón. */
  highlightSalon?: string;
  /** Franja en borrador (formulario): se dibuja como "Nueva reserva". */
  selection?: TimeSlot | null;
  /** Ticket que se está editando: su reserva se dibuja como la selección, no como ocupada. */
  editingTicketId?: string;
  /** Si se pasa, arrastrar/hacer clic en la rejilla elige una franja. */
  onSelectSlot?: (slot: { fecha: string; horaDesde: string; horaHasta: string }) => void;
  /** Abrir los tickets en otra pestaña (para no perder un formulario a medio llenar). */
  openEventsInNewTab?: boolean;
  defaultView?: CalendarView;
  /** Alto visible de la rejilla horaria, en px. */
  gridHeight?: number;
}

export default function RoomCalendar({
  focusDate,
  highlightSalon,
  selection,
  editingTicketId,
  onSelectSlot,
  openEventsInNewTab = false,
  defaultView = "workweek",
  gridHeight = 560,
}: RoomCalendarProps) {
  const navigate = useNavigate();
  const [view, setView] = useState<CalendarView>(() => {
    const dow = focusDate ? parseYmd(focusDate).getDay() : -1;
    return defaultView === "workweek" && (dow === 0 || dow === 6) ? "week" : defaultView;
  });
  const [anchor, setAnchor] = useState<Date>(() => (focusDate ? parseYmd(focusDate) : new Date()));
  const [now, setNow] = useState(() => new Date());
  const [drag, setDrag] = useState<{ fecha: string; startMin: number; curMin: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Props que reajustan el estado interno cuando cambian (ajuste durante el render,
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes).
  const [prevFocus, setPrevFocus] = useState(focusDate);
  if (focusDate !== prevFocus) {
    setPrevFocus(focusDate);
    // Saltar a la fecha del formulario. Si cae en fin de semana y estamos en
    // semana laboral, pasar a la semana completa para que se vea.
    if (focusDate) {
      const d = parseYmd(focusDate);
      setAnchor(d);
      if ((d.getDay() === 0 || d.getDay() === 6) && view === "workweek") setView("week");
    }
  }

  // Elegir un salón en el formulario filtra el calendario a ese salón (los chips
  // permiten volver a mostrar los demás).
  const hiddenFor = (salon?: string) =>
    new Set(salon ? SALONES.map((s) => s.name).filter((n) => n !== salon) : []);
  const [hidden, setHidden] = useState<Set<string>>(() => hiddenFor(highlightSalon));
  const [prevHighlight, setPrevHighlight] = useState(highlightSalon);
  if (highlightSalon !== prevHighlight) {
    setPrevHighlight(highlightSalon);
    setHidden(hiddenFor(highlightSalon));
  }

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const days = useMemo(() => {
    if (view === "day") return [new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate())];
    const monday = startOfWeek(anchor);
    return Array.from({ length: view === "week" ? 7 : 5 }, (_, i) => addDays(monday, i));
  }, [view, anchor]);

  const from = toYmd(days[0]);
  const to = toYmd(days[days.length - 1]);
  const { reservations, loading, error } = useRoomReservations(from, to);

  // La reserva del ticket en edición no ocupa: es la selección.
  const others = useMemo(
    () => reservations.filter((r) => !editingTicketId || r.ticketId !== editingTicketId),
    [reservations, editingTicketId],
  );
  const visible = useMemo(() => others.filter((r) => !hidden.has(r.salon)), [others, hidden]);

  const todayYmd = toYmd(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();

  // Scroll inicial: a la franja seleccionada o a las 7:00.
  const selectionStart = selection?.horaDesde ? toMinutes(selection.horaDesde) : null;
  const didInitialScroll = useRef(false);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const target = minToPx(Math.max(0, (selectionStart ?? DEFAULT_SCROLL_HOUR * 60 + 60) - 60));
    // Luego, solo mover si la franja queda fuera de la vista (no saltar tras arrastrar).
    if (
      !didInitialScroll.current ||
      target < el.scrollTop ||
      target > el.scrollTop + el.clientHeight - HOUR_PX
    ) {
      el.scrollTop = target;
      didInitialScroll.current = true;
    }
  }, [selectionStart, selection?.fecha]);

  const shift = (dir: 1 | -1) => setAnchor((a) => addDays(a, (view === "day" ? 1 : 7) * dir));

  const toggleSalon = (name: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  // ── Selección arrastrando ──────────────────────────────────────────────────
  const minuteAt = (e: ReactPointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const slot = Math.floor((e.clientY - rect.top) / SLOT_PX);
    return Math.min(Math.max(slot, 0), 24 * 60 / SLOT_MIN - 1) * SLOT_MIN;
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>, fecha: string) => {
    if (!onSelectSlot || e.button !== 0) return;
    if ((e.target as HTMLElement).closest("[data-event]")) return;
    const m = minuteAt(e);
    if (slotHasEnded(fecha, fromMinutes(m + SLOT_MIN))) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ fecha, startMin: m, curMin: m });
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    const m = minuteAt(e);
    if (m !== drag.curMin) setDrag({ ...drag, curMin: m });
  };

  const onPointerUp = () => {
    if (!drag || !onSelectSlot) return;
    const start = Math.min(drag.startMin, drag.curMin);
    const end = Math.max(drag.startMin, drag.curMin) + SLOT_MIN;
    onSelectSlot({
      fecha: drag.fecha,
      horaDesde: fromMinutes(start),
      // "24:00" no es una hora válida: la última franja termina a las 23:59.
      horaHasta: end >= 24 * 60 ? "23:59" : fromMinutes(end),
    });
    setDrag(null);
  };

  // Franja en borrador a dibujar: la del arrastre en curso o la del formulario.
  const draft: TimeSlot | null = drag
    ? {
        salon: selection?.salon ?? "",
        fecha: drag.fecha,
        horaDesde: fromMinutes(Math.min(drag.startMin, drag.curMin)),
        horaHasta: fromMinutes(Math.min(Math.max(drag.startMin, drag.curMin) + SLOT_MIN, 24 * 60 - 1)),
      }
    : selection && selection.fecha && selection.horaDesde && selection.horaHasta &&
        selection.horaHasta > selection.horaDesde
      ? selection
      : null;
  const draftConflict = !!draft && !!draft.salon && others.some((r) => slotsOverlap(r, draft));

  const openReservation = (r: ServerReservation) => {
    if (!r.canView || !r.ticketId) return;
    if (openEventsInNewTab) window.open(`/ticket-detail/${r.ticketId}`, "_blank", "noopener");
    else navigate(`/ticket-detail/${r.ticketId}`);
  };

  return (
    <div className="flex flex-col bg-white border border-gray-200 rounded-xl overflow-hidden text-gray-700">
      {/* ── Barra de herramientas ── */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-gray-200">
        <button
          type="button"
          onClick={() => setAnchor(new Date())}
          className="px-3 py-1.5 text-sm font-semibold border border-gray-200 rounded-md hover:bg-gray-50"
        >
          Hoy
        </button>
        <div className="flex items-center">
          <button
            type="button"
            aria-label="Anterior"
            onClick={() => shift(-1)}
            className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            aria-label="Siguiente"
            onClick={() => shift(1)}
            className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500"
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <h3 className="text-base font-semibold text-gray-900">{rangeLabel(days, view)}</h3>
        {loading && <Loader2 size={15} className="animate-spin text-gray-400" />}

        <div className="ml-auto flex rounded-md border border-gray-200 overflow-hidden text-sm">
          {(Object.keys(VIEW_LABELS) as CalendarView[]).map((v) => (
            <button
              type="button"
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 font-medium transition-colors ${
                view === v ? "bg-[#0047AC] text-white" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {VIEW_LABELS[v]}
            </button>
          ))}
        </div>
      </div>

      {/* ── Filtro por salón + leyenda ── */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-b border-gray-200">
        {SALONES.map((s) => {
          const on = !hidden.has(s.name);
          return (
            <button
              type="button"
              key={s.name}
              onClick={() => toggleSalon(s.name)}
              aria-pressed={on}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition-opacity ${
                on ? "border-gray-200 text-gray-700" : "border-dashed border-gray-200 text-gray-400 opacity-60"
              }`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: on ? s.color : "transparent", border: `2px solid ${s.color}` }}
              />
              {s.name}
            </button>
          );
        })}
        <div className="ml-auto flex items-center gap-3 text-[11px] text-gray-400">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm" style={{ background: stripes("#64748B") }} />
            Pendiente
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-gray-400" />
            En gestión / confirmada
          </span>
        </div>
      </div>

      {error && (
        <div className="px-4 py-2 text-xs text-red-600 dark:text-red-300 bg-red-50 border-b border-red-100">{error}</div>
      )}

      {/* ── Rejilla ── */}
      <div className="overflow-x-auto">
        <div style={{ minWidth: view === "day" ? 320 : days.length * 110 + 56 }}>
          {/* Cabecera de días */}
          <div className="flex border-b border-gray-200">
            <div className="w-14 shrink-0" />
            {days.map((d) => {
              const ymd = toYmd(d);
              const isToday = ymd === todayYmd;
              return (
                <div
                  key={ymd}
                  className={`flex-1 min-w-0 px-2 py-2 border-l border-gray-200 relative ${
                    ymd < todayYmd ? "opacity-60" : ""
                  }`}
                >
                  {isToday && <span className="absolute top-0 left-0 right-0 h-[3px] bg-[#0047AC]" />}
                  <div className={`text-xl font-semibold leading-none ${isToday ? "text-[#0047AC]" : "text-gray-800"}`}>
                    {d.getDate()}
                  </div>
                  <div className={`text-xs mt-1 truncate ${isToday ? "text-[#0047AC] font-semibold" : "text-gray-400"}`}>
                    {weekdayLabel(d, view === "day")}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Cuerpo con scroll vertical */}
          <div ref={scrollRef} className="overflow-y-auto" style={{ height: gridHeight }}>
            <div className="flex relative" style={{ height: DAY_PX }}>
              {/* Horas */}
              <div className="w-14 shrink-0 relative select-none">
                {Array.from({ length: 23 }, (_, i) => i + 1).map((h) => (
                  <span
                    key={h}
                    className="absolute right-2 text-[10px] text-gray-400 -translate-y-1/2"
                    style={{ top: h * HOUR_PX }}
                  >
                    {h % 12 || 12} {h >= 12 ? "PM" : "AM"}
                  </span>
                ))}
              </div>

              {days.map((d) => {
                const ymd = toYmd(d);
                const pastPx = ymd < todayYmd ? DAY_PX : ymd === todayYmd ? minToPx(nowMin) : 0;
                const dayEvents = layoutDay(visible.filter((r) => r.fecha === ymd));
                const showDraft = draft && draft.fecha === ymd;
                return (
                  <div
                    key={ymd}
                    className={`flex-1 min-w-0 relative border-l border-gray-200 select-none ${
                      onSelectSlot ? "cursor-cell" : ""
                    }`}
                    style={{
                      backgroundImage:
                        `linear-gradient(to bottom, var(--color-gray-200) 1px, transparent 1px),` +
                        `linear-gradient(to bottom, transparent ${SLOT_PX}px, var(--color-gray-100) ${SLOT_PX}px,` +
                        ` var(--color-gray-100) ${SLOT_PX + 1}px, transparent ${SLOT_PX + 1}px)`,
                      backgroundSize: `100% ${HOUR_PX}px`,
                    }}
                    onPointerDown={(e) => onPointerDown(e, ymd)}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={() => setDrag(null)}
                  >
                    {/* Pasado: atenuado y no seleccionable */}
                    {pastPx > 0 && (
                      <div
                        className="absolute inset-x-0 top-0 bg-black/[0.04] dark:bg-black/30 pointer-events-none"
                        style={{ height: pastPx }}
                      />
                    )}

                    {dayEvents.map(({ r, col, cols }, i) => (
                      <ReservationBlock
                        key={`${r.ticketId ?? "x"}-${r.salon}-${r.horaDesde}-${i}`}
                        r={r}
                        col={col}
                        cols={cols}
                        onOpen={() => openReservation(r)}
                      />
                    ))}

                    {showDraft && (
                      <DraftBlock
                        slot={draft}
                        conflict={draftConflict}
                        label={editingTicketId ? "Esta reserva" : "Nueva reserva"}
                      />
                    )}

                    {/* Línea de "ahora" */}
                    {ymd === todayYmd && (
                      <div
                        className="absolute inset-x-0 pointer-events-none z-20"
                        style={{ top: minToPx(nowMin) }}
                      >
                        <div className="relative h-0.5 bg-red-500">
                          <span className="absolute -left-1 -top-[3px] w-2 h-2 rounded-full bg-red-500" />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {onSelectSlot && (
        <p className="px-4 py-2 text-[11px] text-gray-400 border-t border-gray-200">
          Haz clic o arrastra sobre la rejilla para elegir el horario.
        </p>
      )}
    </div>
  );
}

// ─── Bloques ──────────────────────────────────────────────────────────────────

function ReservationBlock({
  r,
  col,
  cols,
  onOpen,
}: {
  r: ServerReservation;
  col: number;
  cols: number;
  onOpen: () => void;
}) {
  const color = salonColor(r.salon);
  const start = toMinutes(r.horaDesde);
  const end = toMinutes(r.horaHasta);
  const height = Math.max(minToPx(end - start), MIN_EVENT_PX);
  const compact = height < 44;
  const title = r.title ?? "Reservado";

  return (
    <Tooltip
      arrow
      placement="right"
      title={
        <div className="text-xs leading-relaxed">
          <div className="font-semibold">{title}</div>
          <div>{r.salon}</div>
          <div>
            {formatFechaLarga(r.fecha)} · {formatTime12(r.horaDesde)} – {formatTime12(r.horaHasta)}
          </div>
          <div>Reservado por {r.mine ? "ti" : r.createdBy}</div>
          <div>{STATUS_LABELS[r.status] ?? r.status}</div>
          {r.canView && r.ticketId && <div className="opacity-80 mt-0.5">{r.ticketId} · clic para abrir</div>}
        </div>
      }
    >
      <button
        type="button"
        data-event
        onClick={onOpen}
        className={`absolute z-10 rounded-[4px] px-1.5 py-0.5 overflow-hidden text-left text-[11px] leading-tight text-gray-800 hover:shadow-md hover:z-30 transition-shadow ${
          r.canView ? "cursor-pointer" : "cursor-default"
        }`}
        style={{
          top: minToPx(start) + 1,
          height: height - 2,
          left: `calc(${(col / cols) * 100}% + 2px)`,
          width: `calc(${100 / cols}% - 4px)`,
          backgroundColor: `${color}2E`,
          backgroundImage: r.status === "pending" ? stripes(color) : undefined,
          borderLeft: `3px solid ${color}`,
        }}
      >
        {compact ? (
          <span className="block truncate">
            <span className="font-semibold">{title}</span> · {formatTime12(r.horaDesde)}
          </span>
        ) : (
          <>
            <span className="block font-semibold truncate">{title}</span>
            <span className="block truncate text-gray-600">
              {formatTime12(r.horaDesde)} – {formatTime12(r.horaHasta)}
            </span>
            <span className="block truncate text-gray-500">{r.salon}</span>
            <span className="block truncate text-gray-500">{r.mine ? "Tu reserva" : r.createdBy}</span>
          </>
        )}
      </button>
    </Tooltip>
  );
}

function DraftBlock({ slot, conflict, label }: { slot: TimeSlot; conflict: boolean; label: string }) {
  const start = toMinutes(slot.horaDesde);
  const end = toMinutes(slot.horaHasta);
  return (
    <div
      className={`absolute inset-x-1 z-20 rounded-[4px] border-2 border-dashed px-1.5 py-0.5 text-[11px] leading-tight pointer-events-none overflow-hidden ${
        conflict
          ? "border-red-500 bg-red-50/90 text-red-700 dark:text-red-300"
          : "border-[#0047AC] bg-blue-50/90 text-[#0047AC]"
      }`}
      style={{ top: minToPx(start) + 1, height: Math.max(minToPx(end - start), MIN_EVENT_PX) - 2 }}
    >
      <span className="block font-semibold truncate">{conflict ? "Ocupado" : label}</span>
      <span className="block truncate">
        {formatTime12(slot.horaDesde)} – {formatTime12(slot.horaHasta)} · {formatDuration(end - start)}
      </span>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stripes(color: string): string {
  return `repeating-linear-gradient(135deg, ${color}40 0 5px, transparent 5px 10px)`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function weekdayLabel(d: Date, long: boolean): string {
  return capitalize(new Intl.DateTimeFormat("es-DO", { weekday: long ? "long" : "short" }).format(d)).replace(".", "");
}

function rangeLabel(days: Date[], view: CalendarView): string {
  const first = days[0];
  const last = days[days.length - 1];
  if (view === "day") return formatFechaLarga(toYmd(first));
  const month = (d: Date) => capitalize(new Intl.DateTimeFormat("es-DO", { month: "long" }).format(d));
  if (first.getMonth() === last.getMonth()) return `${month(first)} ${first.getFullYear()}`;
  if (first.getFullYear() === last.getFullYear()) return `${month(first)} – ${month(last)} ${last.getFullYear()}`;
  return `${month(first)} ${first.getFullYear()} – ${month(last)} ${last.getFullYear()}`;
}

/**
 * Reparte las reservas solapadas de un día en columnas (como Teams/Outlook):
 * cada grupo de reservas que se pisan comparte el ancho a partes iguales.
 */
function layoutDay(list: ServerReservation[]): { r: ServerReservation; col: number; cols: number }[] {
  const sorted = [...list].sort(
    (a, b) => a.horaDesde.localeCompare(b.horaDesde) || b.horaHasta.localeCompare(a.horaHasta),
  );
  const out: { r: ServerReservation; col: number; cols: number }[] = [];
  let cluster: { r: ServerReservation; col: number }[] = [];
  let colEnds: string[] = [];
  let clusterEnd = "";

  const flush = () => {
    for (const item of cluster) out.push({ ...item, cols: colEnds.length });
    cluster = [];
    colEnds = [];
  };

  for (const r of sorted) {
    if (cluster.length > 0 && r.horaDesde >= clusterEnd) flush();
    let col = colEnds.findIndex((end) => end <= r.horaDesde);
    if (col === -1) {
      col = colEnds.length;
      colEnds.push(r.horaHasta);
    } else {
      colEnds[col] = r.horaHasta;
    }
    cluster.push({ r, col });
    clusterEnd = cluster.length === 1 || r.horaHasta > clusterEnd ? r.horaHasta : clusterEnd;
  }
  flush();
  return out;
}
