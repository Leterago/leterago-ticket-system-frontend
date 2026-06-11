import {
  Bell, LogOut, ChevronDown, CheckCircle2, XCircle, AlertTriangle, Info, CheckCheck, Trash2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useRef, useState, useEffect } from "react";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { logout, setCurrentUser } from "../../store/authSlice";
import type { AppUser } from "../../store/authSlice";
import {
  markAllRead, markRead, clearAll, type AppNotification, type NotificationKind,
} from "../../store/notificationsSlice";
import { getInitials } from "../../lib/initials";
import { formatRelative } from "../../lib/formatDate";

const NOTIF_ICON: Record<NotificationKind, { icon: typeof Info; color: string }> = {
  success: { icon: CheckCircle2,  color: "text-emerald-500" },
  error:   { icon: XCircle,       color: "text-red-500" },
  warning: { icon: AlertTriangle, color: "text-amber-500" },
  info:    { icon: Info,          color: "text-[#0047AC]" },
};

const avatarBg: Record<string, string> = {
  master:      "bg-indigo-600",
  admin:       "bg-[#0047AC]",
  participant: "bg-emerald-500",
  requester:   "bg-slate-400",
};

const roleBadgeClass: Record<string, string> = {
  master:      "bg-indigo-100 text-indigo-700",
  admin:       "bg-blue-100 text-blue-700",
  participant: "bg-emerald-100 text-emerald-700",
  requester:   "bg-slate-100 text-slate-600",
};

const roleLabel: Record<string, string> = {
  master:      "Máster",
  admin:       "Admin",
  participant: "Participante",
  requester:   "Solicitante",
};

const Avatar = ({ user, size = 8 }: { user: AppUser; size?: number }) => (
  <div className={`w-${size} h-${size} ${avatarBg[user.role] ?? "bg-slate-400"} text-white rounded-full flex items-center justify-center font-bold text-xs shrink-0`}>
    {getInitials(user.name)}
  </div>
);

