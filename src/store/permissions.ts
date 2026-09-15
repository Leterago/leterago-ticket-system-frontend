import type { AppUser } from "./authSlice";
import type { Ticket, DepartmentId } from "../types/types";
import { DEPARTMENTS } from "../config/catalog";

const ALL_DEPARTMENT_IDS = Object.keys(DEPARTMENTS) as DepartmentId[];

// ─── Autorización 100% por permiso (NUNCA por nombre de rol) — espejo del backend ──
// Un rol es solo un paquete de permisos; no hay caso especial para "master".

/** Permiso de alcance APP (gestión, vista extendida, dashboard, ver todo). */
function hasApp(user: AppUser, code: string): boolean {
  return (user.permissions ?? []).includes(code);
}

/** Permiso de alcance DEPARTAMENTO: lo concede una asignación GLOBAL o la del depto. */
function hasInDept(user: AppUser, departmentId: string, code: string): boolean {
  if ((user.globalPermissions ?? []).includes(code)) return true;
  const d = (user.deptPermissions ?? []).find((x) => x.departmentId === departmentId);
  return !!d && d.permissions.includes(code);
}

/** Baseline: siempre ves lo que creaste o se te asignó. */
function isOwn(user: AppUser, ticket: Ticket): boolean {
  return ticket.createdById === user.id || ticket.assignedToId === user.id;
}

export function canViewTicket(user: AppUser, ticket: Ticket): boolean {
  return (
    hasApp(user, "tickets.view_all") ||
    hasInDept(user, ticket.departmentId, "tickets.view_department") ||
    isOwn(user, ticket)
  );
}

export function canEditTicket(user: AppUser, ticket: Ticket): boolean {
  return hasInDept(user, ticket.departmentId, "tickets.edit");
}

export function canChangeStatus(user: AppUser, ticket: Ticket): boolean {
  return hasInDept(user, ticket.departmentId, "tickets.change_status");
}

/** Para el selector "Asignado a": ¿este usuario puede cambiar estados en ese depto? */
export function canChangeStatusInDept(user: AppUser, departmentId: string): boolean {
  return hasInDept(user, departmentId, "tickets.change_status");
}

export function canAssign(user: AppUser, ticket: Ticket): boolean {
  return hasInDept(user, ticket.departmentId, "tickets.assign");
}

export function canConfirm(user: AppUser, ticket: Ticket): boolean {
  return hasInDept(user, ticket.departmentId, "tickets.confirm");
}

export function canViewExtended(user: AppUser): boolean {
  return hasApp(user, "tickets.view_extended");
}

// ─── Visibilidad de la lista de tickets (espejo del scoping del backend) ───────────

/** Ve todos los tickets: view_all (estricto/global) o view_department en una asignación global. */
export function canSeeAllTickets(user: AppUser): boolean {
  return hasApp(user, "tickets.view_all") || (user.globalPermissions ?? []).includes("tickets.view_department");
}

/** Departamentos cuyos tickets puede ver por tener view_department en ese depto. */
export function viewableDepartmentIds(user: AppUser): DepartmentId[] {
  return (user.deptPermissions ?? [])
    .filter((d) => d.permissions.includes("tickets.view_department"))
    .map((d) => d.departmentId);
}

/**
 * Departamentos donde el usuario puede CREAR tickets: tiene `tickets.create` por una
 * asignación GLOBAL (aplica a todos los departamentos) o en la asignación de ese
 * departamento. Espejo de `hasInDept` — por eso un `requester` GLOBAL (sin asignaciones
 * por-departamento) también los ve todos, no solo los de `deptPermissions`.
 */
export function creatableDepartmentIds(user: AppUser): DepartmentId[] {
  return ALL_DEPARTMENT_IDS.filter((d) => hasInDept(user, d, "tickets.create"));
}

/** Acceso al Dashboard. */
export function canViewDashboard(user: AppUser): boolean {
  return hasApp(user, "dashboard.view");
}

// ─── Secciones de Configuración (por permiso, espejo del backend) ──────────────────

export function canManageUsers(user: AppUser): boolean {
  return hasApp(user, "users.manage");
}

export function canManageRoles(user: AppUser): boolean {
  return hasApp(user, "admin.roles.create") || hasApp(user, "admin.roles.edit");
}

export function canManageDepartments(user: AppUser): boolean {
  return hasApp(user, "config.departments.edit");
}
