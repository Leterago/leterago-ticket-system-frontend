import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Send, FlaskConical, Bold, List, Loader2, Megaphone, CheckCircle2, AlertTriangle, X } from "lucide-react";
import { api, ApiError, type AnnouncementBody, type AnnouncementResult } from "../../api/client";
import { useAppDispatch, useCurrentUser } from "../../store/hooks";
import AnnouncementHistory from "../Organisms/AnnouncementHistory";
import { notify } from "../../store/notificationsSlice";

// Pestaña "Comunicados" de Configuración (permiso announcements.send): redactar un
// correo para TODOS los usuarios activos, p. ej. para anunciar funciones nuevas.
// La vista previa es el HTML real que genera el backend (lib/announcements.ts), así
// que lo que se ve es exactamente lo que llega. El borrador se guarda en este
// navegador hasta que se envía.

const DRAFT_KEY = "mesa_announcement_draft";
const EMPTY: AnnouncementBody = { subject: "", body: "", ctaText: "", ctaUrl: "" };

function loadDraft(): AnnouncementBody {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? { ...EMPTY, ...JSON.parse(raw) } : EMPTY;
  } catch {
    return EMPTY;
  }
}

function errorMessage(e: unknown): string {
  if (!(e instanceof ApiError)) return "Error de red";
  const fields = (e.details as { fieldErrors?: Record<string, string[]> } | undefined)?.fieldErrors;
  const first = fields && Object.values(fields).flat()[0];
  return first ?? e.message;
}

