# Mesa de Servicio — Frontend

React 19 + Redux Toolkit + Tailwind CSS 4 + Vite.

---

## Estado en Redux

Hay tres slices principales:

### `auth`
```json
{
  "currentUser": {
    "id": "852108",
    "name": "Wendy Castillo",
    "email": "wendy@leterago.com",
    "status": "active",
    "lastAccess": "2026-05-22T15:30:00.000Z",
    "roleAssignments": [
      { "roleName": "participant", "departmentId": "servicios-generales" }
    ],
    "role": "participant",
    "departments": [{ "departmentId": "servicios-generales", "role": "participant" }],
    "permissions": ["tickets.create", "tickets.view_department", "tickets.change_status", "tickets.comment"],
    "globalPermissions": [],
    "deptPermissions": [
      { "departmentId": "servicios-generales", "permissions": ["tickets.create", "tickets.view_department", "tickets.change_status", "tickets.comment"] }
    ]
  }
}
```
Persistido en `localStorage` bajo la clave `mesa_auth_user`. **Scoped RBAC:** `roleAssignments` (`{ roleName, departmentId }`, `null` = GLOBAL) es la fuente de verdad; la autorización usa los permisos resueltos (`permissions` app-level con alcance estricto, `globalPermissions`, `deptPermissions`). `role` y `departments` son **derivados solo para mostrar** (avatares, badges, filtro). Ningún chequeo mira un nombre de rol. Tras `fetchUsers`, `App.tsx` refresca estos campos del usuario logueado desde la lista autoritativa (auto-reparación de sesiones viejas).

El login (`/login`) y el registro autoservicio (`/register`) producen este mismo objeto. El registro tiene dos pasos: (1) formulario nombre/correo/contraseña — el correo **debe terminar en `@leterago.com.do`** — que dispara el envío de un código; (2) ingreso del código de 6 dígitos. Al verificar, la cuenta se crea con una asignación `requester` en cada departamento y se guarda la sesión vía `setCurrentUser`.

**Recuperar contraseña** (`/forgot-password`, `ForgotPasswordPage`, enlazado desde el login con "¿Olvidaste tu contraseña?"): flujo de tres pasos — (1) correo → `api.resetStart`; (2) código de 6 dígitos + nueva contraseña → `api.resetVerify`; (3) pantalla de éxito con botón a `/login`. **No** inicia sesión al terminar (a diferencia del registro): el usuario vuelve al login con su nueva contraseña. El mensaje del paso 1 es deliberadamente ambiguo ("si existe una cuenta con ese correo…") porque el backend responde igual exista o no la cuenta (anti-enumeración).

---

### `tickets`
```json
{
  "tickets": [ ...Ticket[] ],
  "status": "idle | loading | ready | error",
  "fetchError": null,
  "creating": false,
  "createError": null,
  "mutationError": null
}
```

Objeto `Ticket` en el store:
```json
{
  "id": "TCK-001",
  "title": "Compra de sillas",
  "description": "...",
  "departmentId": "compras",
  "categoryId": "solicitud-compra",
  "status": "in_progress",
  "priority": "high",
  "createdById": "cuid...",
  "createdBy": "Gerald Serra",
  "assignedToId": "483921",
  "assignedTo": "Ana López",
  "executionAt": "2026-06-01T00:00:00.000Z",
  "rating": { "value": 5, "comment": "Rápido y bien gestionado.", "at": "...", "by": "474984" },
  "payload": { ... },
  "payloadVersion": 2,
  "createdAt": "2026-05-20T10:00:00.000Z",
  "updatedAt": "2026-05-22T14:30:00.000Z"
}
```

> `payload` solo está hidratado en tickets que hayan pasado por `fetchTicketDetailAsync`. Los que vienen del listado tienen `payload: undefined`.

> **Identidad por id, nombre solo para mostrar.** `assignedToId` (y `createdById`) son los campos para comparar identidad/permisos — espejan la lógica del backend (`lib/permissions.ts` usa `assignedToId === user.id`). `assignedTo`/`createdBy` son nombres de display y **nunca** deben usarse para igualar usuarios (un rename rompería la relación).

