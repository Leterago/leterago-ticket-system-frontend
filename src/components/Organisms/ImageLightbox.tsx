import { useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight, Download } from "lucide-react";

interface ImageLightboxProps {
  /** Lista de imágenes (data-URLs o URLs). El visor muestra `images[index]`. */
  images: string[];
  /** Índice de la imagen visible. */
  index: number;
  /** Cambia la imagen visible (navegación). */
  onIndexChange: (i: number) => void;
  /** Cierra el visor. */
  onClose: () => void;
}

/**
 * Visualizador a pantalla completa de imágenes adjuntas (lightbox).
 * Reutilizable con cualquier `string[]` de imágenes. Se renderiza vía portal
 * sobre `document.body` (z-[9999]) para escapar de `overflow-hidden`/stacking
 * contexts. Cierra con la X, Escape o clic en el fondo; navega con las flechas
 * en pantalla o ←/→ del teclado (con vuelta circular). Bloquea el scroll del
 * fondo mientras está abierto. Sigue la convención de overlays Tailwind del
 * proyecto (sin MUI Modal).
 */
export default function ImageLightbox({
  images,
  index,
  onIndexChange,
  onClose,
}: ImageLightboxProps) {
  const count = images.length;
  const hasMultiple = count > 1;

  const goPrev = useCallback(
    () => onIndexChange((index - 1 + count) % count),
    [index, count, onIndexChange],
  );
  const goNext = useCallback(
    () => onIndexChange((index + 1) % count),
    [index, count, onIndexChange],
  );

  // Teclado (Escape cierra, ←/→ navegan) + bloqueo del scroll del fondo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && hasMultiple) goPrev();
      else if (e.key === "ArrowRight" && hasMultiple) goNext();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, goPrev, goNext, hasMultiple]);

  if (count === 0 || index < 0 || index >= count) return null;
  const src = images[index];

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      {/* Barra superior: contador + acciones */}
      <div
        className="absolute top-0 inset-x-0 flex items-center justify-between p-4 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-sm font-medium select-none">
          {hasMultiple ? `${index + 1} / ${count}` : "Imagen adjunta"}
        </span>
        <div className="flex items-center gap-1">
          <a
            href={src}
            download={`imagen-${index + 1}.jpg`}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
            title="Descargar"
            aria-label="Descargar imagen"
          >
            <Download size={20} />
          </a>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
            title="Cerrar"
            aria-label="Cerrar"
          >
            <X size={22} />
          </button>
        </div>
      </div>

      {/* Imagen a tamaño completo (sin recortar) */}
      <img
        src={src}
        alt={`imagen-${index + 1}`}
        className="max-h-[90vh] max-w-[92vw] object-contain rounded shadow-lg select-none"
        onClick={(e) => e.stopPropagation()}
      />

      {/* Flechas de navegación (solo con varias imágenes) */}
      {hasMultiple && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goPrev();
            }}
            className="absolute left-3 sm:left-5 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            title="Anterior"
            aria-label="Imagen anterior"
          >
            <ChevronLeft size={28} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goNext();
            }}
            className="absolute right-3 sm:right-5 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            title="Siguiente"
            aria-label="Imagen siguiente"
          >
            <ChevronRight size={28} />
          </button>
        </>
      )}
    </div>,
    document.body,
  );
}
