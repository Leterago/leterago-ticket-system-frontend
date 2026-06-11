# Mesa de Servicio — Frontend

React 19 + Redux Toolkit + Tailwind CSS 4 + Vite.

---

## Estado en Redux

Hay tres slices principales:

### `auth`
```json
{
  "currentUser": {
    "id": "cuid...",
    "name": "Gerald Serra",
    "email": "gerald@leterago.com",
    "role": "master",
    "status": "active",
    "lastAccess": "2026-05-22T15:30:00.000Z",
    "departments": [
      { "departmentId": "compras", "role": "admin" }
    ]
  }
}
```
Persistido en `localStorage` bajo la clave `mesa_auth_user`. Incluye además `permissions: string[]` (códigos del rol).

El login (`/login`) y el registro autoservicio (`/register`) producen este mismo objeto. El registro tiene dos pasos: (1) formulario nombre/correo/contraseña — el correo **debe terminar en `@leterago.com.do`** — que dispara el envío de un código; (2) ingreso del código de 6 dígitos. Al verificar, la cuenta se crea como `requester` con acceso a todos los departamentos y se guarda la sesión vía `setCurrentUser`.

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

## Preferencias de UI (localStorage)

Algunas preferencias se guardan directamente en `localStorage` (sin Redux ni backend), por navegador:

| Clave | Qué guarda |
|---|---|
| `mesa_auth_user` | Sesión del usuario (ver el slice `auth`). |
| `mesa_theme` | Tema `dark`/`light`. Lo **restaura un script inline en `index.html`** antes de montar React —para evitar el parpadeo (FOUC)— añadiendo la clase `.dark` a `<html>`; lo **escribe** `ThemeToggle`. Si no hay valor guardado, respeta el `prefers-color-scheme` del sistema. |
| `mesa_tickets_view` | Vista de la lista de tickets (`compact` / `extended`) para usuarios con permiso extendido. Se lee al inicializar el estado en `Tickets.tsx` y se reescribe en cada cambio. |

---

## Logo de marca (claro/oscuro)

El componente `src/components/Atoms/Logo.tsx` muestra el logo correcto según el tema: la versión azul (`assets/leterago-logo.webp`, fondo transparente) en superficies claras y la versión blanca (`assets/leterago-logo-white.webp`) en oscuras. Renderiza ambas imágenes y alterna su visibilidad con la variante `dark` (`block dark:hidden` / `hidden dark:block`), que reacciona a la clase `.dark` en `<html>` puesta por `ThemeToggle`. Acepta `className` para dimensionar igual que un `<img>`. Se usa en `SideBar`, `LoginPage` y `RegisterPage`.

Los dos WebP se derivan del `leterago-logo.png` original con `scripts/make-logos.cjs` (requiere `sharp`; instalar con `npm i sharp --no-save` y correr `node scripts/make-logos.cjs`). El script quita el fondo blanco por *color-to-alpha* y produce la variante blanca recoloreada.

---

## Página de Configuración (acceso por pestaña)

La ruta `/config` está disponible para **todos los usuarios autenticados** (el enlace aparece en el `SideBar` para cualquier rol). La página muestra hasta cuatro pestañas, pero cada una se renderiza solo si el usuario tiene el permiso correspondiente — el gating vive en `ConfigPage.tsx` usando los helpers de `store/permissions.ts`, que **reflejan los guards del backend**:

| Pestaña | Quién la ve | Helper / guard backend |
|---|---|---|
| **Notificaciones** | Todos | — (rutas `/me/notification-prefs`, sin guard) |
| **Roles y Permisos** | `master` o `admin.roles.create` / `admin.roles.edit` | `canManageRoles` ↔ `requirePerm` |
| **Usuarios** | `master` | `canManageUsers` ↔ `requireMaster` |
| **Departamentos** | `master` | `canManageDepartments` ↔ `requireMaster` |

La pestaña Notificaciones siempre se incluye y queda activa por defecto cuando es la única visible (p. ej. para `requester`/`participant`). Dentro de ella, `ALL_NOTIF_OPTIONS` filtra además qué preferencias se muestran según el rol (un `requester` solo ve "Solicitud confirmada").

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

## Exportación de mantenimiento (FOR-077)

`src/lib/exportMantenimiento.ts` genera un `.docx` que reproduce **exactamente** el formato del formulario oficial **FOR-077 "Orden de Trabajo de Mantenimiento" V-4** (fuente Verdana, A4, encabezado con logo + título + bloque de documento, casillas "NIVEL DE PRIORIDAD", barras negras `DESCRIPCION` / `REALIZADO POR` / `OBSERVACIONES`, pie confidencial). Solo se rellenan los campos que captura la app:

| Campo del formulario | Origen en la app |
|----------------------|------------------|
| No. de Orden | `payload.noOrden` (campo string, se llena al **editar** el ticket) |
| Fecha / Hora | `ticket.createdAt` |
| Solicitado por | `ticket.createdBy` |
| Nivel de prioridad | `ticket.priority` (urgent→Urgente · high→Importante · medium/low→Normal) |
| Área o Equipo · Código · Ubicación | `payload.area` · `payload.codigo` · `payload.ubicacion` |
| Descripción | `ticket.description` |
| Realizado por (filas) | `payload.registros[]` |
| Observaciones | `payload.observaciones` |

> El logo va incrustado desde `src/assets/for077-logo.png`. Es una imagen **inline**, así que su celda en el encabezado debe ser más ancha que la imagen o Word la recorta.