> **`rating` (calificación de satisfacción).** Objeto anidado `{ value, comment, at, by } | null` (`TicketRating` en `types.ts`), espejando la API. El átomo `StarRating` lo renderiza; `TicketRatingCard` (sidebar del detalle) lo captura — **solo el creador**, con el ticket `completed`/`confirmed`, vía `api.rateTicket` → `rateTicketAsync`. El dashboard muestra promedio + tasa de respuesta.

---

### `users`
```json
{
  "list": [ ...ServerUser[] ],
  "status": "idle | loading | ready | error",
  "error": null
}
```

> Los nombres de usuario llegan **normalizados a Title Case** desde el backend (`gErAld` → `Gerald`); el cliente no los transforma — muestra el nombre tal como lo devuelve la API tras crear, editar o registrar. Por eso `createUserAsync`/`updateUserAsync` guardan en el store la respuesta del servidor, no el texto del formulario.

> **Permisos resueltos por usuario (scoped RBAC).** Cada `ServerUser`/`AppUser` trae `roleAssignments` (fuente de verdad) y sus permisos resueltos `permissions` (app-level, alcance estricto) / `globalPermissions` / `deptPermissions[]` (mismos que en `/login`, para *todos* los usuarios de la lista). `store/permissions.ts` autoriza **solo por permiso**, sin nombres de rol: `hasApp(code)` (usa `permissions`) y `hasInDept(dept, code)` (= `globalPermissions ∪ deptPermissions[dept]`). Helpers: `canViewTicket/canEditTicket/canChangeStatus/canAssign/canConfirm/canViewExtended`, `canSeeAllTickets`/`viewableDepartmentIds` (filtros de lista en `Tickets.tsx`/`TicketsTable.tsx`), `creatableDepartmentIds` (departamentos cuyas categorías se ofrecen al crear, en `CreateTicketPage.tsx`), `canViewDashboard` (`dashboard.view`, redirect en `App.tsx`), `canManageUsers/Roles/Departments` (Config). El selector "Asignado a" usa `canChangeStatusInDept(user, dept)` = `hasInDept(dept, "tickets.change_status")`. `role`/`departments` en el usuario son **solo para mostrar** (avatares, badges, filtro por departamento) — **nunca** para autorizar. En particular, `CreateTicketPage` deriva las categorías disponibles de `creatableDepartmentIds` (= `hasInDept(dept, "tickets.create")`), **no** de `departments`: así un `requester` **GLOBAL** (asignación con `departmentId=null`, sin entradas por-departamento) también puede crear en todos los departamentos. Antes leía `departments` y a un global (cuya lista sale vacía) no le aparecía **ninguna** categoría.

---

### `notifications`

Sistema de notificaciones local (cliente). Única fuente de verdad para **los toasts** y para **el centro de notificaciones del NavBar** (campana).

```json
{
  "items": [
    {
      "id": "nanoid",
      "kind": "success | error | info | warning",
      "title": "Ticket asignado satisfactoriamente",
      "message": "Asignado a Ana López",
      "link": "/ticket-detail/TCK-001",
      "createdAt": 1717000000000,
      "read": false
    }
  ],
  "toasts": ["nanoid"]
}
```

- `items`: historial (máx. 50, más reciente primero) que alimenta la campana. El badge rojo muestra los `read: false`.
- `toasts`: ids visibles ahora mismo como toast flotante (auto-cierre: 4s éxito/info, 5s warning, 6s error).

La acción `notify({ kind, title, message?, link? })` empuja a ambos a la vez. Los thunks de tickets (`createTicketAsync`, `updateTicketAsync`, `deleteTicketAsync` en `ticketsSlice`) la despachan automáticamente, derivando el mensaje del cambio real (asignación, estado, prioridad, etc.). El `<Toaster />` se monta en `RootTemplate`.

---

## Tooltips (MUI)

Se usa `@mui/material` (con Emotion) **solo** para su componente `Tooltip`; todo lo demás es Tailwind. Está aplicado en el ícono **"Ver detalles"** de la tabla extendida (`TicketsTable`) y en cada estrella de `StarRating` (con su `RATING_LABELS`). Las estrellas en modo solo lectura están `disabled`, por lo que su `<button>` va envuelto en un `<span>` para que el tooltip se dispare igual. No hay `ThemeProvider`: el `Tooltip` usa el tema por defecto de MUI.