const NavBar = () => {
  const dispatch    = useAppDispatch();
  const navigate    = useNavigate();
  const currentUser = useAppSelector((s) => s.auth.currentUser);
  const allUsers    = useAppSelector((s) => s.users.list);
  const notifications = useAppSelector((s) => s.notifications.items);
  const unreadCount   = notifications.filter((n) => !n.read).length;
  const [open, setOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const isDev = window.location.hostname === "localhost";

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (!notifOpen) return;
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [notifOpen]);

  if (!currentUser) return null;

  const openNotifications = () => {
    setNotifOpen((v) => !v);
  };

  const handleNotifClick = (n: AppNotification) => {
    dispatch(markRead(n.id));
    setNotifOpen(false);
    if (n.link) navigate(n.link);
  };

  const handleLogout = () => {
    dispatch(logout());
    navigate("/login", { replace: true });
  };

  const switchTo = (user: AppUser) => {
    dispatch(setCurrentUser(user));
    setOpen(false);
    navigate("/", { replace: true });
  };

  return (
    <nav className="flex w-full h-full justify-end items-center gap-3 px-6 bg-white border-b border-gray-100">
      {/* Notificaciones */}
      <div className="relative" ref={notifRef}>
        <button
          onClick={openNotifications}
          className="relative p-2 rounded hover:bg-gray-50 text-gray-500 transition-colors"
          title="Notificaciones"
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>

        {notifOpen && (
          <div className="absolute right-0 top-[calc(100%+6px)] z-50 bg-white border border-gray-200 rounded-lg shadow-lg w-80 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
              <p className="text-sm font-bold text-gray-800">Notificaciones</p>
              {notifications.length > 0 && unreadCount > 0 && (
                <button
                  onClick={() => dispatch(markAllRead())}
                  className="flex items-center gap-1 text-[11px] font-semibold text-[#0047AC] hover:underline"
                >
                  <CheckCheck size={13} /> Marcar leídas
                </button>
              )}
            </div>

            {/* List */}
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-gray-400 gap-2">
                  <Bell size={22} className="opacity-40" />
                  <p className="text-xs">No hay notificaciones</p>
                </div>
              ) : (
                notifications.map((n) => {
                  const { icon: Icon, color } = NOTIF_ICON[n.kind];
                  return (
                    <button
                      key={n.id}
                      onClick={() => handleNotifClick(n)}
                      className={`w-full flex items-start gap-3 px-4 py-3 text-left border-b border-gray-50 transition-colors hover:bg-gray-50 ${
                        n.read ? "" : "bg-blue-50/40"
                      }`}
                    >
                      <Icon size={16} className={`${color} shrink-0 mt-0.5`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-800 leading-snug">{n.title}</p>
                        {n.message && <p className="text-[11px] text-gray-500 mt-0.5 truncate">{n.message}</p>}
                        <p className="text-[10px] text-gray-400 mt-1">{formatRelative(n.createdAt)}</p>
                      </div>
                      {!n.read && <span className="w-2 h-2 bg-[#0047AC] rounded-full shrink-0 mt-1" />}
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <button
                onClick={() => { dispatch(clearAll()); setNotifOpen(false); }}
                className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 text-[11px] font-semibold text-gray-500 hover:text-red-500 hover:bg-gray-50 border-t border-gray-100 transition-colors"
              >
                <Trash2 size={13} /> Limpiar todas
              </button>
            )}
          </div>
        )}
      </div>

      <div className="w-px h-6 bg-gray-200" />

      {/* Usuario actual */}
      <div className="relative" ref={ref}>
        <button
          onClick={() => isDev && setOpen((v) => !v)}
          className={`flex items-center gap-2.5 px-2 py-1.5 rounded-md transition-colors ${
            isDev ? "hover:bg-gray-50 cursor-pointer" : "cursor-default"
          }`}
        >
          <Avatar user={currentUser} />
          <div className="text-left hidden sm:block">
            <p className="text-sm font-semibold text-gray-800 leading-tight">{currentUser.name}</p>
            {currentUser.role === "master" && (
              <span className="inline-flex items-center text-[9px] font-bold px-1.5 py-0.5 rounded-sm mt-0.5 bg-indigo-600 text-white">
                Master
              </span>
            )}
          </div>
          {isDev && (
            <ChevronDown
              size={13}
              className={`text-gray-400 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
            />
          )}
        </button>

        {isDev && open && (
          <div className="absolute right-0 top-[calc(100%+6px)] z-50 bg-white border border-gray-200 rounded-lg shadow-lg w-64 overflow-hidden">
            {/* Header */}
            <div className="px-3 py-2 bg-amber-50 border-b border-amber-100">
              <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">
                Dev · Cambiar usuario
              </p>
            </div>

            {/* User list */}
            <div className="max-h-80 overflow-y-auto">
              {allUsers.length === 0 && (
                <p className="text-xs text-gray-400 px-3 py-4 text-center">No hay usuarios cargados</p>
              )}
              {allUsers.map((u) => {
                const isCurrent = u.id === currentUser.id;
                return (
                  <button
                    key={u.id}
                    onClick={() => !isCurrent && switchTo(u)}
                    disabled={isCurrent}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                      isCurrent
                        ? "bg-blue-50 cursor-default"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    <div className={`w-8 h-8 ${avatarBg[u.role] ?? "bg-slate-400"} text-white rounded-full flex items-center justify-center text-[11px] font-bold shrink-0`}>
                      {getInitials(u.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className={`text-xs font-semibold truncate ${isCurrent ? "text-[#0047AC]" : "text-gray-800"}`}>
                          {u.name}
                        </p>
                        {isCurrent && (
                          <span className="text-[9px] text-[#0047AC] font-medium shrink-0">• actual</span>
                        )}
                      </div>
                      <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded-sm mt-0.5 ${roleBadgeClass[u.role] ?? "bg-gray-100 text-gray-600"}`}>
                        {roleLabel[u.role] ?? u.role}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="w-px h-6 bg-gray-200" />

      {/* Logout */}
      <button
        onClick={handleLogout}
        title="Cerrar sesión"
        className="p-2 rounded hover:bg-gray-50 text-gray-400 hover:text-red-500 transition-colors"
      >
        <LogOut size={16} />
      </button>
    </nav>
  );
};

export default NavBar;
