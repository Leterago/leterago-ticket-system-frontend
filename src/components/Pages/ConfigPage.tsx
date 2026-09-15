import { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  Plus, Pencil, Trash2, X, Shield, Users, User, Settings,
  ShieldCheck, ChevronRight, Check, Loader2, AlertCircle, Building2,
  UserX, UserCheck, Clock, Search, ChevronDown, Bell,
} from "lucide-react";
import PageHeader from "../Molecules/PageHeader";
import { useAppDispatch, useAppSelector, useCurrentUser } from "../../store/hooks";
import { canManageUsers, canManageRoles, canManageDepartments } from "../../store/permissions";
import {
  fetchUsers,
  createUserAsync,
  updateUserAsync,
  deleteUserAsync,
  clearUsersMutationError,
} from "../../store/usersSlice";
import type { AppUser, UserRole } from "../../store/authSlice";
import { DEPARTMENTS, departmentLabel } from "../../config/catalog";
import type { DepartmentId } from "../../types/types";
import { getInitials } from "../../lib/initials";
import { api, ApiError } from "../../api/client";
import type { RoleDefinition, PermissionsByModule, PermissionEntry, ServerDepartment, ServerCategory, ServerNotificationPrefs } from "../../api/client";

// ─── Tab navigation ───────────────────────────────────────────────────────────

type Tab = "usuarios" | "roles" | "departamentos" | "notificaciones";

