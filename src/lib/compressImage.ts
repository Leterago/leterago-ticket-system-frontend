// Compresión de imágenes en el cliente ANTES de subirlas. Las imágenes se guardan
// embebidas como data-URLs base64 (payloads de ticket y comentarios), así que
// reducir su peso aquí es clave. Redimensiona por el lado más largo y reencoda a
// JPEG. Reutilizado por el formulario de compra y por los comentarios de tickets.

/** Tamaño máximo aceptado por archivo ANTES de comprimir. */
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024; // 5 MB

const DEFAULT_MAX_DIMENSION = 1280; // px, lado más largo
const DEFAULT_QUALITY = 0.75;

export function compressImage(
  file: File,
  { maxDimension = DEFAULT_MAX_DIMENSION, quality = DEFAULT_QUALITY }: { maxDimension?: number; quality?: number } = {},
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        // Escala por el lado más largo para que también encojan las imágenes altas.
        const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("No se pudo obtener el contexto 2D del canvas"));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = src;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
