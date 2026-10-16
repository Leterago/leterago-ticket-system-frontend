import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, AlertTriangle } from "lucide-react";
import Logo from "../Atoms/Logo";
import StarRating, { RATING_LABELS } from "../Atoms/StarRating";
import { api, ApiError, type RatingLinkInfo } from "../../api/client";

// Página pública /calificar?t=<token>&v=<1..5> a la que llevan las estrellas del
// correo "Recordar confirmar". Calificar un ticket resuelto lo CONFIRMA. No requiere
// sesión: el token firmado identifica el ticket y a su creador. La estrella elegida en el correo llega preseleccionada, pero la
// calificación solo se guarda al pulsar "Enviar" (los antivirus de correo abren los
// enlaces solos y calificarían por la persona).
export default function RateByLinkPage() {
  const [params] = useSearchParams();
  const token = params.get("t") ?? "";
  const preset = Number(params.get("v"));

  const [info, setInfo] = useState<RatingLinkInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(token ? null : "El enlace está incompleto.");
  const [value, setValue] = useState(preset >= 1 && preset <= 5 ? preset : 0);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState<null | { confirmed: boolean }>(null);

  useEffect(() => {
    if (!token) return;
    let stale = false;
    api
      .getRatingLink(token)
      .then((data) => {
        if (stale) return;
        setInfo(data);
        if (data.rating) {
          setValue((v) => v || data.rating!.value);
          setComment(data.rating.comment ?? "");
        }
      })
      .catch((e: unknown) => {
        if (!stale) setLoadError(e instanceof ApiError ? e.message : "No se pudo conectar con el servidor.");
      });
    return () => { stale = true; };
  }, [token]);

  const submit = async () => {
    if (!value || saving) return;
    setSaving(true);
    setSubmitError(null);
    try {
      const res = await api.submitRatingLink(token, value, comment.trim() || null);
      setDone({ confirmed: res.confirmed });
    } catch (e) {
      setSubmitError(e instanceof ApiError ? e.message : "No se pudo enviar. Inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <Logo className="w-36 h-auto mx-auto mb-3" />
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Mesa de Servicio</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-8">
          {loadError ? (
            <Message icon={<AlertTriangle size={28} className="text-amber-500" />} title="Enlace no válido">
              {loadError}
            </Message>
          ) : !info ? (
            <div className="flex flex-col items-center gap-3 py-6 text-gray-400">
              <Loader2 size={24} className="animate-spin" />
              <p className="text-sm">Cargando…</p>
            </div>
          ) : done ? (
            <Message
              icon={<CheckCircle2 size={32} className="text-emerald-500" />}
              title={done.confirmed ? "¡Solicitud confirmada!" : "¡Gracias por tu calificación!"}
            >
              {done.confirmed ? <>Confirmaste <strong>{info.ticketId}</strong> con</> : <>Registramos para <strong>{info.ticketId}</strong></>}{" "}
              {value} {value === 1 ? "estrella" : "estrellas"} ({RATING_LABELS[value]}). Tu opinión nos ayuda a mejorar el servicio.
            </Message>
          ) : !info.canRate ? (
            <Message icon={<AlertTriangle size={28} className="text-amber-500" />} title="Este ticket no se puede calificar ahora">
              <strong>{info.ticketId}</strong> ya no está marcado como resuelto (pudo reabrirse o cancelarse).
              Puedes revisarlo en la app.
            </Message>
          ) : (
            <div className="flex flex-col gap-5">
              <div>
                <p className="text-sm text-gray-500">
                  {info.status === "completed"
                    ? <>Hola {info.requesterName}, tu solicitud está resuelta. Para <strong>confirmarla</strong>, califica la atención recibida.</>
                    : <>Hola {info.requesterName}, tu solicitud ya está confirmada. Puedes cambiar tu calificación.</>}
                </p>
                <div className="mt-3 rounded-md border border-gray-200 bg-gray-50 px-4 py-3">
                  <p className="text-[#0047AC] font-mono font-bold text-xs">{info.ticketId}</p>
                  <p className="text-gray-900 font-semibold text-sm mt-0.5">{info.title}</p>
                </div>
              </div>

              <div className="flex flex-col items-center gap-1">
                <StarRating value={value} onChange={setValue} size={34} disabled={saving} />
                <p className="text-sm font-medium text-gray-600 h-5">{value ? RATING_LABELS[value] : ""}</p>
                {info.rating && info.status === "completed" && (
                  <p className="text-xs text-gray-400">Ya habías calificado este ticket; al enviar quedará confirmado.</p>
                )}
              </div>

              <label className="flex flex-col gap-1.5">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Comentario (opcional)</span>
                <textarea
                  rows={3}
                  maxLength={500}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="¿Algo que quieras destacar o mejorar?"
                  className="w-full bg-gray-50 border border-gray-200 rounded-md px-3.5 py-2.5 text-sm outline-none focus:border-[#0047AC] focus:ring-2 focus:ring-blue-100 resize-none"
                />
              </label>

              {submitError && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700 dark:text-red-300">
                  {submitError}
                </div>
              )}

              <button
                onClick={submit}
                disabled={!value || saving}
                className="w-full bg-[#0047AC] text-white py-2.5 rounded-md font-semibold text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving
                  ? "Enviando…"
                  : !value
                    ? "Elige una calificación"
                    : info.status === "completed" ? "Confirmar y calificar" : "Actualizar calificación"}
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          <Link to="/" className="hover:text-[#0047AC]">Ir a la Mesa de Servicio</Link>
        </p>
      </div>
    </div>
  );
}

function Message({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center gap-3 py-2">
      {icon}
      <h1 className="text-lg font-bold text-gray-900">{title}</h1>
      <p className="text-sm text-gray-500 leading-relaxed">{children}</p>
    </div>
  );
}