---

## Preferencias de UI (localStorage)

Algunas preferencias se guardan directamente en `localStorage` (sin Redux ni backend), por navegador:

| Clave | Qué guarda |
|---|---|
| `mesa_auth_user` | Sesión del usuario (ver el slice `auth`). |
| `mesa_theme` | Tema `dark`/`light`. Lo **restaura un script inline en `index.html`** antes de montar React —para evitar el parpadeo (FOUC)— añadiendo la clase `.dark` a `<html>`; lo **escribe** `ThemeToggle`. Si no hay valor guardado, respeta el `prefers-color-scheme` del sistema. |
| `mesa_tickets_view` | Vista de la lista de tickets (`compact` / `extended`) para usuarios con permiso extendido. Se lee al inicializar el estado en `Tickets.tsx` y se reescribe en cada cambio. |
| `mesa_tickets_page_size` | Filas por página de la tabla compacta (selector "Filas" en la barra de filtros de `TicketsTable.tsx`, al extremo derecho junto a los demás dropdowns; opciones 8/15/25/50/100). Más filas ⇒ tabla más alta (no hay alto fijo). Se lee al inicializar y se reescribe al cambiar. |

---

## Logo de marca (claro/oscuro)

El componente `src/components/Atoms/Logo.tsx` muestra el logo correcto según el tema: la versión azul (`assets/leterago-logo.webp`, fondo transparente) en superficies claras y la versión blanca (`assets/leterago-logo-white.webp`) en oscuras. Renderiza ambas imágenes y alterna su visibilidad con la variante `dark` (`block dark:hidden` / `hidden dark:block`), que reacciona a la clase `.dark` en `<html>` puesta por `ThemeToggle`. Acepta `className` para dimensionar igual que un `<img>`. Se usa en `SideBar`, `LoginPage` y `RegisterPage`.

Los dos WebP se derivan del `leterago-logo.png` original con `scripts/make-logos.cjs` (requiere `sharp`; instalar con `npm i sharp --no-save` y correr `node scripts/make-logos.cjs`). El script quita el fondo blanco por *color-to-alpha* y produce la variante blanca recoloreada.

---

## Página de Configuración (acceso por pestaña)

La ruta `/config` está disponible para **todos los usuarios autenticados** (el enlace aparece en el `SideBar` para cualquier rol). La página muestra hasta cuatro pestañas, pero cada una se renderiza solo si el usuario tiene el permiso correspondiente — el gating vive en `ConfigPage.tsx` usando los helpers de `store/permissions.ts`, que **reflejan los guards del backend**:

El gating es **por permiso** (alcance estricto: estos códigos solo cuentan desde una asignación global):

| Pestaña | Permiso requerido | Helper / guard backend |
|---|---|---|
| **Notificaciones** | — (siempre; prefs propias) | — |
| **Roles y Permisos** | `admin.roles.create` / `admin.roles.edit` | `canManageRoles` ↔ `requirePerm` |
| **Usuarios** | `users.manage` | `canManageUsers` ↔ `requirePermission("users.manage")` |
| **Departamentos** | `config.departments.edit` | `canManageDepartments` ↔ `requirePermission("config.departments.edit")` |

La pestaña **Usuarios** es un **editor de la lista de asignaciones** del usuario (`{ rol, departamento | Global }`): `create/updateUser` envían `assignments: [{ roleName, departmentId|null }]`. La pestaña Notificaciones siempre se incluye. Dentro de ella, `ALL_NOTIF_OPTIONS` aún filtra qué preferencias se muestran según el `role` derivado (uso cosmético).

---

## Departamento de origen (registro + tabla de usuarios)

