import { Star } from "lucide-react";
import { useState } from "react";
import Tooltip from "@mui/material/Tooltip";

export const RATING_LABELS = ["", "Muy malo", "Malo", "Regular", "Bueno", "Excelente"];

type Props = {
  value: number;                  // 0 = sin calificar
  onChange?: (v: number) => void; // omitir → solo lectura
  size?: number;
  disabled?: boolean;
  showLabel?: boolean;
};

/** Estrellas 1–5. Sin `onChange` es de solo lectura (para mostrar la calificación). */
export default function StarRating({ value, onChange, size = 24, disabled = false, showLabel = false }: Props) {
  const [hover, setHover] = useState(0);
  const readOnly = !onChange;
  const shown = hover || value;

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <Tooltip key={n} title={RATING_LABELS[n]} arrow>
          <span className="inline-flex">
            <button
              type="button"
              disabled={readOnly || disabled}
              onClick={() => onChange?.(n)}
              onMouseEnter={() => !readOnly && setHover(n)}
              onMouseLeave={() => !readOnly && setHover(0)}
              aria-label={`${n} — ${RATING_LABELS[n]}`}
              className={`${readOnly ? "cursor-default" : "cursor-pointer hover:scale-110"} transition-transform disabled:cursor-not-allowed`}
            >
              <Star
                size={size}
                className={n <= shown ? "fill-amber-400 text-amber-400" : "text-gray-300 dark:text-gray-600"}
              />
            </button>
          </span>
        </Tooltip>
      ))}
      {showLabel && shown > 0 && (
        <span className="ml-2 text-xs font-medium text-gray-500">{RATING_LABELS[shown]}</span>
      )}
    </div>
  );
}
