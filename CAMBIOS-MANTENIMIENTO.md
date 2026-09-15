# Cambios — Categoría Mantenimiento y Seguridad (FOR-077)

> ✅ **YA IMPLEMENTADO.** Los 8 cambios están aplicados en el código de ambos repos.
> Este documento queda como referencia de qué se cambió y por qué; **no hay que volver a
> aplicarlo**.

> **Qué es este documento:** la especificación completa de 7 cambios sobre la categoría
> `solicitud-mantenimiento` (departamento `mantenimiento-seguridad`) y sobre el Word
> FOR-077 que genera. Está escrito para aplicarse tal cual: cada cambio indica archivo,
> código actual y código de reemplazo.
>
> **Alcance:** 6 archivos del repo **frontend** + 1 archivo del repo **backend**
> (`leterago-ticket-system-backend`, que es otro repositorio Git).
>
> **Convención del proyecto:** producto en español — toda copy de UI, comentarios y
> textos nuevos van en español.

---

## Resumen de los cambios

| # | Cambio | Dónde se ve |
|---|--------|-------------|
| 1 | El **NIVEL DE PRIORIDAD** del ticket debe quedar marcado en el Word | Word FOR-077 |
| 2 | **Recibe conforme** se llena con el nombre del solicitante | Word FOR-077 |
| 3 | **Departamento** se llena con el departamento de origen del solicitante | Word FOR-077 |
| 4 | **Realizado por** pasa a ser dropdown con sugerencias + texto libre | Formulario app (Registro de Ejecución) |
| 5 | Formulario Word **más ancho** (menos margen lateral) | Word FOR-077 |
| 6 | **No. de Orden** = ID del ticket (ej. `TCK-329`) | Word FOR-077 + formulario app |
| 7 | Agregar **imágenes** a esta categoría + nuevo dropdown **Tipo de Orden** (Mejora / Proyectos / OT Terceros) | Formulario app (no sale en el Word) |
| 8 | Quitar los **textos guía** en cursiva gris del Word (el de Observaciones y similares) | Word FOR-077 |

## Archivos afectados

**Repo `leterago-ticket-system-frontend`:**

- `src/lib/exportMantenimiento.ts` — cambios 1, 2, 3, 5, 6, 8
- `src/forms/SolicitudMantenimientoForm.tsx` — cambios 4, 6, 7
- `src/components/Pages/TicketDetailPage.tsx` — cambio 3 (resolver el departamento y pasarlo al export)
- `src/components/Organisms/ImageUploader.tsx` — **archivo nuevo** (cambio 7)
- `src/forms/SolicitudCompraForm.tsx` — se refactoriza para reutilizar `ImageUploader` (cambio 7)
- `README.md` — actualizar (convención obligatoria del proyecto)

**Repo `leterago-ticket-system-backend`:**

- `src/schemas/payloads/solicitud-mantenimiento.ts` — cambio 7 (campos nuevos en el schema Zod)
- `README.md` — actualizar la forma del payload de la categoría

---

## Cambio 1 — NIVEL DE PRIORIDAD marcado en el Word

**Archivo:** `src/lib/exportMantenimiento.ts`

**Situación actual:** el código ya deriva el nivel de `ticket.priority` (`PRIORITY_NIVEL`,
línea ~60) y arma las casillas con el helper `ck()`, que concatena `☒`/`☐` en un `TextRun`
con fuente **Verdana**. Verdana **no contiene esos glifos**, así que Word los sustituye o
los dibuja como un cuadro vacío: por eso la marca no se ve en el documento generado.

**Arreglo:** dibujar la marca en un `TextRun` propio con una fuente que sí tenga el glifo
(`Segoe UI Symbol`) y además poner en **negrita** la opción seleccionada, para que el nivel
quede inequívoco aunque la fuente falle en otra máquina.

1. Debajo de la constante `DARK` agregar:

```ts
const SYMBOL_FONT = "Segoe UI Symbol"; // Verdana no trae ☒/☐ — Word los sustituye mal
```

2. Reemplazar el helper `ck` dentro de `exportMantenimientoDocx` (línea ~265):

