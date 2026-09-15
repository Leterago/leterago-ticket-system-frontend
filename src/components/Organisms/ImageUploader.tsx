import { useRef, useState, useEffect } from "react";
import { ImagePlus, X, AlertCircle, ZoomIn } from "lucide-react";
import ImageLightbox from "./ImageLightbox";
import { compressImage, IMAGE_MAX_BYTES } from "../../lib/compressImage";

interface ImageUploaderProps {
  /** Imágenes actuales (data-URLs). */
  images: string[];
  /** Devuelve la lista completa ya actualizada. */
  onChange: (next: string[]) => void;
  /** En sólo lectura no se puede subir ni eliminar. */
  readOnly?: boolean;
  /** Título de la tarjeta. */
  title?: string;
}

/** Carga de imágenes compartida por las categorías que adjuntan fotos. */
export default function ImageUploader({
  images,
  onChange,
  readOnly = false,
  title = "Imágenes adjuntas",
}: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  // Índice de la imagen abierta en el visor (null = cerrado).
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  useEffect(() => {
    if (readOnly) return;
    const onPaste = (e: ClipboardEvent) => {
      const items = Array.from(e.clipboardData?.items ?? []);
      const imageFiles = items
        .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
        .map((item) => item.getAsFile())
        .filter((f): f is File => f !== null);
      if (imageFiles.length > 0) {
        const dt = new DataTransfer();
        imageFiles.forEach((f) => dt.items.add(f));
        handleFiles(dt.files);
      }
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [readOnly, images]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || readOnly) return;
    const oversized = Array.from(files).filter((f) => f.size > IMAGE_MAX_BYTES);
    if (oversized.length) {
      setErrors(oversized.map((f) => `"${f.name}" supera los 5 MB.`));
      return;
    }
    setErrors([]);
    setLoading(true);
    try {
      const compressed = await Promise.all(Array.from(files).map((f) => compressImage(f)));
      onChange([...images, ...compressed]);
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const remove = (idx: number) => {
    if (readOnly) return;
    onChange(images.filter((_, i) => i !== idx));
  };

  return (
    <div className="flex flex-col gap-4 border border-gray-200 p-6 rounded-xl bg-white">
      <h2 className="text-sm font-semibold text-gray-700">{title}</h2>

      {!readOnly && (
        <>
          <button
            type="button"
            disabled={loading}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              handleFiles(e.dataTransfer.files);
            }}
            className={`flex items-center justify-center gap-2 border-2 border-dashed rounded-lg py-16 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed
              ${dragging
                ? "border-[#0047AC] bg-blue-50 text-[#0047AC]"
                : "border-gray-200 text-gray-400 hover:border-[#0047AC] hover:text-[#0047AC]"
              }`}
          >
            <ImagePlus size={18} />
            {loading ? "Procesando..." : dragging ? "Suelta las imágenes aquí" : "Haz clic o arrastra imágenes aquí"}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <p className="text-[11px] text-gray-400 -mt-2">
            PNG, JPG, WEBP · máx. 5 MB · se comprimen automáticamente · también puedes pegar con Ctrl+V
          </p>

          {errors.map((err, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-red-500 bg-red-50 border border-red-100 rounded-md px-3 py-2">
              <AlertCircle size={13} />
              {err}
            </div>
          ))}
        </>
      )}

      {images.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {images.map((src, idx) => (
            <div key={idx} className="relative group rounded-lg overflow-hidden border border-gray-200 aspect-video bg-gray-50">
              <img
                src={src}
                alt={`imagen-${idx + 1}`}
                className="w-full h-full object-cover cursor-zoom-in"
                onClick={() => setViewerIndex(idx)}
              />
              {/* Indicador de "ampliar" al pasar el cursor (no intercepta clics). */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition-colors">
                <ZoomIn size={20} className="text-white opacity-0 group-hover:opacity-90 transition-opacity drop-shadow" />
              </div>
              {!readOnly && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); remove(idx); }}
                  className="absolute top-1.5 right-1.5 bg-black/50 hover:bg-black/70 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        readOnly && (
          <p className="text-sm text-gray-400 italic">Sin imágenes adjuntas.</p>
        )
      )}

      {viewerIndex !== null && (
        <ImageLightbox
          images={images}
          index={viewerIndex}
          onIndexChange={setViewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      )}
    </div>
  );
}
