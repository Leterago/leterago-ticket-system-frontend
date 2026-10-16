import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Users, Clock, CheckCircle2, XCircle, AlertTriangle, Loader2, CalendarDays } from "lucide-react";
import type { CategoryFormProps } from "./types";
import { SALONES, salonColor } from "../config/catalog";
import RoomCalendar from "../components/Organisms/RoomCalendar";
import { useRoomReservations } from "../hooks/useRoomReservations";
import {
  formatDuration,
  formatTime12,
  fromMinutes,
  slotHasEnded,
  slotsOverlap,
  toMinutes,
  toYmd,
} from "../lib/calendarDates";

export type SolicitudReunionPayload = {
  salon: string;
  cantidadParticipantes: number;
  tipoMontaje: "" | "teatro" | "escuela" | "u-con-mesas" | "otros";
  otrosMontaje: string;
  duracion: number;
  fecha: string;
  horaDesde: string;
  horaHasta: string;
  refrigerios: string[];
};

export const defaultValue: SolicitudReunionPayload = {
  salon: "",
  cantidadParticipantes: 0,
  tipoMontaje: "",
  otrosMontaje: "",
  duracion: 0,
  fecha: "",
  horaDesde: "",
  horaHasta: "",
  refrigerios: [],
};

/** Prefill desde la URL (?fecha=&desde=&hasta=&salon=), p. ej. al venir del calendario. */
export function initialValue(params: URLSearchParams): SolicitudReunionPayload {
  const fecha = params.get("fecha") ?? "";
  const horaDesde = params.get("desde") ?? "";
  const horaHasta = params.get("hasta") ?? "";
  const salon = params.get("salon") ?? "";
  return withDuration({
    ...defaultValue,
    salon: SALONES.some((s) => s.name === salon) ? salon : "",
    fecha: /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : "",
    horaDesde: /^\d{2}:\d{2}$/.test(horaDesde) ? horaDesde : "",
    horaHasta: /^\d{2}:\d{2}$/.test(horaHasta) ? horaHasta : "",
  });
}

/**
 * Validación previa al envío (espejo del schema Zod del backend). `original` es el
 * payload guardado al editar: si la franja no cambió no se exige que sea futura,
 * igual que el backend, para poder editar otros datos de una reserva pasada.
 */
export function validate(p: SolicitudReunionPayload, original?: SolicitudReunionPayload): string | null {
  if (!p.salon) return "Selecciona un salón.";
  if (!p.fecha) return "Indica la fecha de la reunión.";
  if (!p.horaDesde || !p.horaHasta) return "Indica la hora de inicio y de fin.";
  if (p.horaHasta <= p.horaDesde) return "La hora de fin debe ser posterior a la de inicio.";
  const unchanged =
    !!original &&
    original.salon === p.salon &&
    original.fecha === p.fecha &&
    original.horaDesde === p.horaDesde &&
    original.horaHasta === p.horaHasta;
  if (!unchanged && slotHasEnded(p.fecha, p.horaHasta)) {
    return "Ese horario ya pasó; elige una fecha u hora futura.";
  }
  if (!p.cantidadParticipantes || p.cantidadParticipantes <= 0) return "Indica la cantidad de participantes.";
  if (!p.tipoMontaje) return "Selecciona el tipo de montaje.";
  return null;
}

function withDuration(p: SolicitudReunionPayload): SolicitudReunionPayload {
  const valid = p.horaDesde && p.horaHasta && p.horaHasta > p.horaDesde;
  return { ...p, duracion: valid ? (toMinutes(p.horaHasta) - toMinutes(p.horaDesde)) / 60 : 0 };
}

// Opciones cada 30 min, como el selector de hora de Teams.
const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => fromMinutes(i * 30));
const LAST_END = "23:59";

const cateringOptions = [
  "Estación de Agua & Café",
  "Desayuno",
  "Picadera variada",
  "Almuerzo",
  "Cena",
];