El registro autoservicio (`RegisterPage`) incluye un dropdown **"Departamento de origen"** (requerido) con **todos los departamentos** (`DEPARTMENTS` en `config/catalog.ts`) más **"Otro"** (→ `originDepartmentId: null`). La columna **"Departamentos"** de la tabla de usuarios (Config → Usuarios) muestra **solo el departamento de origen** (`departmentLabel(u.originDepartmentId)`), no los departamentos de acceso; `null` se muestra como "Otro". Un departamento sin categorías (hoy todos salvo `compras`, `servicios-generales` y `mantenimiento-seguridad`) es un departamento normal que **aún** no aparece en la creación/filtros de tickets — eso se deriva en vivo de sus categorías (`DEPARTMENT_IDS_WITH_CATEGORIES`), no es una clasificación fija; al recibir una categoría aparece automáticamente. El editor de usuarios en Config ofrece todos los departamentos como origen y como acceso.

---

## Tipos de eventos de ticket (`TicketEvent`)

Los eventos se obtienen por demanda en `GET /tickets/:id/events` y se almacenan en estado local del componente `TicketDetailPage`. No pasan por Redux.

```json
{
  "id": "cuid...",
  "ticketId": "TCK-001",
  "userId": "cuid...",
  "user": { "id": "cuid...", "name": "Gerald Serra" },
  "type": "status_changed",
  "from": "pending",
  "to": "in_progress",
  "createdAt": "2026-05-22T11:00:00.000Z"
}
```

Tipos posibles: `created`, `status_changed`, `assigned`, `unassigned`, `priority_changed`, `title_changed`, `payload_updated`.

---

## Cambio de estado: requiere asignación

El selector **Estado** de la página de detalle (`TicketDetailPage`) **deshabilita** las opciones que avanzan el ticket —`En progreso`, `Resuelto`, `Confirmado`— mientras el ticket **no tenga un asignado**, con un *tooltip* ("Asigna el ticket a alguien antes de avanzar su estado."). `Pendiente` y `Cancelado` siempre quedan disponibles. Espeja la validación del backend (`statusRequiresAssignee` en `lib/catalog.ts`, aplicada en `PATCH /tickets/:id`): aunque se forzara el cambio, la API responde `400`. El modo edición no incluye control de estado, así que el `BoxDropdown` de Estado es la **única** vía de transición en la UI.

---

## Formulario de mantenimiento

`src/forms/SolicitudMantenimientoForm.tsx` tiene dos bloques: la tarjeta **"Detalles de Mantenimiento"** (visible al crear el ticket) y el **"Registro de Ejecución"**, que sólo aparece con `showExecSection` (página de detalle).

- **Tipo de Orden** — dropdown opcional (`Mejora` · `Proyectos` · `OT Terceros`, `TIPOS_ORDEN`) guardado en `payload.tipoOrden`. Es dato interno: **no** sale en el Word.
- **Realizado por** — `input` con `list={TECNICOS_LIST_ID}` y un `<datalist>` con `TECNICOS_MANTENIMIENTO` (los 6 técnicos): sugiere al hacer clic pero **acepta cualquier nombre escrito**. El `datalist` se declara una sola vez para todas las filas.
- **No. de Orden** ya no se captura: el Word imprime `ticket.id`. El campo `noOrden` sigue en el tipo y en el schema Zod sólo por los tickets ya guardados.
- **Imágenes** — `ImageUploader` compartido (ver más abajo).

---

## Exportación de mantenimiento (FOR-077)

`src/lib/exportMantenimiento.ts` genera un `.docx` que reproduce **exactamente** el formato del formulario oficial **FOR-077 "Orden de Trabajo de Mantenimiento" V-4** (fuente Verdana, A4, encabezado con logo + título + bloque de documento, casillas "NIVEL DE PRIORIDAD", barras negras `DESCRIPCION` / `REALIZADO POR` / `OBSERVACIONES`, pie confidencial). Solo se rellenan los campos que captura la app:

| Campo del formulario | Origen en la app |
|----------------------|------------------|
| No. de Orden | `ticket.id` (ej. `TCK-329`) — ya **no** se captura a mano |
| Fecha / Hora | `ticket.createdAt` |
| Solicitado por | `ticket.createdBy` |
| Departamento | Departamento **de origen del solicitante** (`originDepartmentId` del creador) |
| Nivel de prioridad | `ticket.priority` (urgent→Urgente · high→Importante · medium/low→Normal) |
| Área o Equipo · Código · Ubicación | `payload.area` · `payload.codigo` · `payload.ubicacion` |
| Descripción | `ticket.description` |
| Realizado por (filas) | `payload.registros[]` |
| Observaciones | `payload.observaciones` |
| Recibe conforme | `ticket.createdBy` |

