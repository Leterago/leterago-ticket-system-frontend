import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { dismissToast, type AppNotification, type NotificationKind } from "../../store/notificationsSlice";

const STYLES: Record<NotificationKind, { icon: typeof Info; accent: string; iconColor: string }> = {
  success: { icon: CheckCircle2,  accent: "border-l-emerald-500", iconColor: "text-emerald-500" },
  error:   { icon: XCircle,       accent: "border-l-red-500",     iconColor: "text-red-500" },
  warning: { icon: AlertTriangle, accent: "border-l-amber-500",   iconColor: "text-amber-500" },
  info:    { icon: Info,          accent: "border-l-[#0047AC]",   iconColor: "text-[#0047AC]" },
};

const DURATION: Record<NotificationKind, number> = {
  success: 4000, info: 4000, warning: 5000, error: 6000,
};

function ToastCard({ n }: { n: AppNotification }) {
  const dispatch = useAppDispatch();
  const [show, setShow] = useState(false);
  const { icon: Icon, accent, iconColor } = STYLES[n.kind];

  useEffect(() => {
    const raf = requestAnimationFrame(() => setShow(true));
    const timer = setTimeout(() => dispatch(dismissToast(n.id)), DURATION[n.kind]);
    return () => { cancelAnimationFrame(raf); clearTimeout(timer); };
  }, [dispatch, n.id, n.kind]);

  return (
    <div
      className={`flex items-start gap-3 bg-white border border-gray-200 border-l-4 ${accent} rounded-lg shadow-lg px-4 py-3 transition-all duration-300 ${
        show ? "opacity-100 translate-x-0" : "opacity-0 translate-x-6"
      }`}
      role="status"
    >
      <Icon size={18} className={`${iconColor} shrink-0 mt-0.5`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 leading-snug">{n.title}</p>
        {n.message && <p className="text-xs text-gray-500 mt-0.5 break-words">{n.message}</p>}
      </div>
      <button
        onClick={() => dispatch(dismissToast(n.id))}
        className="p-1 -mr-1 -mt-1 rounded text-gray-300 hover:text-gray-500 hover:bg-gray-50 transition-colors shrink-0"
        aria-label="Cerrar"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export default function Toaster() {
  const items    = useAppSelector((s) => s.notifications.items);
  const toastIds = useAppSelector((s) => s.notifications.toasts);

  const toasts = toastIds
    .map((id) => items.find((n) => n.id === id))
    .filter((n): n is AppNotification => Boolean(n));

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)]">
      {toasts.map((n) => <ToastCard key={n.id} n={n} />)}
    </div>
  );
}