export default function SolicitudReunionForm({
  value,
  onChange,
  readOnly = false,
  ticketId,
}: CategoryFormProps<SolicitudReunionPayload>) {
  const update = (patch: Partial<SolicitudReunionPayload>) => {
    if (readOnly) return;
    onChange(withDuration({ ...value, ...patch }));
  };

  const toggleRefrigerio = (v: string) => {
    const arr = value.refrigerios;
    update({ refrigerios: arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v] });
  };

  // Al mover la hora de inicio se conserva la duración (como en Teams).
  const changeDesde = (desde: string) => {
    if (!desde) return update({ horaDesde: "" });
    const prevLen =
      value.horaDesde && value.horaHasta > value.horaDesde
        ? toMinutes(value.horaHasta) - toMinutes(value.horaDesde)
        : 60;
    const end = toMinutes(desde) + prevLen;
    update({ horaDesde: desde, horaHasta: end >= 24 * 60 ? LAST_END : fromMinutes(end) });
  };

  const durationMin =
    value.horaDesde && value.horaHasta > value.horaDesde
      ? toMinutes(value.horaHasta) - toMinutes(value.horaDesde)
      : 0;

  const desdeOptions = withCurrent(TIME_OPTIONS, value.horaDesde);
  const hastaOptions = withCurrent(
    [...TIME_OPTIONS, LAST_END].filter((t) => !value.horaDesde || t > value.horaDesde),
    value.horaHasta,
  );

  const inputBase =
    "w-full border border-gray-200 rounded-md px-3 py-2 text-sm outline-none focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 border border-gray-200 p-6 text-gray-700 rounded-xl bg-white">
        <div className="flex flex-col w-full">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-semibold">Detalles de la Reunión</h2>
            {readOnly && value.fecha && (
              <Link
                to={`/salones?fecha=${value.fecha}`}
                className="flex items-center gap-1.5 text-xs font-semibold text-[#0047AC] hover:text-blue-700"
              >
                <CalendarDays size={13} />
                Ver en el calendario
              </Link>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Salón</label>
              <div className="relative">
                {value.salon && (
                  <span
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full pointer-events-none"
                    style={{ backgroundColor: salonColor(value.salon) }}
                  />
                )}
                <select
                  disabled={readOnly}
                  value={value.salon}
                  onChange={(e) => update({ salon: e.target.value })}
                  className={`${inputBase} ${value.salon ? "pl-7" : ""}`}
                >
                  <option value="">Seleccione Salón</option>
                  {SALONES.map((s) => (
                    <option key={s.name} value={s.name}>{s.name}</option>
                  ))}
                  {value.salon && !SALONES.some((s) => s.name === value.salon) && (
                    <option value={value.salon}>{value.salon}</option>
                  )}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1">Cantidad de Participantes</label>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  placeholder="0"
                  disabled={readOnly}
                  value={value.cantidadParticipantes || ""}
                  onChange={(e) => update({ cantidadParticipantes: Number(e.target.value) || 0 })}
                  className={`${inputBase} pr-10`}
                />
                <Users className="absolute right-3 top-2.5 w-4 h-4 text-gray-400" />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Tipo de Montaje</label>
                <select
                  disabled={readOnly}
                  value={value.tipoMontaje}
                  onChange={(e) => {
                    const m = e.target.value as SolicitudReunionPayload["tipoMontaje"];
                    update({ tipoMontaje: m, otrosMontaje: m !== "otros" ? "" : (value.otrosMontaje ?? "") });
                  }}
                  className={inputBase}
                >
                  <option value="">Seleccione Estilo</option>
                  <option value="teatro">Teatro</option>
                  <option value="escuela">Escuela</option>
                  <option value="u-con-mesas">Forma de "U" con Mesas</option>
                  <option value="otros">Otros (Especificar)</option>
                </select>
              </div>
              {value.tipoMontaje === "otros" && (
                <input
                  type="text"
                  disabled={readOnly}
                  value={value.otrosMontaje ?? ""}
                  onChange={(e) => update({ otrosMontaje: e.target.value })}
                  placeholder="Especifique el tipo de montaje..."
                  className={inputBase}
                />
              )}
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1">Fecha actividad</label>
              {readOnly ? (
                <div className={inputBase + " bg-gray-50 text-gray-700"}>
                  {value.fecha ? value.fecha.split("-").reverse().join("/") : "—"}
                </div>
              ) : (
                <input
                  type="date"
                  min={toYmd(new Date())}
                  value={value.fecha}
                  onChange={(e) => update({ fecha: e.target.value })}
                  className={inputBase}
                />
              )}
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1">Hora</label>
              {readOnly ? (
                <div className="flex items-center gap-2">
                  <div className={inputBase + " bg-gray-50 text-gray-700"}>{formatTime12(value.horaDesde)}</div>
                  <span className="text-xs text-gray-400 shrink-0">hasta</span>
                  <div className={inputBase + " bg-gray-50 text-gray-700"}>{formatTime12(value.horaHasta)}</div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <select
                    value={value.horaDesde}
                    onChange={(e) => changeDesde(e.target.value)}
                    className={inputBase}
                  >
                    <option value="">Inicio</option>
                    {desdeOptions.map((t) => (
                      <option key={t} value={t}>{formatTime12(t)}</option>
                    ))}
                  </select>
                  <span className="text-xs text-gray-400 shrink-0">hasta</span>
                  <select
                    value={value.horaHasta}
                    onChange={(e) => update({ horaHasta: e.target.value })}
                    className={inputBase}
                  >
                    <option value="">Fin</option>
                    {hastaOptions.map((t) => (
                      <option key={t} value={t}>
                        {formatTime12(t)}
                        {value.horaDesde ? ` (${formatDuration(toMinutes(t) - toMinutes(value.horaDesde))})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1">Duración</label>
              <div className={inputBase + " bg-gray-50 text-gray-700 flex items-center justify-between"}>
                <span>
                  {durationMin > 0
                    ? formatDuration(durationMin)
                    : value.duracion > 0 ? formatDuration(Math.round(value.duracion * 60)) : "—"}
                </span>
                <Clock className="w-4 h-4 text-gray-400" />
              </div>
            </div>
          </div>

          {!readOnly && (
            <Availability value={value} ticketId={ticketId} onPickSalon={(salon) => update({ salon })} />
          )}
        </div>

        <div className="flex flex-col gap-4">
          <Toggles
            title="Refrigerios"
            options={cateringOptions}
            selected={value.refrigerios}
            onToggle={toggleRefrigerio}
            readOnly={readOnly}
          />
        </div>
      </div>

      {!readOnly && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-gray-700 px-1">Disponibilidad de salones</h2>
          <RoomCalendar
            focusDate={value.fecha || undefined}
            highlightSalon={value.salon || undefined}
            selection={value}
            editingTicketId={ticketId}
            onSelectSlot={(s) => update(s)}
            openEventsInNewTab
            gridHeight={480}
          />
        </div>
      )}
    </div>
  );
}

/** Añade `current` a la lista si no está (p. ej. una hora guardada fuera de la rejilla de 30 min). */
function withCurrent(options: string[], current: string): string[] {
  if (!current || options.includes(current)) return options;
  return [...options, current].sort();
}

// ─── Disponibilidad en vivo ───────────────────────────────────────────────────

function Availability({
  value,
  ticketId,
  onPickSalon,
}: {
  value: SolicitudReunionPayload;
  ticketId?: string;
  onPickSalon: (salon: string) => void;
}) {
  const complete = !!(value.fecha && value.horaDesde && value.horaHasta && value.horaHasta > value.horaDesde);
  const { reservations, loading, error } = useRoomReservations(complete ? value.fecha : "", complete ? value.fecha : "");

  const others = useMemo(
    () => reservations.filter((r) => !ticketId || r.ticketId !== ticketId),
    [reservations, ticketId],
  );

  if (!complete) return null;

  const box = "mt-4 flex items-start gap-2.5 rounded-md border px-3 py-2.5 text-sm";

  if (slotHasEnded(value.fecha, value.horaHasta)) {
    return (
      <div className={`${box} border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:text-amber-300`}>
        <AlertTriangle size={16} className="shrink-0 mt-0.5" />
        Ese horario ya pasó. Elige una fecha u hora futura.
      </div>
    );
  }
  if (loading) {
    return (
      <div className={`${box} border-gray-200 bg-gray-50 text-gray-500`}>
        <Loader2 size={16} className="shrink-0 mt-0.5 animate-spin" />
        Comprobando disponibilidad…
      </div>
    );
  }
  if (error) {
    return (
      <div className={`${box} border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:text-amber-300`}>
        <AlertTriangle size={16} className="shrink-0 mt-0.5" />
        No se pudo comprobar la disponibilidad ({error}). Se verificará al guardar.
      </div>
    );
  }

  const slotFor = (salon: string) => ({ salon, fecha: value.fecha, horaDesde: value.horaDesde, horaHasta: value.horaHasta });
  const freeSalones = SALONES.filter((s) => !others.some((r) => slotsOverlap(r, slotFor(s.name))));

  if (!value.salon) {
    return (
      <div className={`${box} border-gray-200 bg-gray-50 text-gray-600`}>
        <CalendarDays size={16} className="shrink-0 mt-0.5" />
        <div>
          {freeSalones.length === 0
            ? "No hay salones libres en ese horario."
            : <>Libres en ese horario: <SalonChips salones={freeSalones.map((s) => s.name)} onPick={onPickSalon} /></>}
        </div>
      </div>
    );
  }

  const conflicts = others.filter((r) => slotsOverlap(r, slotFor(value.salon)));
  if (conflicts.length === 0) {
    return (
      <div className={`${box} border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:text-emerald-300`}>
        <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
        <span>
          <strong>{value.salon}</strong> está disponible de {formatTime12(value.horaDesde)} a {formatTime12(value.horaHasta)}.
        </span>
      </div>
    );
  }

  const alternatives = freeSalones.map((s) => s.name).filter((n) => n !== value.salon);
  return (
    <div className={`${box} border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:text-red-300`}>
      <XCircle size={16} className="shrink-0 mt-0.5" />
      <div className="flex flex-col gap-1">
        <span>
          <strong>{value.salon}</strong> ya está reservado en ese horario:
        </span>
        <ul className="list-disc pl-4">
          {conflicts.map((c, i) => (
            <li key={`${c.ticketId ?? "x"}-${i}`}>
              {formatTime12(c.horaDesde)} – {formatTime12(c.horaHasta)} · {c.title ?? "Reservado"} ({c.mine ? "tu reserva" : c.createdBy})
              {c.canView && c.ticketId && (
                <>
                  {" "}
                  <a href={`/ticket-detail/${c.ticketId}`} target="_blank" rel="noopener" className="underline">
                    {c.ticketId}
                  </a>
                </>
              )}
            </li>
          ))}
        </ul>
        <span>
          {alternatives.length > 0
            ? <>Salones libres en ese horario: <SalonChips salones={alternatives} onPick={onPickSalon} /></>
            : "No hay otro salón libre en ese horario; prueba otra hora en el calendario."}
        </span>
      </div>
    </div>
  );
}

function SalonChips({ salones, onPick }: { salones: string[]; onPick: (s: string) => void }) {
  return (
    <span className="inline-flex flex-wrap gap-1.5 align-middle">
      {salones.map((s) => (
        <button
          type="button"
          key={s}
          onClick={() => onPick(s)}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-gray-200 bg-white text-xs font-medium text-gray-700 hover:border-blue-500"
        >
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: salonColor(s) }} />
          {s}
        </button>
      ))}
    </span>
  );
}

function Toggles({
  title,
  options,
  selected,
  onToggle,
  readOnly,
}: {
  title: string;
  options: string[];
  selected: string[];
  onToggle: (v: string) => void;
  readOnly: boolean;
}) {
  return (
    <div className="flex flex-col w-full lg:flex-1">
      <h3 className="text-sm font-semibold mb-4">{title}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {options.map((opt) => {
          const active = selected.includes(opt);
          return (
            <button
              type="button"
              key={opt}
              disabled={readOnly}
              onClick={() => onToggle(opt)}
              className={`flex w-full items-center gap-2 px-3 py-3 rounded-md border text-sm transition ${
                readOnly ? "cursor-default" : "cursor-pointer"
              } ${
                active
                  ? "bg-blue-500/20 border-blue-500 text-blue-400"
                  : "border-gray-200 text-gray-600" +
                    (readOnly ? "" : " hover:border-blue-500")
              } ${readOnly && !active ? "opacity-60" : ""}`}
            >
              <div
                className={`w-4 h-4 rounded border flex items-center justify-center ${
                  active ? "bg-blue-500 border-blue-500" : "border-gray-400"
                }`}
              >
                {active && <div className="w-2 h-2 bg-white rounded-sm" />}
              </div>
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}
