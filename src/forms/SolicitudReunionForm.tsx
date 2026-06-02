import { Users, Clock } from "lucide-react";
import type { CategoryFormProps } from "./types";

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

const formatTime12 = (t: string) => {
  if (!t) return "—";
  const [hStr, mStr] = t.split(":");
  const h = parseInt(hStr, 10);
  if (isNaN(h)) return t;
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${mStr} ${suffix}`;
};

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
}: CategoryFormProps<SolicitudReunionPayload>) {
  const set = <K extends keyof SolicitudReunionPayload>(
    key: K,
    v: SolicitudReunionPayload[K],
  ) => {
    if (readOnly) return;
    onChange({ ...value, [key]: v });
  };

  const toggleRefrigerio = (v: string) => {
    if (readOnly) return;
    const arr = value.refrigerios;
    set("refrigerios", arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  };

  const inputBase =
    "w-full border border-gray-200 rounded-md px-3 py-2 text-sm outline-none focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";

  return (
    <div className="flex flex-col gap-4 border border-gray-200 p-6 text-gray-700 rounded-xl bg-white">
      <div className="flex flex-col w-full">
        <h2 className="text-sm font-semibold mb-6">Detalles de la Reunión</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Salón</label>
            <select
              disabled={readOnly}
              value={value.salon}
              onChange={(e) => set("salon", e.target.value)}
              className={inputBase}
            >
              <option value="">Seleccione Salón</option>
              <option value="Salón Rodolfo Wehe">Salón Rodolfo Wehe</option>
              <option value="Salón Area de Finanza">Salón Area de Finanza</option>
              <option value="Salón Servicio al Cliente">Salón Servicio al Cliente</option>
              <option value="Salón P&C">Salón P&amp;C</option>
            </select>
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
                onChange={(e) => set("cantidadParticipantes", Number(e.target.value) || 0)}
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
                  if (readOnly) return;
                  const m = e.target.value as SolicitudReunionPayload["tipoMontaje"];
                  onChange({ ...value, tipoMontaje: m, otrosMontaje: m !== "otros" ? "" : (value.otrosMontaje ?? "") });
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
                onChange={(e) => set("otrosMontaje", e.target.value)}
                placeholder="Especifique el tipo de montaje..."
                className={inputBase}
              />
            )}
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-1">Duración (Horas)</label>
            <div className="relative">
              <input
                type="number"
                step="0.5"
                min={0}
                placeholder="0.0"
                disabled={readOnly}
                value={value.duracion || ""}
                onChange={(e) => set("duracion", Number(e.target.value) || 0)}
                className={`${inputBase} pr-10`}
              />
              <Clock className="absolute right-3 top-2.5 w-4 h-4 text-gray-400" />
            </div>
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
                value={value.fecha}
                onChange={(e) => set("fecha", e.target.value)}
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
                <input
                  type="time"
                  value={value.horaDesde}
                  onChange={(e) => set("horaDesde", e.target.value)}
                  className={inputBase}
                />
                <span className="text-xs text-gray-400 shrink-0">hasta</span>
                <input
                  type="time"
                  value={value.horaHasta}
                  onChange={(e) => set("horaHasta", e.target.value)}
                  className={inputBase}
                />
              </div>
            )}
          </div>
        </div>
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
