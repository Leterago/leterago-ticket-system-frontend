import { Plus } from "lucide-react";
import type { CategoryFormProps } from "./types";
import ImageUploader from "../components/Organisms/ImageUploader";

export type UbicacionMantenimiento =
  | ""
  | "Recepción de Carga"
  | "Carga Pesada"
  | "Cuarto de Montacargas"
  | "Oficinas Administrativas 1er nivel CEDI"
  | "Oficinas Administrativas 2do nivel CEDI"
  | "Despacho"
  | "Verificación"
  | "Picking"
  | "Muestra Médica"
  | "Comedor"
  | "Exterior"
  | "Garita de Seguridad"
  | "Oficina Externa"
  | "Área de Servicio (Chillers, Generadores, etc)"
  | "Área de lockers"
  | "otro";

export type RegistroTrabajo = {
  fecha: string;
  realizadoPor: string;
  horaInicio: string;
  horaTermino: string;
};

export type TipoOrdenMantenimiento = "" | "Mejora" | "Proyectos" | "OT Terceros";

export const TIPOS_ORDEN: Exclude<TipoOrdenMantenimiento, "">[] = [
  "Mejora",
  "Proyectos",
  "OT Terceros",
];

export type SolicitudMantenimientoPayload = {
  area: string;
  ubicacion: UbicacionMantenimiento;
  otraUbicacion: string;
  codigo: string;
  tipoOrden: TipoOrdenMantenimiento;
  /** @deprecated El Word imprime `ticket.id`. Se conserva por los tickets ya guardados. */
  noOrden: string;
  registros: RegistroTrabajo[];
  imagenes: string[];
  observaciones: string;
};

export const defaultValue: SolicitudMantenimientoPayload = {
  area: "",
  ubicacion: "",
  otraUbicacion: "",
  codigo: "",
  tipoOrden: "",
  noOrden: "",
  registros: [
    { fecha: "", realizadoPor: "", horaInicio: "", horaTermino: "" },
    { fecha: "", realizadoPor: "", horaInicio: "", horaTermino: "" },
  ],
  imagenes: [],
  observaciones: "",
};

const inputBase =
  "w-full bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-sm outline-none focus:border-blue-500 disabled:text-gray-700 disabled:cursor-default";

const UBICACIONES: UbicacionMantenimiento[] = [
  "Recepción de Carga",
  "Carga Pesada",
  "Cuarto de Montacargas",
  "Oficinas Administrativas 1er nivel CEDI",
  "Oficinas Administrativas 2do nivel CEDI",
  "Despacho",
  "Verificación",
  "Picking",
  "Muestra Médica",
  "Comedor",
  "Exterior",
  "Garita de Seguridad",
  "Oficina Externa",
  "Área de Servicio (Chillers, Generadores, etc)",
  "Área de lockers",
];

const EMPTY_ROW: RegistroTrabajo = { fecha: "", realizadoPor: "", horaInicio: "", horaTermino: "" };

/** Sugerencias del campo "Realizado por" — el campo admite cualquier otro nombre. */
export const TECNICOS_MANTENIMIENTO = [
  "Gerson De La Rosa",
  "Franklin De Los Angeles Rodriguez",
  "Miguel Sano",
  "Tomas Merejildo Luciano",
  "Eury Cesar Sanchez Silverio",
  "Dagoberto De La Cruz Rodríguez",
];

const TECNICOS_LIST_ID = "tecnicos-mantenimiento";