```ts
// ANTES
const ck = (opt: string) => `${nivel === opt ? "☒" : "☐"} ${opt}`;

// DESPUÉS
/** Casilla del nivel de prioridad: el glifo va con fuente propia o Word no lo dibuja. */
const nivelLinea = (opt: string) => {
  const marcada = nivel === opt;
  return p(
    [
      new TextRun({ text: marcada ? "☒" : "☐", font: SYMBOL_FONT, size: 20, color: DARK }),
      run(` ${opt}`, { size: 18, bold: marcada }),
    ],
    AlignmentType.LEFT,
    { before: 10, after: 10 },
  );
};
```

3. En `nivelCell` (línea ~285) reemplazar las tres líneas de casillas:

```ts
// ANTES
p([run(ck("Urgente"),    { size: 18 })], AlignmentType.LEFT, { before: 10, after: 10 }),
p([run(ck("Importante"), { size: 18 })], AlignmentType.LEFT, { before: 10, after: 10 }),
p([run(ck("Normal"),     { size: 18 })], AlignmentType.LEFT, { before: 10, after: 10 }),

// DESPUÉS
nivelLinea("Urgente"),
nivelLinea("Importante"),
nivelLinea("Normal"),
```

**Mapeo de prioridades** (se mantiene el existente — la app tiene 4 niveles y el formulario
oficial sólo 3):

| Prioridad del ticket | Casilla marcada |
|---|---|
| `urgent` (Urgente) | Urgente |
| `high` (Alta) | Importante |
| `medium` (Media) | Normal |
| `low` (Baja) | Normal |

> Si se prefiere `low` → sin marcar, cambiar `PRIORITY_NIVEL` en el mismo archivo.

---

## Cambio 2 — "Recibe conforme" con el nombre del solicitante

**Archivo:** `src/lib/exportMantenimiento.ts` (última tabla del documento, línea ~432)

```ts
// ANTES
children: [p([run("Recibe conforme: ", { bold: true }), run("(Firma de quien recibe)", { italic: true, color: "808080" })])],

// DESPUÉS
children: [p([run("Recibe conforme: ", { bold: true }), run(ticket.createdBy ?? "")])],
```

`ticket.createdBy` es el nombre del creador del ticket (el solicitante) y ya viene en el
objeto `Ticket` que recibe la función — no hace falta ningún dato extra.

---

## Cambio 3 — "Departamento" con el departamento de origen del solicitante

El departamento de origen vive en `User.originDepartmentId`, que **no** viaja en el objeto
`Ticket`. Sí está en la lista de usuarios que la app carga al iniciar sesión
(`state.users.list`, ya adaptada en `usersSlice.ts`), así que se resuelve en la página de
detalle y se pasa al export como parámetro nuevo.

### 3.1 — `src/lib/exportMantenimiento.ts`: parámetro nuevo

```ts
// ANTES
export async function exportMantenimientoDocx(
  ticket: Ticket,
  payload: SolicitudMantenimientoPayload,
): Promise<void> {

// DESPUÉS
/** Datos que no viven en el ticket ni en el payload y los resuelve la página. */
export type ExportMantenimientoOpts = {
  /** Departamento de origen del solicitante (etiqueta legible). */
  departamento?: string;
};

export async function exportMantenimientoDocx(
  ticket: Ticket,
  payload: SolicitudMantenimientoPayload,
  opts: ExportMantenimientoOpts = {},
): Promise<void> {
```

Y en la tabla principal (línea ~341):

```ts
// ANTES
fieldCell("Departamento:", "", LEFT, { borders: bdr(false, true, true, false) }),

// DESPUÉS
fieldCell("Departamento:", opts.departamento ?? "", LEFT, { borders: bdr(false, true, true, false) }),
```

### 3.2 — `src/components/Pages/TicketDetailPage.tsx`: resolver y pasar el valor

La página ya tiene `allUsers` (línea ~151) y `ticket` (línea ~160). Justo después de
`ticket`, agregar:

```tsx
// Solicitante completo: el ticket sólo trae el nombre, el departamento de origen
// está en el usuario.
const creador = allUsers.find((u) => u.id === ticket?.createdById);
```

Agregar el import del helper de etiquetas junto a los demás imports:

```tsx
import { departmentLabel } from "../../config/catalog";
```

Y en la llamada al export (línea ~439):

