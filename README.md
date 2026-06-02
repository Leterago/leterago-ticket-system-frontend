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
  "assignedTo": "Ana López",
  "executionAt": "2026-06-01T00:00:00.000Z",
  "payload": { ... },
  "payloadVersion": 2,
  "createdAt": "2026-05-20T10:00:00.000Z",
  "updatedAt": "2026-05-22T14:30:00.000Z"
}
```

> `payload` solo está hidratado en tickets que hayan pasado por `fetchTicketDetailAsync`. Los que vienen del listado tienen `payload: undefined`.

---

### `users`
```json
{
  "list": [ ...ServerUser[] ],
  "status": "idle | loading | ready | error",
  "error": null
}
```

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
