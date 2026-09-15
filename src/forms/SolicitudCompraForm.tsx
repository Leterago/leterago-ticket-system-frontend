import type { CategoryFormProps } from "./types";
import ImageUploader from "../components/Organisms/ImageUploader";

export type SolicitudCompraPayload = {
  imagenes: string[];
};

export const defaultValue: SolicitudCompraPayload = {
  imagenes: [],
};

export default function SolicitudCompraForm({
  value,
  onChange,
  readOnly = false,
}: CategoryFormProps<SolicitudCompraPayload>) {
  return (
    <ImageUploader
      images={value.imagenes ?? []}
      onChange={(imagenes) => onChange({ ...value, imagenes })}
      readOnly={readOnly}
    />
  );
}
