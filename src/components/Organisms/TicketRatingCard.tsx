import { useState } from "react";
import { Loader2 } from "lucide-react";
import StarRating, { RATING_LABELS } from "../Atoms/StarRating";
import type { TicketRating } from "../../types/types";

type Props = {
  rating: TicketRating | null | undefined;
  /** True when the current user may submit/update the rating (creator + resolved ticket). */
  canRate: boolean;
  saving: boolean;
  onSubmit: (value: number, comment: string) => void;
};

/**
 * Satisfaction card shown in the ticket detail sidebar.
 * - Already rated → read-only stars + comment (the creator can re-open to edit).
 * - Creator on a resolved ticket, not yet rated → interactive form.
 * - Otherwise → nothing.
 */
export default function TicketRatingCard({ rating, canRate, saving, onSubmit }: Props) {
  const rated = rating != null;
  const [reRate, setReRate] = useState(false);
  const [value, setValue] = useState(rating?.value ?? 0);
  const [comment, setComment] = useState(rating?.comment ?? "");

  if (!rated && !canRate) return null;

  if (rated && !reRate) {
    return (
      <div className="bg-white rounded-lg border border-gray-300 p-5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Calificación</p>
        <StarRating value={rating!.value} size={22} />
        <p className="text-sm font-medium text-gray-600 mt-2">{RATING_LABELS[rating!.value]}</p>
        {rating!.comment && <p className="text-sm text-gray-500 mt-2 italic">“{rating!.comment}”</p>}
        {canRate && (
          <button
            onClick={() => { setValue(rating!.value); setComment(rating!.comment ?? ""); setReRate(true); }}
            className="mt-3 text-xs font-semibold text-[#0047AC] hover:underline"
          >
            Editar calificación
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-300 p-5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Califica este servicio</p>
      <p className="text-xs text-gray-500 mb-3">¿Qué tan satisfecho quedaste con la resolución?</p>
      <StarRating value={value} onChange={setValue} size={28} showLabel />
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={3}
        maxLength={500}
        placeholder="Comentario (opcional)"
        className="w-full mt-3 bg-gray-50 border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:border-[#0047AC] resize-none"
      />
      <button
        onClick={() => onSubmit(value, comment)}
        disabled={value < 1 || saving}
        className="mt-3 w-full flex items-center justify-center gap-2 bg-[#0047AC] text-white rounded-md py-2.5 text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saving && <Loader2 size={14} className="animate-spin" />}
        {rated ? "Actualizar calificación" : "Enviar calificación"}
      </button>
    </div>
  );
}