```tsx
// ANTES
await exportMantenimientoDocx(ticket, merged);

// DESPUÉS
await exportMantenimientoDocx(ticket, merged, {
  departamento: creador?.originDepartmentId ? departmentLabel(creador.originDepartmentId) : "",
});
```

> `departmentLabel(null)` devuelve `"Otro"`; por eso se consulta primero si hay
> `originDepartmentId` y si no se deja la casilla vacía, como en el formulario en blanco.

---

## Cambio 4 — "Realizado por" como dropdown con texto libre

**Archivo:** `src/forms/SolicitudMantenimientoForm.tsx` (sección *Registro de Ejecución*)

Se usa `<input list="...">` + `<datalist>`: muestra las sugerencias al hacer clic y permite
escribir cualquier otro nombre (requisito: "dropdown donde también se pueda digitar").

1. Junto a la constante `EMPTY_ROW` agregar:

```tsx
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
```

2. Reemplazar el input de la columna *Realizado por* (línea ~215):

```tsx
// ANTES
<input
  type="text"
  disabled={readOnly}
  value={row.realizadoPor}
  onChange={(e) => setRow(i, "realizadoPor", e.target.value)}
  placeholder="Nombre..."
  className={inputBase}
/>

// DESPUÉS
<input
  type="text"
  list={TECNICOS_LIST_ID}
  disabled={readOnly}
  value={row.realizadoPor}
  onChange={(e) => setRow(i, "realizadoPor", e.target.value)}
  placeholder="Seleccione o escriba un nombre..."
  className={inputBase}
/>
```

3. Declarar el `datalist` **una sola vez** dentro de la sección de ejecución (por ejemplo
   justo antes del `<div className="overflow-x-auto">` que envuelve la tabla):

```tsx
<datalist id={TECNICOS_LIST_ID}>
  {TECNICOS_MANTENIMIENTO.map((n) => (
    <option key={n} value={n} />
  ))}
</datalist>
```

> No hace falta tocar el backend: `realizadoPor` ya es `z.string()` libre.

---

## Cambio 5 — Formulario Word más ancho (menos margen lateral)

**Archivo:** `src/lib/exportMantenimiento.ts` (línea ~34)

```ts
// ANTES  (izq/der = 1699 twips ≈ 3 cm; ancho útil 8508)
const MARGIN = { top: 1411, right: 1699, bottom: 1134, left: 1699, header: 706, footer: 706 };

// DESPUÉS (izq/der = 850 twips ≈ 1.5 cm; ancho útil 10206)
const MARGIN = { top: 1411, right: 850, bottom: 1134, left: 850, header: 706, footer: 706 };
```

**No hay que tocar nada más:** `CW` se calcula a partir de los márgenes y todas las tablas
(`LEFT/MID/RIGHT`, `RP[]`, encabezado, barras de sección) se derivan de `CW`. El logo
(`H_LOGO = 2700`) y el bloque de documento (`H_INFO = 2050`) conservan su ancho fijo y el
ancho extra lo absorbe la celda del título (`H_TITLE`), que es lo correcto.

> Si se quiere aún más ancho: `567` twips = 1 cm. No bajar de ~400 twips o la impresora
> recorta el borde de las tablas.

---

## Cambio 6 — "No. de Orden" = ID del ticket (ej. `TCK-329`)

### 6.1 — Word: imprimir el ID del ticket

**Archivo:** `src/lib/exportMantenimiento.ts` (recuadro superior derecho, línea ~311)

```ts
// ANTES
children: [p([run("No. de Orden: ", { bold: true, size: 20 }), run(payload.noOrden || "", { size: 20 })])],

// DESPUÉS
children: [p([run("No. de Orden: ", { bold: true, size: 20 }), run(ticket.id, { size: 20 })])],
```

### 6.2 — App: quitar el input manual

**Archivo:** `src/forms/SolicitudMantenimientoForm.tsx`

El input "No. de Orden" del *Registro de Ejecución* (líneas ~180-190) queda obsoleto —
eliminar el bloque completo:

```tsx
<div className="md:max-w-xs">
  <label className="text-xs text-gray-400 block mb-1">No. de Orden</label>
  <input ... value={value.noOrden ?? ""} ... />
</div>
```

**No eliminar** `noOrden` del tipo `SolicitudMantenimientoPayload` ni del schema Zod del
backend: hay tickets viejos con ese campo guardado. Marcarlo como legado:

