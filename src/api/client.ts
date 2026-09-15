import type {
  CategoryId,
  DepartmentId,
  TicketEventType,
  TicketPriority,
  TicketStatus,
} from "../types/types";

const API_URL: string =
  (import.meta.env.VITE_API_URL as string | undefined) ?? "/api";

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

type ServerUserRef = {
  id: string;
  name: string;
};

export type DeptPermissions = { departmentId: DepartmentId; permissions: string[] };

export type ServerUser = {
  id: string;
  name: string;
  email: string;
  role: "master" | "admin" | "participant" | "requester";
  status: "active" | "inactive" | "pending";
  lastAccess: string | null;
  originDepartmentId: string | null;
  // `departments` es solo para mostrar (id + rol por-depto). La autorización usa los
  // permisos efectivos resueltos (scoped RBAC), idénticos a los del backend:
  //   permissions       → app-level efectivo (con alcance estricto aplicado)
  //   globalPermissions → permisos de las asignaciones globales (aplican a todo depto)
  //   deptPermissions   → por departamento, los permisos de la asignación en ese depto
  departments: Array<{ departmentId: DepartmentId; role: "admin" | "participant" | "requester" }>;
  // Asignaciones de rol crudas (fuente de verdad) para gestionarlas en la UI.
  roleAssignments: Array<{ roleName: string; departmentId: DepartmentId | null }>;
  permissions: string[];
  globalPermissions: string[];
  deptPermissions: DeptPermissions[];
};

// Login / registro devuelven la misma forma (incluye los permisos resueltos).
export type AuthUser = ServerUser;

export type ServerTicketRating = {
  value: number;            // 1–5
  comment: string | null;
  at: string | null;        // ISO
  by: string | null;        // rater User.id
};

export type ServerTicket = {
  id: string;
  title: string;
  description: string | null;
  departmentId: DepartmentId;
  categoryId: CategoryId;
  status: TicketStatus;
  priority: TicketPriority;
  createdById: string;
  createdBy: ServerUserRef | null;
  assignedToId: string | null;
  assignedTo: ServerUserRef | null;
  executionAt: string | null;
  rating: ServerTicketRating | null;
  payload: unknown | null;
  payloadVersion: number | null;
  createdAt: string;
  updatedAt: string;
};

export type ServerTicketEvent = {
  id: string;
  ticketId: string;
  userId: string;
  user: { id: string; name: string };
  type: TicketEventType;
  from: string | null;
  to: string | null;
  createdAt: string;
};

export type ResolutionStats = {
  avgMs: number | null;
  count: number;
};

export type ServerTicketList = {
  items: ServerTicket[];
  total: number;
  take: number;
  skip: number;
};

export type CreateTicketBody = {
  title: string;
  description?: string;
  departmentId: DepartmentId;
  categoryId: CategoryId;
  priority: TicketPriority;
  assignedToId?: string;
  executionAt?: string;
  payload?: unknown;
};

export type UpdateTicketBody = {
  title?: string;
  description?: string | null;
  status?: TicketStatus;
  priority?: TicketPriority;
  assignedToId?: string | null;
  executionAt?: string | null;
  payload?: unknown;
};

export type ListTicketsQuery = {
  status?: TicketStatus;
  priority?: TicketPriority;
  departmentId?: DepartmentId;
  categoryId?: CategoryId;
  assignedToId?: string;
  createdById?: string;
  search?: string;
  take?: number;
  skip?: number;
};