export default function ConfigPage() {
  const currentUser = useCurrentUser();
  const [newUserTick, setNewUserTick] = useState(0);

  // Notificaciones is available to everyone (own preferences); the rest of the
  // sections appear only when the user has the matching permission.
  const visibleTabs = useMemo(() => {
    const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [];
    if (canManageUsers(currentUser))       tabs.push({ id: "usuarios",      label: "Usuarios",         icon: <User size={14} /> });
    if (canManageRoles(currentUser))       tabs.push({ id: "roles",         label: "Roles y Permisos", icon: <ShieldCheck size={14} /> });
    if (canManageDepartments(currentUser)) tabs.push({ id: "departamentos", label: "Departamentos",    icon: <Building2 size={14} /> });
    tabs.push({ id: "notificaciones", label: "Notificaciones", icon: <Bell size={14} /> });
    return tabs;
  }, [currentUser]);

  const [activeTab, setActiveTab] = useState<Tab>(visibleTabs[0].id);

  return (
    <div className="flex flex-col w-full min-h-screen p-6 gap-5 max-w-screen-2xl mx-auto">
      <div className="flex justify-between items-start gap-4 flex-wrap">
        <PageHeader
          title="Configuración"
          description="Gestión de tu cuenta y, según tus permisos, del sistema."
        />
        {activeTab === "usuarios" && (
          <button
            onClick={() => setNewUserTick((t) => t + 1)}
            className="flex items-center gap-2 bg-[#0047AC] text-white text-sm px-4 py-2.5 rounded-md font-semibold hover:bg-blue-700 transition-colors shrink-0"
          >
            <Plus size={15} />
            Nuevo Usuario
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {visibleTabs.map((tab) => (
          <TabButton key={tab.id} active={activeTab === tab.id} onClick={() => setActiveTab(tab.id)}>
            {tab.icon}
            {tab.label}
          </TabButton>
        ))}
      </div>

      {activeTab === "usuarios"       && <UsersTab newUserTick={newUserTick} />}
      {activeTab === "roles"          && <RolesTab />}
      {activeTab === "departamentos"  && <DepartamentosTab />}
      {activeTab === "notificaciones" && <NotificacionesTab />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
        active
          ? "border-[#0047AC] text-[#0047AC]"
          : "border-transparent text-gray-500 hover:text-gray-700"
      }`}
    >
      {children}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 1: Usuarios (existing user management, extracted as component)
// ─────────────────────────────────────────────────────────────────────────────

const ROLE_OPTIONS: { value: UserRole; label: string; icon: typeof Shield; bg: string; description: string }[] = [
  { value: "master",      label: "Máster",       icon: Shield, bg: "bg-indigo-600",   description: "Acceso total + configuración" },
  { value: "admin",       label: "Admin",         icon: Shield, bg: "bg-[#0047AC]",   description: "Asigna y confirma en sus dptos" },
  { value: "participant", label: "Participante",  icon: Users,  bg: "bg-emerald-500", description: "Ve y resuelve tickets de su dpto" },
  { value: "requester",   label: "Solicitante",   icon: User,   bg: "bg-slate-400",   description: "Crea y ve sus propios tickets" },
];

const DEPARTMENT_LIST = Object.keys(DEPARTMENTS) as DepartmentId[];

// ─── Status helpers ───────────────────────────────────────────────────────────

type UserStatus = "active" | "inactive";

function StatusBadge({ status, lastAccess }: { status: string; lastAccess?: string | null }) {
  if (status === "inactive") {
    return (
      <div className="inline-flex items-center gap-1 text-[12px] border h-7 px-3 py-1 bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20 rounded-full font-normal">
        <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444]" /> Inactivo
      </div>
    );
  }
  if (status === "active" && !lastAccess) {
    return (
      <div className="inline-flex items-center gap-1 text-[12px] border h-7 px-3 py-1 bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/20 rounded-full font-normal">
        <Clock size={14} /> Pendiente
      </div>
    );
  }
  return (
    <div className="inline-flex items-center gap-1 text-[12px] border h-7 px-3 py-1 bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20 rounded-full font-normal">
      <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" /> Activo
    </div>
  );
}

function formatLastAccess(iso: string | null | undefined): { text: string; title: string } {
  if (!iso) return { text: "Nunca", title: "Sin acceso registrado" };
  const date = new Date(iso);
  const diff = Date.now() - date.getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  let text: string;
  if (mins  < 1)  text = "Justo ahora";
  else if (mins  < 60) text = `Hace ${mins}m`;
  else if (hours < 24) text = `Hace ${hours}h`;
  else if (days  < 30) text = `Hace ${days}d`;
  else text = date.toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" });
  return { text, title: date.toLocaleString("es") };
}

// ─── UsersTab ─────────────────────────────────────────────────────────────────

function UsersTab({ newUserTick = 0 }: { newUserTick?: number }) {
  const dispatch = useAppDispatch();
  const currentUser = useCurrentUser();
  const users = useAppSelector((s) => s.users.list);
  const mutationError = useAppSelector((s) => s.users.mutationError);

  const [editing, setEditing] = useState<AppUser | "new" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AppUser | null>(null);
  const [openMenu, setOpenMenu] = useState<{ id: string; top: number; right: number } | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deptFilter, setDeptFilter] = useState("all");

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (statusFilter === "active"   && !(u.status === "active"   && u.lastAccess !== null)) return false;
      if (statusFilter === "pending"  && !(u.status === "active"   && u.lastAccess === null)) return false;
      if (statusFilter === "inactive" && u.status !== "inactive") return false;
      if (deptFilter !== "all" && !u.departments.some((d) => d.departmentId === deptFilter)) return false;
      if (search) {
        const q = search.toLowerCase();
        return u.name.toLowerCase().includes(q) || (u.email ?? "").toLowerCase().includes(q);
      }
      return true;
    });
  }, [users, search, statusFilter, deptFilter]);

  useEffect(() => {
    dispatch(fetchUsers());
  }, [dispatch]);

  useEffect(() => {
    return () => { dispatch(clearUsersMutationError()); };
  }, [dispatch]);

  useEffect(() => {
    if (newUserTick === 0) return;
    dispatch(clearUsersMutationError());
    setEditing("new");
  }, [newUserTick]);

  useEffect(() => {
    const close = () => setOpenMenu(null);
    document.addEventListener("mousedown", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, []);

  const handleDelete = async (user: AppUser) => {
    await dispatch(deleteUserAsync(user.id));
    setConfirmDelete(null);
  };

  const handleStatusToggle = (u: AppUser) => {
    if (u.status === "inactive" && u.lastAccess === null) return;
    const newStatus: UserStatus = u.status === "inactive" ? "active" : "inactive";
    dispatch(updateUserAsync({ id: u.id, changes: { status: newStatus } }));
  };

  return (
    <>
      {mutationError && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700 flex justify-between items-start">
          <div>
            <strong className="block text-xs uppercase tracking-wider mb-1">Error</strong>
            {mutationError}
          </div>
          <button onClick={() => dispatch(clearUsersMutationError())} className="p-1 rounded hover:bg-red-100">
            <X size={14} />
          </button>
        </div>
      )}

      <div className="flex flex-col bg-white border border-gray-200 rounded-lg overflow-hidden">
        {/* Header with total user count */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">Usuarios</h3>
          <span className="text-xs font-medium text-gray-400">
            {filteredUsers.length === users.length
              ? `${users.length} ${users.length === 1 ? "usuario" : "usuarios"} en total`
              : `${filteredUsers.length} de ${users.length} usuarios`}
          </span>
        </div>
        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-3 p-4 border-b border-gray-100">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-300" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre o email..."
              className="w-full rounded-md border border-gray-200 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#0047AC] transition-all"
            />
          </div>
          <FilterSelect
            value={statusFilter}
            onChange={setStatusFilter}
            label="Estado"
            className="w-40"
            options={[
              { value: "all",      label: "Todos" },
              { value: "active",   label: "Activo" },
              { value: "pending",  label: "Pendiente" },
              { value: "inactive", label: "Inactivo" },
            ]}
          />
          <FilterSelect
            value={deptFilter}
            onChange={setDeptFilter}
            label="Departamento"
            className="w-56"
            options={[
              { value: "all", label: "Todos" },
              ...DEPARTMENT_LIST.map((d) => ({ value: d, label: DEPARTMENTS[d].label })),
            ]}
          />
          {(search || statusFilter !== "all" || deptFilter !== "all") && (
            <button
              onClick={() => { setSearch(""); setStatusFilter("all"); setDeptFilter("all"); }}
              className="text-xs text-[#0047AC] font-semibold hover:underline whitespace-nowrap"
            >
              Limpiar filtros
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <Th>Usuario</Th>
                <Th>Email</Th>
                <Th>Estado</Th>
                <Th>Departamentos</Th>
                <Th>Último acceso</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-16 text-gray-400 text-sm">
                    {users.length === 0 ? "No hay usuarios registrados." : "No se encontraron usuarios con los filtros aplicados."}
                  </td>
                </tr>
              )}
              {filteredUsers.map((u) => {
                const roleOpt = ROLE_OPTIONS.find((r) => r.value === u.role);
                const la      = formatLastAccess(u.lastAccess);
                return (
                  <tr key={u.id} className="border-b border-gray-50 hover:bg-blue-50/40 transition-colors">

                    {/* Usuario */}
                    <Td>
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full ${roleOpt?.bg ?? "bg-gray-400"} text-white text-xs font-bold flex items-center justify-center shrink-0`}>
                          {getInitials(u.name)}
                        </div>
                        <p className="font-semibold text-gray-900 whitespace-nowrap">{u.name}</p>
                      </div>
                    </Td>

                    {/* Email */}
                    <Td><span className="text-xs text-gray-500">{u.email ?? "—"}</span></Td>

                    {/* Estado */}
                    <Td><StatusBadge status={u.status} lastAccess={u.lastAccess} /></Td>

                    {/* Departamento de origen */}
                    <Td>
                      {u.originDepartmentId ? (
                        <span className="inline-flex items-center text-[11px] border px-2 py-1 bg-white text-[#0047AC] border-[#0047AC]/30 rounded-md font-normal">
                          {departmentLabel(u.originDepartmentId)}
                        </span>
                      ) : (
                        <span className="text-gray-400 italic text-xs">Otro</span>
                      )}
                    </Td>

                    {/* Último acceso */}
                    <Td>
                      <span
                        title={la.title}
                        className={`text-xs whitespace-nowrap ${la.text === "Nunca" ? "text-gray-300 italic" : "text-gray-500"}`}
                      >
                        {la.text}
                      </span>
                    </Td>

                    {/* Acciones */}
                    <Td>
                      <div className="flex justify-end">
                        <button
                          onClick={(e) => {
                            if (openMenu?.id === u.id) { setOpenMenu(null); return; }
                            const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                            setOpenMenu({ id: u.id, top: rect.bottom + 4, right: window.innerWidth - rect.right });
                          }}
                          className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          <Settings size={14} />
                        </button>
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {openMenu && (() => {
        const mu = users.find((u) => u.id === openMenu.id);
        if (!mu) return null;
        const isMeSelf = mu.id === currentUser.id;
        const canActivate = mu.status === "inactive" && mu.lastAccess !== null;
        const canDeactivate = mu.status === "active";
        const noAction = !canActivate && !canDeactivate;
        return createPortal(
          <div
            className="fixed z-[9999] bg-white border border-gray-200 rounded-md shadow-sm min-w-40 overflow-hidden"
            style={{ top: openMenu.top, right: openMenu.right }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => { dispatch(clearUsersMutationError()); setEditing(mu); setOpenMenu(null); }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 text-left"
            >
              <Pencil size={13} />Editar
            </button>
            <div className="border-t border-gray-100" />
            <button
              onClick={() => { handleStatusToggle(mu); setOpenMenu(null); }}
              disabled={isMeSelf || noAction}
              title={mu.lastAccess === null && mu.status !== "active" ? "El usuario debe iniciar sesión antes de poder activarse" : undefined}
              className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${
                canActivate ? "text-emerald-600 hover:bg-emerald-50" : "text-orange-500 hover:bg-orange-50"
              }`}
            >
              {canActivate ? <><UserCheck size={13} />Activar</> : <><UserX size={13} />Desactivar</>}
            </button>
            <div className="border-t border-gray-100" />
            <button
              onClick={() => { setConfirmDelete(mu); setOpenMenu(null); }}
              disabled={isMeSelf}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-red-500 hover:bg-red-50 text-left disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Trash2 size={13} />Eliminar
            </button>
          </div>,
          document.body
        );
      })()}

      {editing && (
        <UserFormModal
          mode={editing === "new" ? "create" : "edit"}
          initial={editing === "new" ? null : editing}
          isSelf={editing !== "new" && editing.id === currentUser.id}
          onClose={() => setEditing(null)}
          onSubmit={async (body) => {
            if (editing === "new") {
              const result = await dispatch(createUserAsync({ ...body, password: body.password! }));
              if (createUserAsync.fulfilled.match(result)) setEditing(null);
            } else {
              const result = await dispatch(updateUserAsync({ id: editing.id, changes: body }));
              if (updateUserAsync.fulfilled.match(result)) setEditing(null);
            }
          }}
        />
      )}

      {confirmDelete && (
        <DeleteModal
          user={confirmDelete}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => handleDelete(confirmDelete)}
        />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 2: Roles y Permisos
// ─────────────────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  master:      "Máster",
  admin:       "Admin",
  participant: "Participante",
  requester:   "Solicitante",
};

function roleLabel(role: { name: string; displayName?: string | null }): string {
  if (role.displayName) return role.displayName;
  return ROLE_LABELS[role.name] ?? role.name.charAt(0).toUpperCase() + role.name.slice(1);
}

const MODULE_LABELS: Record<string, string> = {
  tickets: "Tickets",
  users:   "Usuarios",
  admin:   "Roles",
};


function RolesTab() {
  const currentUser = useCurrentUser();

  const [roles, setRoles] = useState<RoleDefinition[]>([]);
  const [permsByModule, setPermsByModule] = useState<PermissionsByModule>({});
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [draftPerms, setDraftPerms] = useState<Set<string>>(new Set());
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [creatingRole, setCreatingRole] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleDefinition | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RoleDefinition | null>(null);

  useEffect(() => {
    Promise.all([
      api.getRoles(currentUser.id),
      api.getAllPermissions(currentUser.id),
    ])
      .then(([rolesData, permsData]) => {
        setRoles(rolesData);
        setPermsByModule(permsData);
        if (rolesData.length > 0) setSelectedRole(rolesData[0].name);
      })
      .catch((e) => setLoadError(e instanceof ApiError ? e.message : "Error al cargar roles"));
  }, [currentUser.id]);

  useEffect(() => {
    if (!selectedRole) return;
    const role = roles.find((r) => r.name === selectedRole);
    if (role) {
      setDraftPerms(new Set(role.permissions));
      setDirty(false);
      setSaveError(null);
    }
  }, [selectedRole, roles]);

  const togglePerm = (code: string) => {
    setDraftPerms((prev) => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
    setDirty(true);
  };

  const savePermissions = async () => {
    if (!selectedRole) return;
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await api.updateRolePermissions(currentUser.id, selectedRole, [...draftPerms]);
      setRoles((prev) => prev.map((r) => (r.name === selectedRole ? updated : r)));
      setDirty(false);
    } catch (e) {
      setSaveError(e instanceof ApiError ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleRoleCreated = (newRole: RoleDefinition) => {
    setRoles((prev) => [...prev, newRole]);
    setSelectedRole(newRole.name);
    setCreatingRole(false);
  };

  const handleRoleUpdated = (updated: RoleDefinition) => {
    setRoles((prev) => prev.map((r) => (r.name === updated.name ? updated : r)));
    setEditingRole(null);
  };

  const handleRoleDeleted = async (role: RoleDefinition) => {
    try {
      await api.deleteRole(currentUser.id, role.name);
      const updated = roles.filter((r) => r.name !== role.name);
      setRoles(updated);
      if (selectedRole === role.name) setSelectedRole(updated[0]?.name ?? null);
    } catch (e) {
      setSaveError(e instanceof ApiError ? e.message : "Error al eliminar rol");
    } finally {
      setDeleteTarget(null);
    }
  };

  const activeRole = roles.find((r) => r.name === selectedRole) ?? null;
  const allPerms = Object.values(permsByModule).flat();

  if (loadError) {
    return (
      <div className="flex items-center gap-2 text-red-600 text-sm p-4 bg-red-50 border border-red-200 rounded-lg">
        <AlertCircle size={15} />
        {loadError}
      </div>
    );
  }

  return (
    <div className="flex gap-5 min-h-0 flex-1">
      {/* ── Left panel: role list ── */}
      <div className="w-64 shrink-0 flex flex-col gap-2">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Roles</p>
          <button
            onClick={() => setCreatingRole(true)}
            className="flex items-center gap-1 text-[11px] font-semibold text-[#0047AC] hover:text-blue-700"
          >
            <Plus size={12} />
            Nuevo
          </button>
        </div>

        {roles.map((role) => (
          <button
            key={role.name}
            onClick={() => { if (dirty) { if (!confirm("Tienes cambios sin guardar. ¿Descartar?")) return; } setSelectedRole(role.name); }}
            className={`w-full text-left flex items-center justify-between px-3.5 py-3 rounded-lg border text-sm transition-colors ${
              selectedRole === role.name
                ? "bg-[#0047AC] border-[#0047AC] text-white"
                : "bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50"
            }`}
          >
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="font-semibold truncate">{roleLabel(role)}</span>
              {role.isSystem && (
                <span className={`text-[9px] font-bold uppercase tracking-wider ${selectedRole === role.name ? "text-blue-200" : "text-gray-400"}`}>
                  sistema
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`text-[10px] font-semibold ${selectedRole === role.name ? "text-blue-200" : "text-gray-400"}`}>
                {role.permissions.length}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); setEditingRole(role); }}
                title="Editar nombre y descripción"
                className={`p-0.5 rounded transition-colors ${
                  selectedRole === role.name
                    ? "text-blue-200 hover:text-white hover:bg-blue-700"
                    : "text-gray-300 hover:text-gray-600 hover:bg-gray-100"
                }`}
              >
                <Pencil size={11} />
              </button>
              {!role.isSystem && selectedRole !== role.name && (
                <button
                  onClick={(e) => { e.stopPropagation(); setDeleteTarget(role); }}
                  className="p-0.5 rounded hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={12} />
                </button>
              )}
              {selectedRole === role.name && <ChevronRight size={14} className="text-blue-200" />}
            </div>
          </button>
        ))}
      </div>

      {/* ── Right panel: permission editor ── */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        {!activeRole ? (
          <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
            Selecciona un rol para editar sus permisos
          </div>
        ) : (
          <>
            {/* Role header */}
            <div className="flex items-start justify-between gap-4 bg-white border border-gray-200 rounded-lg px-5 py-4">
              <div className="flex items-start gap-3 min-w-0">
                <div className="min-w-0">
                  <p className="text-base font-bold text-gray-900">{roleLabel(activeRole)}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{activeRole.description}</p>
                </div>
                <button
                  onClick={() => setEditingRole(activeRole)}
                  title="Editar nombre y descripción"
                  className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors shrink-0 mt-0.5"
                >
                  <Pencil size={13} />
                </button>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {saveError && (
                  <span className="text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle size={12} />{saveError}
                  </span>
                )}
                {dirty && (
                  <button
                    onClick={() => {
                      setDraftPerms(new Set(activeRole.permissions));
                      setDirty(false);
                      setSaveError(null);
                    }}
                    className="text-xs text-gray-400 hover:text-gray-600 px-3 py-1.5 rounded border border-gray-200 hover:bg-gray-50"
                  >
                    Descartar
                  </button>
                )}
                <button
                  onClick={savePermissions}
                  disabled={!dirty || saving}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded bg-[#0047AC] text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                  Guardar
                </button>
              </div>
            </div>

            {/* Permission modules */}
            <div className="flex flex-col gap-3">
              {Object.entries(permsByModule).map(([module, perms]) => {
                const codes = perms.map((p) => p.code);
                const checkedCount = codes.filter((c) => draftPerms.has(c)).length;
                const allChecked = checkedCount === codes.length;
                const partial = checkedCount > 0 && !allChecked;
                const label = MODULE_LABELS[module] ?? module.charAt(0).toUpperCase() + module.slice(1);

                return (
                  <div key={module} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    {/* Module header */}
                    <div className={`flex items-center gap-3 px-4 py-3 border-b ${checkedCount > 0 ? "bg-[#0047AC] border-[#0047AC] text-white" : "bg-gray-50 border-gray-100"}`}>
                      <Checkbox checked={allChecked} partial={partial} />
                      <span className="text-xs font-bold uppercase tracking-wider">
                        {label}
                      </span>
                      <span className={`text-xs ml-auto ${checkedCount > 0 ? "text-blue-200" : "text-gray-400"}`}>
                        {checkedCount}/{codes.length}
                      </span>
                    </div>

                    {/* Permission rows */}
                    <div>
                      {perms.map((perm, i) => (
                        <PermissionRow
                          key={perm.code}
                          perm={perm}
                          checked={draftPerms.has(perm.code)}
                          onToggle={() => togglePerm(perm.code)}
                          last={i === perms.length - 1}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="text-xs text-gray-400 text-right">
              {draftPerms.size} de {allPerms.length} permisos activos
            </div>
          </>
        )}
      </div>

      {/* New role modal */}
      {creatingRole && (
        <NewRoleModal
          userId={currentUser.id}
          onClose={() => setCreatingRole(false)}
          onCreated={handleRoleCreated}
        />
      )}

      {/* Edit role modal */}
      {editingRole && (
        <EditRoleModal
          role={editingRole}
          userId={currentUser.id}
          onClose={() => setEditingRole(null)}
          onUpdated={handleRoleUpdated}
        />
      )}

      {/* Delete role confirm */}
      {deleteTarget && (
        <DeleteRoleModal
          role={deleteTarget}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => handleRoleDeleted(deleteTarget)}
        />
      )}
    </div>
  );
}

// ─── Permission row ────────────────────────────────────────────────────────────

function PermissionRow({
  perm, checked, onToggle, last,
}: { perm: PermissionEntry; checked: boolean; onToggle: () => void; last: boolean }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-blue-50/40 transition-colors ${
        !last ? "border-b border-gray-50" : ""
      }`}
    >
      <Checkbox checked={checked} />
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className={`text-sm font-medium ${checked ? "text-gray-900" : "text-gray-500"}`}>
          {perm.name}
        </span>
        <span className="text-xs text-gray-400 truncate">{perm.description}</span>
      </div>
      <code className="ml-auto text-[10px] text-gray-300 font-mono shrink-0">{perm.code}</code>
    </button>
  );
}

// ─── Checkbox primitive ────────────────────────────────────────────────────────

function Checkbox({ checked, partial = false }: { checked: boolean; partial?: boolean }) {
  return (
    <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
      checked
        ? "bg-[#0047AC] border-[#0047AC]"
        : partial
          ? "bg-blue-100 border-[#0047AC]"
          : "border-gray-300"
    }`}>
      {checked && <Check size={10} className="text-white" strokeWidth={3} />}
      {partial && !checked && <div className="w-2 h-0.5 bg-[#0047AC] rounded" />}
    </div>
  );
}

// ─── New role modal ────────────────────────────────────────────────────────────

function NewRoleModal({
  userId,
  onClose,
  onCreated,
}: {
  userId: string;
  onClose: () => void;
  onCreated: (role: RoleDefinition) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (name.trim().length < 2) { setError("El nombre debe tener al menos 2 caracteres"); return; }
    if (!/^[a-z0-9_-]+$/.test(name.trim())) {
      setError("Solo minúsculas, números, guiones y underscores");
      return;
    }
    if (!description.trim()) { setError("La descripción es requerida"); return; }

    setLoading(true);
    setError(null);
    try {
      const created = await api.createRole(userId, name.trim(), description.trim(), []);
      onCreated(created);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Error al crear rol");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-sm max-w-sm w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-gray-900">Nuevo Rol</h3>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 text-gray-400">
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <Field label="Nombre del rol" hint="Solo minúsculas, números, guiones y underscores" error={error && error.includes("nombre") ? error : undefined}>
            <input
              value={name}
              onChange={(e) => { setName(e.target.value); setError(null); }}
              placeholder="ej. supervisor"
              className="w-full bg-gray-50 border border-gray-200 rounded-md px-3.5 py-2.5 text-sm outline-none focus:border-[#0047AC] focus:ring-2 focus:ring-blue-100"
            />
          </Field>
          <Field label="Descripción">
            <input
              value={description}
              onChange={(e) => { setDescription(e.target.value); setError(null); }}
              placeholder="ej. Supervisa tickets de todos los departamentos"
              className="w-full bg-gray-50 border border-gray-200 rounded-md px-3.5 py-2.5 text-sm outline-none focus:border-[#0047AC] focus:ring-2 focus:ring-blue-100"
            />
          </Field>

          {error && (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <AlertCircle size={12} />{error}
            </p>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-md text-sm font-semibold hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 bg-[#0047AC] text-white py-2.5 rounded-md text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            Crear Rol
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit role modal ───────────────────────────────────────────────────────────

function EditRoleModal({
  role,
  userId,
  onClose,
  onUpdated,
}: {
  role: RoleDefinition;
  userId: string;
  onClose: () => void;
  onUpdated: (updated: RoleDefinition) => void;
}) {
  const [displayName, setDisplayName] = useState(role.displayName ?? "");
  const [description, setDescription] = useState(role.description);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!description.trim()) { setError("La descripción es requerida"); return; }
    setLoading(true);
    setError(null);
    try {
      const updated = await api.updateRole(userId, role.name, {
        displayName: displayName.trim() || undefined,
        description: description.trim(),
      });
      onUpdated(updated);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Error al guardar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-sm max-w-sm w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-gray-900">Editar rol</h3>
            <code className="text-[10px] text-gray-400 font-mono">{role.name}</code>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 text-gray-400">
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <Field label="Título" hint="Nombre visible en la interfaz. Dejar vacío para usar el nombre del rol.">
            <input
              value={displayName}
              onChange={(e) => { setDisplayName(e.target.value); setError(null); }}
              placeholder={role.name.charAt(0).toUpperCase() + role.name.slice(1)}
              className="w-full bg-gray-50 border border-gray-200 rounded-md px-3.5 py-2.5 text-sm outline-none focus:border-[#0047AC] focus:ring-2 focus:ring-blue-100"
            />
          </Field>
          <Field label="Descripción" error={error?.includes("escripción") ? error : undefined}>
            <textarea
              value={description}
              onChange={(e) => { setDescription(e.target.value); setError(null); }}
              rows={3}
              className="w-full bg-gray-50 border border-gray-200 rounded-md px-3.5 py-2.5 text-sm outline-none focus:border-[#0047AC] focus:ring-2 focus:ring-blue-100 resize-none"
            />
          </Field>

          {error && !error.includes("escripción") && (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <AlertCircle size={12} />{error}
            </p>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-md text-sm font-semibold hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 bg-[#0047AC] text-white py-2.5 rounded-md text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Delete role confirm modal ─────────────────────────────────────────────────

function DeleteRoleModal({
  role,
  onCancel,
  onConfirm,
}: { role: RoleDefinition; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-sm max-w-sm w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-gray-900">¿Eliminar rol?</h3>
          <button onClick={onCancel} className="p-1.5 rounded hover:bg-gray-100 text-gray-400">
            <X size={16} />
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-6">
          Se eliminará el rol <strong className="text-gray-800">{roleLabel(role)}</strong>.
          Los usuarios que lo tengan asignado quedarán sin permisos hasta que se les asigne otro rol.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-md text-sm font-semibold hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={onConfirm} className="flex-1 bg-red-500 text-white py-2.5 rounded-md text-sm font-semibold hover:bg-red-600">
            Eliminar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// User form modal (unchanged from original)
// ─────────────────────────────────────────────────────────────────────────────

// Una asignación de rol con ámbito: departmentId = null ⇒ GLOBAL (toda la app).
type Assignment = { roleName: string; departmentId: DepartmentId | null };

function UserFormModal({
  mode, initial, isSelf, onClose, onSubmit,
}: {
  mode: "create" | "edit";
  initial: AppUser | null;
  isSelf: boolean;
  onClose: () => void;
  onSubmit: (body: { name: string; email: string; password?: string; assignments: Assignment[]; originDepartmentId: string | null }) => void;
}) {
  const currentUser = useCurrentUser();
  const [name, setName] = useState(initial?.name ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [password, setPassword] = useState("");
  const [originDepartmentId, setOriginDepartmentId] = useState<string | null>(initial?.originDepartmentId ?? null);
  const [assignments, setAssignments] = useState<Assignment[]>(
    (initial?.roleAssignments ?? []).map((a) => ({ roleName: a.roleName, departmentId: a.departmentId })),
  );
  const [roles, setRoles] = useState<RoleDefinition[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Lista de roles disponibles para las asignaciones.
  useEffect(() => {
    api.getRoles(currentUser.id).then(setRoles).catch(() => setRoles([]));
  }, [currentUser.id]);

  const addAssignment = () =>
    setAssignments((prev) => [...prev, { roleName: roles[0]?.name ?? "requester", departmentId: null }]);
  const removeAssignment = (i: number) =>
    setAssignments((prev) => prev.filter((_, idx) => idx !== i));
  const setAssignment = (i: number, patch: Partial<Assignment>) =>
    setAssignments((prev) => prev.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));

  const handleSubmit = () => {
    const e: Record<string, string> = {};
    if (name.trim().length < 2) e.name = "Nombre requerido (≥ 2 caracteres)";
    if (mode === "create" && !email.trim()) {
      e.email = "Email requerido";
    } else if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      e.email = "Email inválido";
    }
    if (mode === "create" && password.length < 6) {
      e.password = "Contraseña requerida (≥ 6 caracteres)";
    } else if (mode === "edit" && password.length > 0 && password.length < 6) {
      e.password = "Mínimo 6 caracteres";
    }
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    // Deduplicar asignaciones por (rol, ámbito).
    const seen = new Set<string>();
    const clean = assignments.filter((a) => {
      const k = `${a.roleName}|${a.departmentId ?? ""}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    onSubmit({ name: name.trim(), email: email.trim(), password: password.length > 0 ? password : undefined, assignments: clean, originDepartmentId });
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-sm max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
          <h3 className="text-base font-bold text-gray-900">
            {mode === "create" ? "Nuevo Usuario" : `Editar ${initial?.name}`}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 text-gray-400"><X size={16} /></button>
        </div>

        <div className="p-6 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Nombre completo" hint="Iniciales: primer nombre + primer apellido" error={errors.name}>
              <input value={name} onChange={(e) => { setName(e.target.value); setErrors((p) => ({ ...p, name: "" })); }}
                placeholder="ej. Diana Reyes"
                className={`w-full bg-gray-50 border rounded-md px-3.5 py-2.5 text-sm outline-none focus:border-[#0047AC] focus:ring-2 focus:ring-blue-100 ${errors.name ? "border-red-400" : "border-gray-200"}`}
              />
            </Field>

            <Field label="Email" error={errors.email}>
              <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: "" })); }}
                placeholder="ej. diana@leterago.com"
                className={`w-full bg-gray-50 border rounded-md px-3.5 py-2.5 text-sm outline-none focus:border-[#0047AC] focus:ring-2 focus:ring-blue-100 ${errors.email ? "border-red-400" : "border-gray-200"}`}
              />
            </Field>
          </div>

          <Field label={mode === "create" ? "Contraseña" : "Nueva contraseña"} hint={mode === "edit" ? "Dejar vacío para no cambiarla" : "Mínimo 6 caracteres"} error={errors.password}>
            <input type="password" value={password} onChange={(e) => { setPassword(e.target.value); setErrors((p) => ({ ...p, password: "" })); }}
              placeholder={mode === "edit" ? "••••••" : ""}
              className={`w-full bg-gray-50 border rounded-md px-3.5 py-2.5 text-sm outline-none focus:border-[#0047AC] focus:ring-2 focus:ring-blue-100 ${errors.password ? "border-red-400" : "border-gray-200"}`}
            />
          </Field>

          <Field
            label="Asignaciones de rol"
            hint={isSelf
              ? "Mantén una asignación Global con gestión de usuarios para no bloquearte a ti mismo."
              : "Cada asignación otorga los permisos de un rol en un departamento, o de forma Global (toda la app)."}
          >
            <div className="flex flex-col gap-2">
              {assignments.length === 0 && (
                <p className="text-xs text-gray-400 italic px-0.5">
                  Sin asignaciones — el usuario no podrá hacer nada hasta agregar una.
                </p>
              )}
              {assignments.map((a, i) => (
                <div key={i} className="flex items-center gap-2 rounded-md border border-gray-200 px-2.5 py-2">
                  <select
                    value={a.roleName}
                    onChange={(ev) => setAssignment(i, { roleName: ev.target.value })}
                    className="flex-1 min-w-0 bg-gray-50 border border-gray-200 rounded-md px-2.5 py-2 text-sm outline-none focus:border-[#0047AC]"
                  >
                    {roles.length === 0 && <option value={a.roleName}>{a.roleName}</option>}
                    {roles.map((r) => (
                      <option key={r.name} value={r.name}>{r.displayName || r.name}</option>
                    ))}
                  </select>
                  <span className="text-[11px] text-gray-400 shrink-0">en</span>
                  <select
                    value={a.departmentId ?? ""}
                    onChange={(ev) => setAssignment(i, { departmentId: (ev.target.value || null) as DepartmentId | null })}
                    className="flex-1 min-w-0 bg-gray-50 border border-gray-200 rounded-md px-2.5 py-2 text-sm outline-none focus:border-[#0047AC]"
                  >
                    <option value="">Global (toda la app)</option>
                    {DEPARTMENT_LIST.map((d) => (
                      <option key={d} value={d}>{DEPARTMENTS[d].label}</option>
                    ))}
                  </select>
                  <button type="button" onClick={() => removeAssignment(i)}
                    className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 shrink-0">
                    <X size={14} />
                  </button>
                </div>
              ))}
              <button type="button" onClick={addAssignment}
                className="self-start flex items-center gap-1.5 text-sm text-[#0047AC] font-semibold hover:underline mt-1">
                <Plus size={14} /> Agregar asignación
              </button>
            </div>
          </Field>

          <Field label="Departamento de origen" hint="Área a la que pertenece el usuario (para registrar la procedencia en solicitudes)">
            <select
              value={originDepartmentId ?? ""}
              onChange={(e) => setOriginDepartmentId(e.target.value || null)}
              className="w-full bg-gray-50 border border-gray-200 rounded-md px-3.5 py-2.5 text-sm outline-none focus:border-[#0047AC] focus:ring-2 focus:ring-blue-100"
            >
              <option value="">Otro / sin departamento</option>
              {Object.values(DEPARTMENTS).map((d) => (
                <option key={d.id} value={d.id}>{d.label}</option>
              ))}
            </select>
          </Field>

        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-gray-100 sticky bottom-0 bg-white">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-md text-sm font-semibold hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={handleSubmit} className="flex-1 bg-[#0047AC] text-white py-2.5 rounded-md text-sm font-semibold hover:bg-blue-700">
            {mode === "create" ? "Crear Usuario" : "Guardar Cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Delete user confirm modal ────────────────────────────────────────────────

function DeleteModal({ user, onCancel, onConfirm }: { user: AppUser; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-sm max-w-sm w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-gray-900">¿Eliminar usuario?</h3>
          <button onClick={onCancel} className="p-1.5 rounded hover:bg-gray-100 text-gray-400"><X size={16} /></button>
        </div>
        <p className="text-sm text-gray-500 mb-6">
          Se eliminará permanentemente a <strong className="text-gray-800">{user.name}</strong>.
          Si tiene tickets asociados, la operación fallará.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-md text-sm font-semibold hover:bg-gray-50">Cancelar</button>
          <button onClick={onConfirm} className="flex-1 bg-red-500 text-white py-2.5 rounded-md text-sm font-semibold hover:bg-red-600">Eliminar</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 3: Departamentos
// ─────────────────────────────────────────────────────────────────────────────

function DepartamentosTab() {
  const currentUser = useCurrentUser();
  const [departments, setDepartments] = useState<ServerDepartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expandedDept, setExpandedDept] = useState<string | null>(null);
  const [editingDept, setEditingDept] = useState<ServerDepartment | null>(null);
  const [editingCat, setEditingCat] = useState<ServerCategory | null>(null);

  useEffect(() => {
    api.getCatalog(currentUser.id)
      .then((data) => {
        setDepartments(data);
        if (data.length > 0) setExpandedDept(data[0].id);
      })
      .catch((e) => setLoadError(e instanceof ApiError ? e.message : "Error al cargar"))
      .finally(() => setLoading(false));
  }, [currentUser.id]);

  const handleDeptSaved = (updated: ServerDepartment) => {
    setDepartments((prev) =>
      prev.map((d) => d.id === updated.id ? { ...updated, categories: d.categories } : d),
    );
    setEditingDept(null);
  };

  const handleCatSaved = (updated: ServerCategory) => {
    setDepartments((prev) =>
      prev.map((d) => ({
        ...d,
        categories: d.categories.map((c) => (c.id === updated.id ? updated : c)),
      })),
    );
    setEditingCat(null);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-400 text-sm p-6">
        <Loader2 size={15} className="animate-spin" />Cargando departamentos...
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex items-center gap-2 text-red-600 text-sm p-4 bg-red-50 border border-red-200 rounded-lg">
        <AlertCircle size={15} />{loadError}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {departments.map((dept) => {
        const open = expandedDept === dept.id;
        return (
          <div key={dept.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            {/* Department header */}
            <div className="flex items-center gap-3 px-5 py-4">
              <button
                onClick={() => setExpandedDept(open ? null : dept.id)}
                className="flex items-center gap-3 flex-1 text-left min-w-0"
              >
                <ChevronRight
                  size={16}
                  className={`text-gray-400 shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
                />
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 text-sm">{dept.name}</p>
                  {dept.description && (
                    <p className="text-xs text-gray-400 truncate mt-0.5">{dept.description}</p>
                  )}
                </div>
                <span className="ml-2 text-[10px] text-gray-400 shrink-0">
                  {dept.categories.length} {dept.categories.length === 1 ? "categoría" : "categorías"}
                </span>
              </button>
              <button
                onClick={() => setEditingDept(dept)}
                className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors shrink-0"
                title="Editar departamento"
              >
                <Pencil size={14} />
              </button>
            </div>

            {/* Categories */}
            {open && (
              <div className="border-t border-gray-100">
                {dept.categories.length === 0 ? (
                  <p className="px-5 py-4 text-sm text-gray-400 italic">Sin categorías</p>
                ) : (
                  dept.categories.map((cat, i) => (
                    <div
                      key={cat.id}
                      className={`flex items-start gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors ${
                        i < dept.categories.length - 1 ? "border-b border-gray-50" : ""
                      }`}
                    >
                      <div className="flex-1 min-w-0 pl-7">
                        <p className="text-sm font-medium text-gray-800">{cat.name}</p>
                        {cat.description ? (
                          <p className="text-xs text-gray-400 mt-0.5">{cat.description}</p>
                        ) : (
                          <p className="text-xs text-gray-300 mt-0.5 italic">Sin descripción</p>
                        )}
                        <code className="text-[10px] text-gray-300 font-mono">{cat.id}</code>
                      </div>
                      <button
                        onClick={() => setEditingCat(cat)}
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors shrink-0 mt-0.5"
                        title="Editar categoría"
                      >
                        <Pencil size={13} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}

      {editingDept && (
        <EditDeptModal
          dept={editingDept}
          userId={currentUser.id}
          onClose={() => setEditingDept(null)}
          onSaved={handleDeptSaved}
        />
      )}

      {editingCat && (
        <EditCatModal
          cat={editingCat}
          userId={currentUser.id}
          onClose={() => setEditingCat(null)}
          onSaved={handleCatSaved}
        />
      )}
    </div>
  );
}

// ─── Edit department modal ─────────────────────────────────────────────────────

function EditDeptModal({
  dept, userId, onClose, onSaved,
}: { dept: ServerDepartment; userId: string; onClose: () => void; onSaved: (d: ServerDepartment) => void }) {
  const [name, setName] = useState(dept.name);
  const [description, setDescription] = useState(dept.description ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!name.trim()) { setError("El nombre es requerido"); return; }
    setSaving(true);
    setError(null);
    try {
      const updated = await api.updateDepartment(userId, dept.id, {
        name: name.trim(),
        description: description.trim() || null,
      });
      onSaved(updated);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <EditModal
      title={`Editar departamento`}
      subtitle={dept.id}
      onClose={onClose}
      onSave={handleSave}
      saving={saving}
      error={error}
    >
      <Field label="Nombre">
        <input
          value={name}
          onChange={(e) => { setName(e.target.value); setError(null); }}
          className="w-full bg-gray-50 border border-gray-200 rounded-md px-3.5 py-2.5 text-sm outline-none focus:border-[#0047AC] focus:ring-2 focus:ring-blue-100"
        />
      </Field>
      <Field label="Descripción" hint="Opcional">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full bg-gray-50 border border-gray-200 rounded-md px-3.5 py-2.5 text-sm outline-none focus:border-[#0047AC] focus:ring-2 focus:ring-blue-100 resize-none"
        />
      </Field>
    </EditModal>
  );
}

// ─── Edit category modal ───────────────────────────────────────────────────────

function EditCatModal({
  cat, userId, onClose, onSaved,
}: { cat: ServerCategory; userId: string; onClose: () => void; onSaved: (c: ServerCategory) => void }) {
  const [name, setName] = useState(cat.name);
  const [description, setDescription] = useState(cat.description ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!name.trim()) { setError("El nombre es requerido"); return; }
    setSaving(true);
    setError(null);
    try {
      const updated = await api.updateCategory(userId, cat.id, {
        name: name.trim(),
        description: description.trim() || null,
      });
      onSaved(updated);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <EditModal
      title="Editar categoría"
      subtitle={cat.id}
      onClose={onClose}
      onSave={handleSave}
      saving={saving}
      error={error}
    >
      <Field label="Nombre (label)">
        <input
          value={name}
          onChange={(e) => { setName(e.target.value); setError(null); }}
          className="w-full bg-gray-50 border border-gray-200 rounded-md px-3.5 py-2.5 text-sm outline-none focus:border-[#0047AC] focus:ring-2 focus:ring-blue-100"
        />
      </Field>
      <Field label="Descripción" hint="Descripción visible al crear un ticket">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full bg-gray-50 border border-gray-200 rounded-md px-3.5 py-2.5 text-sm outline-none focus:border-[#0047AC] focus:ring-2 focus:ring-blue-100 resize-none"
        />
      </Field>
    </EditModal>
  );
}

// ─── Shared edit modal shell ───────────────────────────────────────────────────

function EditModal({
  title, subtitle, onClose, onSave, saving, error, children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  error: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-sm max-w-md w-full">
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-base font-bold text-gray-900">{title}</h3>
            {subtitle && <code className="text-[10px] text-gray-400 font-mono">{subtitle}</code>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 mt-0.5">
            <X size={16} />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-4">
          {children}
          {error && (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <AlertCircle size={12} />{error}
            </p>
          )}
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-md text-sm font-semibold hover:bg-gray-50">
            Cancelar
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="flex-1 bg-[#0047AC] text-white py-2.5 rounded-md text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Shared primitives ────────────────────────────────────────────────────────

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
      {hint && !error && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

const Th = ({ children }: { children?: React.ReactNode }) => (
  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">{children}</th>
);

const Td = ({ children }: { children?: React.ReactNode }) => (
  <td className="px-4 py-3">{children}</td>
);

interface FilterOption { value: string; label: string; }

function FilterSelect({ value, onChange, label, options, className }: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  options: FilterOption[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const selected = options.find((o) => o.value === value) ?? options[0];
  const isDefault = value === options[0]?.value;

  return (
    <div ref={ref} className={`relative ${className ?? ""}`}>
      <div
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between gap-2 rounded-lg border bg-white py-[9px] px-3 text-sm cursor-pointer transition-colors ${
          open
            ? "border-[#0047AC] ring-2 ring-[#0047AC]/10"
            : "border-gray-300 hover:border-gray-400"
        }`}
      >
        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap shrink-0">{label}:</span>
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`truncate ${isDefault ? "text-gray-500" : "text-gray-800 font-medium"}`}>{selected?.label}</span>
          <ChevronDown
            size={13}
            className={`text-gray-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          />
        </div>
      </div>

      {open && (
        <ul className="absolute top-full z-50 mt-1 min-w-full w-max max-h-56 overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {options.map((opt) => {
            const active = opt.value === value;
            return (
              <li
                key={opt.value}
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={`flex items-center gap-2.5 cursor-pointer px-3 py-2 text-sm whitespace-nowrap transition-colors ${
                  active
                    ? "bg-blue-50 text-[#0047AC] font-medium"
                    : "text-gray-700 hover:bg-gray-200"
                }`}
              >
                <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                  active ? "border-[#0047AC] bg-[#0047AC]" : "border-gray-300 bg-white"
                }`}>
                  {active && <Check size={9} className="text-white" strokeWidth={2.5} />}
                </div>
                {opt.label}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ─── Notificaciones Tab ───────────────────────────────────────────────────────

type NotifKey = "notifyNuevoTicket" | "notifyResuelto" | "notifyConfirmado";

const ALL_NOTIF_OPTIONS: {
  key: NotifKey;
  title: string;
  description: string;
  // Shown only to roles that have the relevant permission
  visibleFor: ("master" | "admin" | "participant" | "requester")[];
}[] = [
  {
    key: "notifyNuevoTicket",
    title: "Nueva solicitud en mi departamento",
    description: "Recibe un correo cuando se crea una nueva solicitud en los departamentos donde tienes acceso.",
    // Only users who can view dept tickets (admin/participant/master) should see this
    visibleFor: ["master", "admin", "participant"],
  },
  {
    key: "notifyResuelto",
    title: "Solicitud resuelta",
    description: "Recibe un correo cuando una solicitud que tienes asignada es marcada como resuelta.",
    visibleFor: ["master", "admin", "participant"],
  },
  {
    key: "notifyConfirmado",
    title: "Solicitud confirmada",
    description: "Recibe un correo cuando una solicitud que creaste es confirmada como completada.",
    visibleFor: ["master", "admin", "participant", "requester"],
  },
];

function NotifToggle({
  label,
  description,
  enabled,
  loading,
  onChange,
}: {
  label: string;
  description: string;
  enabled: boolean;
  loading: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 bg-white border border-gray-200 rounded-lg px-5 py-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800">{label}</p>
        <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{description}</p>
      </div>
      <button
        onClick={onChange}
        disabled={loading}
        className="shrink-0 flex items-center gap-2 disabled:opacity-60"
        aria-label={enabled ? "Desactivar" : "Activar"}
      >
        {loading && <Loader2 size={13} className="animate-spin text-gray-400" />}
        <div className={`relative w-11 h-6 rounded-full transition-colors duration-200
          ${enabled ? "bg-[#0047AC]" : "bg-gray-200"}`}
        >
          <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm
            transition-transform duration-200 ${enabled ? "translate-x-5" : "translate-x-0"}`}
          />
        </div>
      </button>
    </div>
  );
}

function NotificacionesTab() {
  const currentUser = useCurrentUser();
  const [prefs, setPrefs] = useState<ServerNotificationPrefs | null>(null);
  const [saving, setSaving] = useState<NotifKey | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getNotificationPrefs(currentUser.id)
      .then(setPrefs)
      .finally(() => setLoading(false));
  }, [currentUser.id]);

  const toggle = async (key: NotifKey) => {
    if (!prefs || saving) return;
    const next = !prefs[key];
    const prev = { ...prefs };
    setPrefs({ ...prefs, [key]: next });
    setSaving(key);
    try {
      const updated = await api.updateNotificationPrefs(currentUser.id, { [key]: next });
      setPrefs(updated);
    } catch {
      setPrefs(prev);
    } finally {
      setSaving(null);
    }
  };

  // Only show options relevant to this user's role
  const visibleOptions = ALL_NOTIF_OPTIONS.filter((opt) =>
    opt.visibleFor.includes(currentUser.role as "master" | "admin" | "participant" | "requester"),
  );

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h2 className="text-base font-semibold text-gray-900">Preferencias de correo</h2>
        <p className="text-sm text-gray-500 mt-1">
          Elige qué notificaciones deseas recibir en{" "}
          <span className="font-medium text-gray-700">{currentUser.email}</span>.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-400 py-8">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-sm">Cargando preferencias…</span>
        </div>
      ) : visibleOptions.length === 0 ? (
        <p className="text-sm text-gray-400 py-8">No hay preferencias de notificación disponibles para tu rol.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {visibleOptions.map(({ key, title, description }) => (
            <NotifToggle
              key={key}
              label={title}
              description={description}
              enabled={prefs ? prefs[key] : true}
              loading={saving === key}
              onChange={() => toggle(key)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