```ts
  /** @deprecated El Word imprime `ticket.id`. Se conserva por los tickets ya guardados. */
  noOrden: string;
```

---

## Cambio 7 — Imágenes + dropdown "Tipo de Orden"

### 7.1 — Backend: schema Zod

**Archivo (repo backend):** `src/schemas/payloads/solicitud-mantenimiento.ts`

```ts
const TIPOS_ORDEN = ["", "Mejora", "Proyectos", "OT Terceros"] as const;

export const schema = z.object({
  area:          z.string().min(1, "El área o equipo es requerido"),
  ubicacion:     z.enum(UBICACIONES, { invalid_type_error: "Ubicación inválida" }),
  otraUbicacion: z.string().default(""),
  codigo:        z.string().default(""),
  tipoOrden:     z.enum(TIPOS_ORDEN).default(""),
  noOrden:       z.string().default(""),   // legado: el Word imprime el id del ticket
  registros:     z.array(registroTrabajoSchema).default([]),
  imagenes:      z.array(z.string()).default([]),   // data-URLs comprimidas
  observaciones: z.string().default(""),
});

export const required = true;
```

> `tipoOrden` e `imagenes` llevan `.default()` a propósito: los tickets ya guardados no los
> traen y deben seguir validando. El límite de `express.json` ya es de **20 MB** (`src/index.ts`),
> suficiente para las imágenes base64 — no hay que tocarlo.

### 7.2 — Frontend: componente reutilizable `ImageUploader`

Hoy el cargador de imágenes está incrustado en `SolicitudCompraForm.tsx`. Se extrae a un
Organism reutilizable y ambas categorías lo consumen (atomic design del proyecto).

**Archivo nuevo:** `src/components/Organisms/ImageUploader.tsx`

```tsx
import { useRef, useState, useEffect } from "react";
import { ImagePlus, X, AlertCircle, ZoomIn } from "lucide-react";
import ImageLightbox from "./ImageLightbox";
import { compressImage, IMAGE_MAX_BYTES } from "../../lib/compressImage";

interface ImageUploaderProps {
  /** Imágenes actuales (data-URLs). */
  images: string[];
  /** Devuelve la lista completa ya actualizada. */
  onChange: (next: string[]) => void;
  /** En sólo lectura no se puede subir ni eliminar. */
  readOnly?: boolean;
  /** Título de la tarjeta. */
  title?: string;
}

export default function ImageUploader({
  images,
  onChange,
  readOnly = false,
  title = "Imágenes adjuntas",
}: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  // Índice de la imagen abierta en el visor (null = cerrado).
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  useEffect(() => {
    if (readOnly) return;
    const onPaste = (e: ClipboardEvent) => {
      const items = Array.from(e.clipboardData?.items ?? []);
      const imageFiles = items
        .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
        .map((item) => item.getAsFile())
        .filter((f): f is File => f !== null);
      if (imageFiles.length > 0) {
        const dt = new DataTransfer();
        imageFiles.forEach((f) => dt.items.add(f));
        handleFiles(dt.files);
      }
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [readOnly, images]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || readOnly) return;
    const oversized = Array.from(files).filter((f) => f.size > IMAGE_MAX_BYTES);
    if (oversized.length) {
      setErrors(oversized.map((f) => `"${f.name}" supera los 5 MB.`));
      return;
    }
    setErrors([]);
    setLoading(true);
    try {
      const compressed = await Promise.all(Array.from(files).map((f) => compressImage(f)));
      onChange([...images, ...compressed]);
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const remove = (idx: number) => {
    if (readOnly) return;
    onChange(images.filter((_, i) => i !== idx));
  };

  return (
    <div className="flex flex-col gap-4 border border-gray-200 p-6 rounded-xl bg-white">
      <h2 className="text-sm font-semibold text-gray-700">{title}</h2>

      {!readOnly && (
        <>
          <button
            type="button"
            disabled={loading}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              handleFiles(e.dataTransfer.files);
            }}
            className={`flex items-center justify-center gap-2 border-2 border-dashed rounded-lg py-16 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed
              ${dragging
                ? "border-[#0047AC] bg-blue-50 text-[#0047AC]"
                : "border-gray-200 text-gray-400 hover:border-[#0047AC] hover:text-[#0047AC]"
              }`}
          >
            <ImagePlus size={18} />
            {loading ? "Procesando..." : dragging ? "Suelta las imágenes aquí" : "Haz clic o arrastra imágenes aquí"}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <p className="text-[11px] text-gray-400 -mt-2">
            PNG, JPG, WEBP · máx. 5 MB · se comprimen automáticamente · también puedes pegar con Ctrl+V
          </p>

          {errors.map((err, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-red-500 bg-red-50 border border-red-100 rounded-md px-3 py-2">
              <AlertCircle size={13} />
              {err}
            </div>
          ))}
        </>
      )}

      {images.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {images.map((src, idx) => (
            <div key={idx} className="relative group rounded-lg overflow-hidden border border-gray-200 aspect-video bg-gray-50">
              <img
                src={src}
                alt={`imagen-${idx + 1}`}
                className="w-full h-full object-cover cursor-zoom-in"
                onClick={() => setViewerIndex(idx)}
              />
              {/* Indicador de "ampliar" al pasar el cursor (no intercepta clics). */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition-colors">
                <ZoomIn size={20} className="text-white opacity-0 group-hover:opacity-90 transition-opacity drop-shadow" />
              </div>
              {!readOnly && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); remove(idx); }}
                  className="absolute top-1.5 right-1.5 bg-black/50 hover:bg-black/70 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        readOnly && (
          <p className="text-sm text-gray-400 italic">Sin imágenes adjuntas.</p>
        )
      )}

      {viewerIndex !== null && (
        <ImageLightbox
          images={images}
          index={viewerIndex}
          onIndexChange={setViewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      )}
    </div>
  );
}
```