export default function AnnouncementsPanel() {
  const currentUser = useCurrentUser();
  const dispatch = useAppDispatch();
  const [draft, setDraft] = useState<AnnouncementBody>(loadDraft);
  const [recipients, setRecipients] = useState<number | null>(null);
  const [previewHtml, setPreviewHtml] = useState("");
  const [sending, setSending] = useState<null | "test" | "all">(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [lastResult, setLastResult] = useState<AnnouncementResult | null>(null);
  const [historyTick, setHistoryTick] = useState(0);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    api.getAnnouncementRecipients(currentUser.id).then((r) => setRecipients(r.count)).catch(() => setRecipients(null));
  }, [currentUser.id]);

  // Guardar el borrador (comodidad por navegador; puede no estar disponible).
  useEffect(() => {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch { /* sin almacenamiento */ }
  }, [draft]);

  // Vista previa con el HTML real del backend, con un pequeño retardo al escribir.
  useEffect(() => {
    let stale = false;
    const id = window.setTimeout(() => {
      api
        .previewAnnouncement(currentUser.id, draft)
        .then((r) => { if (!stale) setPreviewHtml(r.html); })
        .catch(() => { /* se muestra la última vista previa válida */ });
    }, 400);
    return () => { stale = true; window.clearTimeout(id); };
  }, [currentUser.id, draft]);

  const set = (patch: Partial<AnnouncementBody>) => setDraft((d) => ({ ...d, ...patch }));
  const canSend = draft.subject.trim().length > 0 && draft.body.trim().length > 0 && !sending;

  // Ayudas de formato sobre la selección del textarea.
  const applyFormat = (kind: "bold" | "list") => {
    const el = bodyRef.current;
    if (!el) return;
    const { selectionStart: a, selectionEnd: b, value } = el;
    let next: string;
    let caret: number;
    if (kind === "bold") {
      const sel = value.slice(a, b) || "texto";
      next = `${value.slice(0, a)}**${sel}**${value.slice(b)}`;
      caret = a + sel.length + 4;
    } else {
      const lineStart = value.lastIndexOf("\n", a - 1) + 1;
      const block = value.slice(lineStart, b) || "";
      const listed = (block || "Elemento").split("\n").map((l) => (l.startsWith("- ") ? l : `- ${l}`)).join("\n");
      next = `${value.slice(0, lineStart)}${listed}${value.slice(b)}`;
      caret = lineStart + listed.length;
    }
    set({ body: next });
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(caret, caret); });
  };

  const send = async (test: boolean) => {
    setSending(test ? "test" : "all");
    setConfirmOpen(false);
    try {
      const res = await api.sendAnnouncement(currentUser.id, { ...draft, test });
      setLastResult(res);
      if (!test) setHistoryTick((t) => t + 1);
      if (!res.mailEnabled) {
        dispatch(notify({ kind: "warning", title: "El correo está deshabilitado", message: "El servidor no tiene SMTP configurado: no se envió nada." }));
      } else if (res.failed > 0) {
        dispatch(notify({ kind: "warning", title: "Comunicado enviado con errores", message: `${res.sent} de ${res.recipients} enviados; ${res.failed} fallaron.` }));
      } else {
        dispatch(notify({
          kind: "success",
          title: test ? "Prueba enviada" : "Comunicado enviado",
          message: test ? "Revisa tu bandeja de entrada." : `Enviado a ${res.sent} usuarios.`,
        }));
        if (!test) setDraft(EMPTY);
      }
    } catch (e) {
      dispatch(notify({ kind: "error", title: "No se envió el comunicado", message: errorMessage(e) }));
    } finally {
      setSending(null);
    }
  };

  const input =
    "w-full bg-gray-50 border border-gray-200 rounded-md px-3.5 py-2.5 text-sm outline-none focus:border-[#0047AC] focus:ring-2 focus:ring-blue-100 transition-all";
  const label = "text-[10px] font-bold text-gray-400 uppercase tracking-wider";

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
      {/* ── Editor ── */}
      <div className="flex flex-col gap-4 bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-md bg-blue-50 text-[#0047AC] flex items-center justify-center shrink-0">
            <Megaphone size={18} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Nuevo comunicado</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Se envía por correo a <strong>todos los usuarios activos</strong>
              {recipients != null && <> ({recipients})</>}. Ideal para anunciar funciones nuevas o avisos generales.
            </p>
          </div>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className={label}>Asunto</span>
          <input
            value={draft.subject}
            maxLength={150}
            onChange={(e) => set({ subject: e.target.value })}
            placeholder="Ej. Novedades en la Mesa de Servicio: calendario de salones"
            className={input}
          />
        </label>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className={label}>Mensaje</span>
            <div className="flex items-center gap-1">
              <FormatButton title="Negrita (**texto**)" onClick={() => applyFormat("bold")}><Bold size={13} /></FormatButton>
              <FormatButton title="Lista (- elemento)" onClick={() => applyFormat("list")}><List size={13} /></FormatButton>
            </div>
          </div>
          <textarea
            ref={bodyRef}
            rows={12}
            maxLength={10_000}
            value={draft.body}
            onChange={(e) => set({ body: e.target.value })}
            placeholder={"Hola a todos,\n\nYa está disponible el **calendario de salones**:\n\n- Consulta qué salones están libres\n- Reserva arrastrando sobre el horario\n\nCualquier duda, escríbannos."}
            className={`${input} resize-y font-[inherit] leading-relaxed`}
          />
          <p className="text-[11px] text-gray-400">
            Deja una línea en blanco entre párrafos. <code>**texto**</code> para negrita, líneas que empiezan por{" "}
            <code>- </code> para listas; los enlaces se detectan solos.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className={label}>Botón (opcional)</span>
            <input
              value={draft.ctaText ?? ""}
              maxLength={60}
              onChange={(e) => set({ ctaText: e.target.value })}
              placeholder="Ej. Probar ahora"
              className={input}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={label}>Enlace del botón</span>
            <input
              value={draft.ctaUrl ?? ""}
              onChange={(e) => set({ ctaUrl: e.target.value })}
              placeholder="Vacío = la Mesa de Servicio"
              disabled={!draft.ctaText?.trim()}
              className={`${input} disabled:opacity-50`}
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={() => send(true)}
            disabled={!canSend}
            className="flex items-center gap-2 border border-gray-200 text-gray-700 text-sm px-4 py-2.5 rounded-md font-semibold hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending === "test" ? <Loader2 size={15} className="animate-spin" /> : <FlaskConical size={15} />}
            Enviarme una prueba
          </button>
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            disabled={!canSend || !recipients}
            className="flex items-center gap-2 bg-[#0047AC] text-white text-sm px-4 py-2.5 rounded-md font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed sm:ml-auto"
          >
            {sending === "all" ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            {sending === "all" ? "Enviando…" : `Enviar a todos${recipients != null ? ` (${recipients})` : ""}`}
          </button>
        </div>

        {lastResult && !lastResult.test && lastResult.mailEnabled && (
          <div className={`flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm ${
            lastResult.failed > 0
              ? "border-amber-200 bg-amber-50 text-amber-800 dark:text-amber-300"
              : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:text-emerald-300"
          }`}>
            {lastResult.failed > 0 ? <AlertTriangle size={16} className="shrink-0 mt-0.5" /> : <CheckCircle2 size={16} className="shrink-0 mt-0.5" />}
            <span>
              Último envío: {lastResult.sent} de {lastResult.recipients} correos enviados
              {lastResult.failed > 0 && `; ${lastResult.failed} fallaron (revisa el log del servidor)`}.
            </span>
          </div>
        )}
      </div>

      {/* ── Vista previa ── */}
      <div className="flex flex-col bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-700">Vista previa</p>
          <p className="text-xs text-gray-400">Así llegará a la bandeja de entrada.</p>
        </div>
        <iframe
          title="Vista previa del comunicado"
          srcDoc={previewHtml}
          sandbox=""
          className="w-full flex-1 min-h-[560px] bg-[#f3f4f6]"
        />
      </div>

      <AnnouncementHistory
        refreshKey={historyTick}
        onReuse={(a) => {
          setDraft({ subject: a.subject, body: a.body, ctaText: a.ctaText ?? "", ctaUrl: a.ctaUrl ?? "" });
          setLastResult(null);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      />

      {confirmOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4" onClick={() => setConfirmOpen(false)}>
          <div className="w-full max-w-md bg-white rounded-lg border border-gray-200 shadow-xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-base font-bold text-gray-900">¿Enviar el comunicado a todos?</h3>
              <button onClick={() => setConfirmOpen(false)} className="text-gray-400 hover:text-gray-600" aria-label="Cerrar">
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-gray-600 mt-3">
              <strong>“{draft.subject.trim()}”</strong> llegará a <strong>{recipients} usuarios</strong>. Un correo enviado no se
              puede retirar; si no lo has hecho, envíate antes una prueba.
            </p>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setConfirmOpen(false)}
                className="border border-gray-200 text-gray-600 text-sm px-4 py-2 rounded-md font-semibold hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => send(false)}
                className="flex items-center gap-2 bg-[#0047AC] text-white text-sm px-4 py-2 rounded-md font-semibold hover:bg-blue-700"
              >
                <Send size={14} />
                Sí, enviar a {recipients}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

function FormatButton({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="p-1.5 rounded text-gray-500 hover:bg-gray-100 hover:text-gray-800"
    >
      {children}
    </button>
  );
}
