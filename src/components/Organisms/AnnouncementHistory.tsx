import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { History, Loader2, X, CopyPlus, AlertTriangle } from "lucide-react";
import { api, ApiError, type AnnouncementDetail, type AnnouncementSummary } from "../../api/client";
import { useCurrentUser } from "../../store/hooks";
import { formatDateTime } from "../../lib/formatDate";

const PAGE = 20;

type Props = {
  /** Cambia tras cada envío real para recargar la lista. */
  refreshKey: number;
  /** "Usar como borrador": copia un comunicado anterior al editor. */
  onReuse: (a: AnnouncementDetail) => void;
};

/** Historial de comunicados enviados (Config → Comunicados), con detalle en un modal. */
export default function AnnouncementHistory({ refreshKey, onReuse }: Props) {
  const currentUser = useCurrentUser();
  const [items, setItems] = useState<AnnouncementSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  // Sin setLoading(true) aquí: la carga inicial ya arranca en loading y "Ver más"
  // lo marca antes de llamar (así el efecto no cambia estado de forma síncrona).
  const load = useCallback(
    async (skip: number) => {
      try {
        const page = await api.listAnnouncements(currentUser.id, { take: PAGE, skip });
        setItems((prev) => (skip === 0 ? page.items : [...prev, ...page.items]));
        setTotal(page.total);
        setError(null);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "No se pudo cargar el historial");
      } finally {
        setLoading(false);
      }
    },
    [currentUser.id],
  );

  useEffect(() => {
    load(0);
  }, [load, refreshKey]);

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden xl:col-span-2">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <History size={15} className="text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-700">Historial de comunicados</h3>
        </div>
        {!error && <span className="text-xs text-gray-400">{total} enviado{total !== 1 ? "s" : ""}</span>}
      </div>

      {error ? (
        <div className="flex items-start gap-2 px-4 py-4 text-sm text-amber-800 dark:text-amber-300 bg-amber-50">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          {error}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-left">
                <Th>Fecha</Th>
                <Th>Asunto</Th>
                <Th>Enviado por</Th>
                <Th>Resultado</Th>
              </tr>
            </thead>
            <tbody>
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center py-10 text-gray-400 text-sm">
                    Aún no se ha enviado ningún comunicado.
                  </td>
                </tr>
              )}
              {items.map((a) => (
                <tr
                  key={a.id}
                  onClick={() => setOpenId(a.id)}
                  className="border-b border-gray-50 hover:bg-blue-50/40 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{formatDateTime(a.createdAt)}</td>
                  <td className="px-4 py-3 font-semibold text-gray-800">{a.subject}</td>
                  <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{a.sentByName}</td>
                  <td className="px-4 py-3"><ResultBadge a={a} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {(loading || items.length < total) && (
            <div className="flex justify-center py-3 border-t border-gray-100">
              {loading ? (
                <Loader2 size={16} className="animate-spin text-gray-400" />
              ) : (
                <button onClick={() => { setLoading(true); load(items.length); }} className="text-xs font-semibold text-[#0047AC] hover:underline">
                  Ver más
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {openId && (
        <DetailModal
          id={openId}
          onClose={() => setOpenId(null)}
          onReuse={(a) => { onReuse(a); setOpenId(null); }}
        />
      )}
    </div>
  );
}

function ResultBadge({ a }: { a: AnnouncementSummary }) {
  if (!a.mailEnabled) {
    return <span className="text-xs font-medium text-gray-500">No enviado (correo deshabilitado)</span>;
  }
  const ok = a.failed === 0;
  return (
    <span
      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
        ok
          ? "bg-emerald-50 text-emerald-700 dark:text-emerald-300"
          : "bg-amber-50 text-amber-800 dark:text-amber-300"
      }`}
    >
      {a.sent} / {a.recipients} enviados{!ok && ` · ${a.failed} fallaron`}
    </span>
  );
}

function DetailModal({ id, onClose, onReuse }: { id: string; onClose: () => void; onReuse: (a: AnnouncementDetail) => void }) {
  const currentUser = useCurrentUser();
  const [detail, setDetail] = useState<AnnouncementDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stale = false;
    api
      .getAnnouncement(currentUser.id, id)
      .then((d) => { if (!stale) setDetail(d); })
      .catch((e: unknown) => { if (!stale) setError(e instanceof ApiError ? e.message : "No se pudo cargar"); });
    return () => { stale = true; };
  }, [currentUser.id, id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl max-h-[92vh] flex flex-col bg-white rounded-lg border border-gray-200 shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-100">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-gray-900 truncate">{detail?.subject ?? "Comunicado"}</h3>
            {detail && (
              <p className="text-xs text-gray-500 mt-0.5">
                {formatDateTime(detail.createdAt)} · {detail.sentByName} · <ResultBadge a={detail} />
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 shrink-0" aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 min-h-0">
          {error ? (
            <p className="p-5 text-sm text-red-600 dark:text-red-300">{error}</p>
          ) : !detail ? (
            <div className="flex justify-center py-16"><Loader2 size={20} className="animate-spin text-gray-400" /></div>
          ) : (
            <iframe title="Comunicado enviado" srcDoc={detail.html} sandbox="" className="w-full h-[60vh] bg-[#f3f4f6]" />
          )}
        </div>

        {detail && (
          <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-100">
            <button
              onClick={() => onReuse(detail)}
              className="flex items-center gap-2 border border-gray-200 text-gray-700 text-sm px-4 py-2 rounded-md font-semibold hover:bg-gray-50"
            >
              <CopyPlus size={14} />
              Usar como borrador
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

const Th = ({ children }: { children: React.ReactNode }) => (
  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">{children}</th>
);