async function request<T>(
  path: string,
  userId: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(userId ? { "x-user-id": userId } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as Record<string, unknown>);
    const message =
      (body && typeof body === "object" && "error" in body
        ? String((body as { error: unknown }).error)
        : null) ?? `${res.status} ${res.statusText}`;
    const details =
      body && typeof body === "object" && "details" in body
        ? (body as { details: unknown }).details
        : undefined;
    throw new ApiError(res.status, message, details);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

function buildQuery(query: Record<string, unknown> | undefined): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.append(key, String(value));
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

// ─── Catalog ──────────────────────────────────────────────────────────────────

export type ServerCategory = {
  id: string;
  name: string;
  description: string | null;
  departmentId: string;
};

export type ServerDepartment = {
  id: string;
  name: string;
  description: string | null;
  categories: ServerCategory[];
};

// ─── Roles & Permissions ──────────────────────────────────────────────────────

export type RoleDefinition = {
  name: string;
  displayName: string | null;
  description: string;
  isSystem: boolean;
  permissions: string[];
};

export type PermissionEntry = {
  id: string;
  code: string;
  name: string;
  description: string;
  module: string;
};

export type PermissionsByModule = Record<string, PermissionEntry[]>;

// ─────────────────────────────────────────────────────────────────────────────

// Una asignación de rol con ámbito: departmentId = null ⇒ GLOBAL.
export type RoleAssignmentInput = { roleName: string; departmentId: DepartmentId | null };

export type CreateUserBody = {
  name: string;
  email: string;
  password: string;
  assignments: RoleAssignmentInput[];
  originDepartmentId?: string | null;
};

export type UpdateUserBody = {
  name?: string;
  email?: string;
  password?: string;
  assignments?: RoleAssignmentInput[];
  status?: "active" | "inactive" | "pending";
  originDepartmentId?: string | null;
};

export type ServerNotificationPrefs = {
  notifyNuevoTicket: boolean;
  notifyResuelto: boolean;
  notifyConfirmado: boolean;
};

export type ServerComment = {
  id: string;
  ticketId: string;
  userId: string;
  body: string;
  images: string[]; // data-URLs base64 de imágenes adjuntas (vacío si no hay)
  editedAt: string | null;
  createdAt: string;
  user: { id: string; name: string };
};

export const api = {
  // Tickets
  listTickets: (userId: string, query?: ListTicketsQuery) =>
    request<ServerTicketList>(`/tickets${buildQuery(query)}`, userId),

  getTicket: (userId: string, id: string) =>
    request<ServerTicket>(`/tickets/${id}`, userId),

  createTicket: (userId: string, body: CreateTicketBody) =>
    request<ServerTicket>("/tickets", userId, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  updateTicket: (userId: string, id: string, body: UpdateTicketBody) =>
    request<ServerTicket>(`/tickets/${id}`, userId, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  deleteTicket: (userId: string, id: string) =>
    request<void>(`/tickets/${id}`, userId, { method: "DELETE" }),

  rateTicket: (userId: string, id: string, body: { value: number; comment?: string | null }) =>
    request<ServerTicket>(`/tickets/${id}/rating`, userId, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  // Auth
  login: (email: string, password: string) =>
    request<AuthUser>("/auth/login", "", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  // Self-service registration (2 steps)
  registerStart: (body: { name: string; email: string; password: string; originDepartmentId?: string | null }) =>
    request<{ ok: true; emailSent: boolean }>("/auth/register/start", "", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  registerVerify: (body: { email: string; code: string }) =>
    request<AuthUser>("/auth/register/verify", "", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  // Password reset — ¿olvidaste tu contraseña? (2 steps)
  resetStart: (body: { email: string }) =>
    request<{ ok: true; emailSent: boolean }>("/auth/reset/start", "", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  resetVerify: (body: { email: string; code: string; password: string }) =>
    request<{ ok: true }>("/auth/reset/verify", "", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  // Users
  listUsers: (
    userId: string,
    query?: { role?: "master" | "admin" | "participant" | "requester"; departmentId?: DepartmentId },
  ) => request<ServerUser[]>(`/users${buildQuery(query)}`, userId),

  getUser: (userId: string, id: string) =>
    request<ServerUser>(`/users/${id}`, userId),

  createUser: (userId: string, body: CreateUserBody) =>
    request<ServerUser>("/users", userId, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  updateUser: (userId: string, id: string, body: UpdateUserBody) =>
    request<ServerUser>(`/users/${id}`, userId, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  deleteUser: (userId: string, id: string) =>
    request<void>(`/users/${id}`, userId, { method: "DELETE" }),

  // Roles & Permissions
  getRoles: (userId: string) =>
    request<RoleDefinition[]>("/roles", userId),

  getAllPermissions: (userId: string) =>
    request<PermissionsByModule>("/roles/permissions", userId),

  updateRolePermissions: (userId: string, roleName: string, permissionCodes: string[]) =>
    request<RoleDefinition>(`/roles/${encodeURIComponent(roleName)}/permissions`, userId, {
      method: "PUT",
      body: JSON.stringify({ permissionCodes }),
    }),

  updateRole: (userId: string, roleName: string, body: { displayName?: string; description?: string }) =>
    request<RoleDefinition>(`/roles/${encodeURIComponent(roleName)}`, userId, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  createRole: (userId: string, name: string, description: string, permissionCodes: string[]) =>
    request<RoleDefinition>("/roles", userId, {
      method: "POST",
      body: JSON.stringify({ name, description, permissionCodes }),
    }),

  deleteRole: (userId: string, roleName: string) =>
    request<void>(`/roles/${encodeURIComponent(roleName)}`, userId, { method: "DELETE" }),

  // Events & stats
  listEvents: (userId: string, ticketId: string) =>
    request<ServerTicketEvent[]>(`/tickets/${ticketId}/events`, userId),

  getResolutionStats: (userId: string, query?: { fromDate?: string; toDate?: string; departmentIds?: string[] }) =>
    request<ResolutionStats>(`/tickets/resolution-stats${buildQuery({
      fromDate: query?.fromDate,
      toDate: query?.toDate,
      departmentIds: query?.departmentIds?.join(","),
    })}`, userId),

  // Comments
  listComments: (userId: string, ticketId: string) =>
    request<ServerComment[]>(`/tickets/${ticketId}/comments`, userId),

  createComment: (userId: string, ticketId: string, body: string, images: string[] = []) =>
    request<ServerComment>(`/tickets/${ticketId}/comments`, userId, {
      method: "POST",
      body: JSON.stringify({ body, images }),
    }),

  updateComment: (userId: string, ticketId: string, commentId: string, body: string) =>
    request<ServerComment>(`/tickets/${ticketId}/comments/${commentId}`, userId, {
      method: "PATCH",
      body: JSON.stringify({ body }),
    }),

  deleteComment: (userId: string, ticketId: string, commentId: string) =>
    request<void>(`/tickets/${ticketId}/comments/${commentId}`, userId, { method: "DELETE" }),

  // Catalog
  getCatalog: (userId: string) =>
    request<ServerDepartment[]>("/catalog", userId),

  updateDepartment: (userId: string, id: string, body: { name?: string; description?: string | null }) =>
    request<ServerDepartment>(`/catalog/departments/${id}`, userId, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  updateCategory: (userId: string, id: string, body: { name?: string; description?: string | null }) =>
    request<ServerCategory>(`/catalog/categories/${id}`, userId, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  // Notification preferences
  getNotificationPrefs: (userId: string) =>
    request<ServerNotificationPrefs>("/users/me/notification-prefs", userId),

  updateNotificationPrefs: (userId: string, body: Partial<ServerNotificationPrefs>) =>
    request<ServerNotificationPrefs>("/users/me/notification-prefs", userId, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
};