> El logo va incrustado desde `src/assets/for077-logo.png`. Es una imagen **inline**, así que su celda en el encabezado debe ser más ancha que la imagen o Word la recorta.

Detalles que conviene no romper:

- **El departamento no viaja en el ticket.** `exportMantenimientoDocx(ticket, payload, opts)` recibe la etiqueta ya resuelta en `opts.departamento`; quien la resuelve es `TicketDetailPage`, buscando al creador en `state.users.list` y pasándola por `departmentLabel(...)`.
- **Las casillas del nivel de prioridad** se dibujan con un `TextRun` propio en fuente `Segoe UI Symbol`: Verdana no trae los glifos `☒`/`☐` y Word los sustituye mal. La opción marcada va además en **negrita**.
- **Márgenes laterales de 850 twips** (1.5 cm, antes 1699). Todo el ancho de tablas se deriva de `CW`, así que cambiar el margen basta; sólo `H_LOGO`/`H_INFO` son fijos.
- **Sin textos guía.** El documento generado no lleva las indicaciones en cursiva gris del formulario en blanco ("(Ampliar sobre el trabajo realizado…)", "(Firma de quien recibe)"): sólo datos reales o casillas vacías.
- **`payload.tipoOrden` no se imprime** — es dato interno de la app; el Word conserva los campos del formulario oficial.

---

## Imágenes adjuntas y visor (lightbox)

La **compresión en el cliente** vive en `src/lib/compressImage.ts` (`compressImage(file, { maxDimension, quality })` + `IMAGE_MAX_BYTES`): canvas → JPEG, redimensiona por el **lado más largo** (máx. 1280 px), calidad 0.75, límite de **5 MB por archivo** antes de comprimir. Devuelve un data-URL. La usan tanto el formulario de compra como los comentarios.

Dos lugares adjuntan imágenes:

- **Categorías `solicitud-compra` y `solicitud-mantenimiento`** — ambas usan el mismo Organism `ImageUploader` (`src/components/Organisms/ImageUploader.tsx`): captura por selector, *drag-and-drop* o **pegado (Ctrl+V)**, compresión con `compressImage` y guardado en el payload como `imagenes: string[]`. En `readOnly` (detalle) muestra una rejilla de miniaturas (`object-cover`). `SolicitudCompraForm` es sólo un envoltorio del componente; `SolicitudMantenimientoForm` lo renderiza debajo de su tarjeta de detalles.
- **Comentarios de tickets** — `TicketComments` (`src/components/Organisms/TicketComments.tsx`) permite adjuntar imágenes a un comentario (botón 📎 o **pegar**), con previsualización y borrado antes de enviar (**máx. 6**, mismo tope que el backend). Se envían con `api.createComment(userId, ticketId, body, images)`; un comentario puede ser **solo texto, solo imágenes o ambos**. Cada `ServerComment` trae `images: string[]`, que la burbuja renderiza como miniaturas que abren el visor.

El **visor** es `src/components/Organisms/ImageLightbox.tsx`, reutilizable con cualquier `string[]`:

- Se abre al hacer **clic en una miniatura** (en vista y en edición); las miniaturas muestran un icono *zoom* al pasar el cursor (`cursor-zoom-in`). El botón de borrar (✕, solo en edición) hace `stopPropagation` para no abrir el visor.
- Muestra la imagen **a tamaño completo sin recortar** (`object-contain`, hasta `90vh`/`92vw`).
- Navega entre varias imágenes con flechas en pantalla o **←/→** del teclado (con vuelta circular) y muestra un contador `n / total`.
- Cierra con la **✕**, **Escape** o clic en el fondo; permite **descargar** la imagen; **bloquea el scroll del fondo** mientras está abierto.
- Se renderiza con `createPortal` sobre `document.body` (`z-[9999]`) para escapar de `overflow-hidden`/stacking contexts — siguiendo la convención de overlays Tailwind del proyecto (sin MUI Modal). Si otra categoría añade imágenes en el futuro, basta con reutilizar este componente.