**`src/forms/SolicitudCompraForm.tsx` queda así** (mismo comportamiento, ahora delega):

```tsx
import type { CategoryFormProps } from "./types";
import ImageUploader from "../components/Organisms/ImageUploader";

export type SolicitudCompraPayload = {
  imagenes: string[];
};

export const defaultValue: SolicitudCompraPayload = {
  imagenes: [],
};

export default function SolicitudCompraForm({
  value,
  onChange,
  readOnly = false,
}: CategoryFormProps<SolicitudCompraPayload>) {
  return (
    <ImageUploader
      images={value.imagenes ?? []}
      onChange={(imagenes) => onChange({ ...value, imagenes })}
      readOnly={readOnly}
    />
  );
}
```

### 7.3 — Frontend: formulario de mantenimiento

**Archivo:** `src/forms/SolicitudMantenimientoForm.tsx`

1. Import nuevo:

```tsx
import ImageUploader from "../components/Organisms/ImageUploader";
```

2. Tipos y valor por defecto:

```tsx
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
```

3. Dentro de la tarjeta **"Detalles de Mantenimiento"**, en el `grid` que ya contiene
   *Área o Equipo*, *Ubicación* y *Código*, agregar como cuarto campo:

```tsx
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
```

4. Después de esa misma tarjeta (fuera del `div` de detalles, antes del bloque
   `{showExecSection && ...}`) agregar el cargador de imágenes, para que esté disponible
   **al crear** el ticket y no sólo en el detalle:

```tsx
<ImageUploader
  images={value.imagenes ?? []}
  onChange={(imagenes) => set("imagenes", imagenes)}
  readOnly={readOnly}
/>
```

### 7.4 — El Word NO cambia

**No tocar `src/lib/exportMantenimiento.ts` por este cambio.** El *Tipo de Orden* es un dato
interno de la app: se captura y se consulta en el sistema, pero **no se imprime** en el
FOR-077, que debe seguir calcando el formulario oficial. La celda vacía de la esquina
superior derecha de la tabla principal (`emptyCell(MID + RIGHT, 2, ...)`) **se queda como
está**.

**Las imágenes tampoco se incrustan en el Word**, por la misma razón. Se ven en la app, en
el detalle del ticket.

---

## Cambio 8 — Quitar los textos guía del Word

**Archivo:** `src/lib/exportMantenimiento.ts`

El documento generado no debe arrastrar los textos de ayuda en cursiva gris que trae el
formulario en blanco. En el archivo hay **dos y sólo dos** (se localizan con
`grep -n "italic" src/lib/exportMantenimiento.ts`):