export default function SolicitudMantenimientoForm({
  value,
  onChange,
  readOnly = false,
  showExecSection = false,
}: CategoryFormProps<SolicitudMantenimientoPayload>) {
  const set = <K extends keyof SolicitudMantenimientoPayload>(
    key: K,
    v: SolicitudMantenimientoPayload[K],
  ) => {
    if (readOnly) return;
    onChange({ ...value, [key]: v });
  };

  const registros: RegistroTrabajo[] = value.registros?.length
    ? value.registros
    : [{ ...EMPTY_ROW }, { ...EMPTY_ROW }];

  const setRow = (i: number, field: keyof RegistroTrabajo, v: string) => {
    if (readOnly) return;
    const rows = [...registros];
    rows[i] = { ...rows[i], [field]: v };
    onChange({ ...value, registros: rows });
  };

  const addRow = () => {
    if (readOnly) return;
    onChange({ ...value, registros: [...registros, { ...EMPTY_ROW }] });
  };

  return (
    <>
      <div className="flex flex-col gap-4 border border-gray-200 p-6 text-gray-700 rounded-xl bg-white">
        <h2 className="text-sm font-semibold">Detalles de Mantenimiento</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-400 block mb-1">
              Área o Equipo <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              disabled={readOnly}
              value={value.area}
              onChange={(e) => set("area", e.target.value)}
              placeholder="Ej: Aire acondicionado, Baños, Planta eléctrica..."
              className={inputBase}
            />
          </div>

          <div className="flex flex-col gap-2">
            <div>
              <label className="text-xs text-gray-400 block mb-1">
                Ubicación <span className="text-red-400">*</span>
              </label>
              <select
                disabled={readOnly}
                value={value.ubicacion}
                onChange={(e) => {
                  if (readOnly) return;
                  const u = e.target.value as UbicacionMantenimiento;
                  onChange({ ...value, ubicacion: u, otraUbicacion: u !== "otro" ? "" : value.otraUbicacion });
                }}
                className={inputBase}
              >
                <option value="">Seleccione ubicación</option>
                {UBICACIONES.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
                <option value="otro">Otro (Especificar)</option>
              </select>
            </div>
            {value.ubicacion === "otro" && (
              <input
                type="text"
                disabled={readOnly}
                value={value.otraUbicacion}
                onChange={(e) => set("otraUbicacion", e.target.value)}
                placeholder="Especifique la ubicación..."
                className={inputBase}
              />
            )}
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-1">
              Código del Equipo / Activo
            </label>
            <input
              type="text"
              disabled={readOnly}
              value={value.codigo}
              onChange={(e) => set("codigo", e.target.value)}
              placeholder="Código de identificación del equipo (opcional)"
              className={inputBase}
            />
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-1">Tipo de Orden</label>
            <select
              disabled={readOnly}
              value={value.tipoOrden ?? ""}
              onChange={(e) => set("tipoOrden", e.target.value as TipoOrdenMantenimiento)}
              className={inputBase}
            >
              <option value="">Seleccione tipo</option>
              {TIPOS_ORDEN.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <ImageUploader
        images={value.imagenes ?? []}
        onChange={(imagenes) => set("imagenes", imagenes)}
        readOnly={readOnly}
      />

      {showExecSection && (
        <div className="flex flex-col gap-4 border border-gray-200 p-6 text-gray-700 rounded-xl bg-white">
          <h2 className="text-sm font-semibold">Registro de Ejecución</h2>

          {/* El No. de Orden del FOR-077 es el id del ticket: no se captura a mano. */}
          <datalist id={TECNICOS_LIST_ID}>
            {TECNICOS_MANTENIMIENTO.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs text-gray-400 font-medium pb-2 pr-3 min-w-32">Fecha</th>
                  <th className="text-left text-xs text-gray-400 font-medium pb-2 pr-3">Realizado por</th>
                  <th className="text-left text-xs text-gray-400 font-medium pb-2 pr-3 min-w-28">Hora inicio</th>
                  <th className="text-left text-xs text-gray-400 font-medium pb-2 min-w-28">Hora término</th>
                </tr>
              </thead>
              <tbody>
                {registros.map((row, i) => (
                  <tr key={i}>
                    <td className="py-1 pr-3">
                      <input
                        type="date"
                        disabled={readOnly}
                        value={row.fecha}
                        onChange={(e) => setRow(i, "fecha", e.target.value)}
                        className={inputBase}
                      />
                    </td>
                    <td className="py-1 pr-3">
                      <input
                        type="text"
                        list={TECNICOS_LIST_ID}
                        disabled={readOnly}
                        value={row.realizadoPor}
                        onChange={(e) => setRow(i, "realizadoPor", e.target.value)}
                        placeholder="Seleccione o escriba un nombre..."
                        className={inputBase}
                      />
                    </td>
                    <td className="py-1 pr-3">
                      <input
                        type="time"
                        disabled={readOnly}
                        value={row.horaInicio}
                        onChange={(e) => setRow(i, "horaInicio", e.target.value)}
                        className={inputBase}
                      />
                    </td>
                    <td className="py-1">
                      <input
                        type="time"
                        disabled={readOnly}
                        value={row.horaTermino}
                        onChange={(e) => setRow(i, "horaTermino", e.target.value)}
                        className={inputBase}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!readOnly && (
            <button
              type="button"
              onClick={addRow}
              className="flex items-center gap-1.5 text-xs font-semibold text-[#0047AC] hover:text-blue-700 transition-colors self-start"
            >
              <Plus size={14} />
              Agregar fila
            </button>
          )}

          <div>
            <label className="text-xs text-gray-400 block mb-1">Observaciones</label>
            <textarea
              disabled={readOnly}
              rows={3}
              value={value.observaciones ?? ""}
              onChange={(e) => set("observaciones", e.target.value)}
              placeholder="Observaciones sobre el trabajo realizado..."
              className={`${inputBase} resize-none`}
            />
          </div>
        </div>
      )}
    </>
  );
}