1. **OBSERVACIONES** (línea ~410) — eliminar el párrafo guía completo:

```ts
// ANTES
children: [
  p([run("(Ampliar sobre el trabajo realizado y su estatus)", { italic: true, color: "808080" })], undefined, { before: 0, after: 60 }),
  p([run(payload.observaciones || "")], undefined, { before: 0, after: 0 }),
],

// DESPUÉS
children: [
  p([run(payload.observaciones || "")], undefined, { before: 0, after: 0 }),
],
```

2. **Recibe conforme** — "(Firma de quien recibe)" ya desaparece con el **Cambio 2**, que lo
   reemplaza por el nombre del solicitante. No hay nada extra que hacer aquí.

> Tras esto ningún `run()` usa `italic`; la opción se queda igual en la firma del helper
> (es parte de su API, no genera error de lint).
>
> **Regla general para lo que venga:** el Word sólo lleva datos reales o casillas en blanco,
> nunca instrucciones para quien llena el formulario.

---

## Supuestos tomados (revisar al probar)

1. **Prioridad:** `low` y `medium` caen ambas en "Normal" (el FOR-077 sólo tiene 3 niveles).
2. **Departamento:** es el `originDepartmentId` del **creador** del ticket, no el
   departamento destino (`ticket.departmentId`, que siempre sería Mantenimiento y Seguridad).
   Si el usuario se registró con origen "Otro" (`null`), la casilla sale vacía.
3. **Recibe conforme:** se imprime el nombre del solicitante y se quita el texto guía
   "(Firma de quien recibe)"; queda espacio para la firma manuscrita debajo.
4. **Tipo de Orden:** campo opcional. Se muestra en la tarjeta de detalles (visible al crear
   el ticket) y **no** se imprime en el Word — el FOR-077 se mantiene igual al oficial.
5. **No. de Orden:** se elimina el input manual; el Word toma siempre `ticket.id`.

---

## Verificación

```bash
# Backend
cd leterago-ticket-system-backend
npm run build

# Frontend
cd leterago-ticket-system-frontend
npm run lint
npm run build
```

Pruebas funcionales (con `INICIAR.bat`):

1. Crear un ticket de **Mantenimiento y Seguridad → Solicitud de Mantenimiento** con
   prioridad **Alta**, adjuntando 2 imágenes y eligiendo Tipo de Orden = **Proyectos**.
2. Abrir el detalle: las imágenes se ven y abren en el visor; el Tipo de Orden se conserva.
3. Editar el ticket y llenar el **Registro de Ejecución**: el campo *Realizado por* muestra
   los 6 técnicos al hacer clic y además acepta un nombre escrito a mano.
4. **Descargar Word** y comprobar en el .docx:
   - "No. de Orden: TCK-###" con el id real del ticket.
   - ☒ **Importante** marcado (y sólo ese), en negrita.
   - "Departamento:" con el departamento de origen de quien creó el ticket.
   - "Recibe conforme:" con el nombre del solicitante.
   - La esquina superior derecha sigue **vacía** (el Tipo de Orden no se imprime).
   - **Observaciones** muestra sólo el texto capturado, sin "(Ampliar sobre el trabajo
     realizado y su estatus)"; no queda ningún texto guía en cursiva gris en todo el documento.
   - Las tablas llegan más cerca del borde de la hoja (margen ≈ 1.5 cm).
5. Abrir un ticket de mantenimiento **anterior** a estos cambios: debe seguir cargando y
   exportando sin error (los campos nuevos entran vacíos por los `.default()` de Zod).

---

## Documentación a actualizar (obligatorio por convención del proyecto)

- `leterago-ticket-system-backend/README.md` — forma del payload de `solicitud-mantenimiento`
  (campos nuevos `tipoOrden` e `imagenes`; `noOrden` marcado como legado).
- `leterago-ticket-system-frontend/README.md` — exportación FOR-077 (campos que ahora se
  llenan y de dónde salen), el nuevo `ImageUploader` compartido y el dropdown de técnicos.
- `CLAUDE.md` (sección *Maintenance Export*) — mencionar que el Word ya no usa
  `payload.noOrden`, que el margen lateral se redujo a 850 twips y que se quitaron los
  textos guía del formulario en blanco.
