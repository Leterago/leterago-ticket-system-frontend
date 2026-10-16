import type { ComponentType } from "react";
import type { CategoryId } from "../types/types";
import type { CategoryFormProps } from "./types";

import SolicitudReunionForm, {
  defaultValue as reunionDefault,
  initialValue as reunionInitial,
  validate as reunionValidate,
  type SolicitudReunionPayload,
} from "./SolicitudReunionForm";
import SolicitudCompraForm, {
  defaultValue as compraDefault,
} from "./SolicitudCompraForm";
import SolicitudBancosForm, {
  defaultValue as bancosDefault,
} from "./SolicitudBancosForm";
import SolicitudMantenimientoForm, {
  defaultValue as mantenimientoDefault,
} from "./SolicitudMantenimientoForm";

// To register a category-specific form:
//   1. Create ./<CategoryName>Form.tsx exporting the component (default) and `defaultValue`.
//   2. Add a line in FORM_REGISTRY below.
// Page picks it up automatically.
//
// Optional per entry:
//   - initialValue(params): prefill from the URL query (falls back to defaultValue).
//   - validate(value, original?): message blocking submit, or null. `original` is the
//     saved payload when editing.

export type RegistryEntry = {
  Component: ComponentType<CategoryFormProps<unknown>>;
  defaultValue: unknown;
  required: boolean;
  initialValue?: (params: URLSearchParams) => unknown;
  validate?: (value: unknown, original?: unknown) => string | null;
};

export const FORM_REGISTRY: Partial<Record<CategoryId, RegistryEntry>> = {
  "solicitud-reunion": {
    Component: SolicitudReunionForm as ComponentType<CategoryFormProps<unknown>>,
    defaultValue: reunionDefault,
    required: true,
    initialValue: reunionInitial,
    validate: (v, o) => reunionValidate(v as SolicitudReunionPayload, o as SolicitudReunionPayload | undefined),
  },
  "solicitud-compra": {
    Component: SolicitudCompraForm as ComponentType<CategoryFormProps<unknown>>,
    defaultValue: compraDefault,
    required: false,
  },
  "solicitud-bancos": {
    Component: SolicitudBancosForm as ComponentType<CategoryFormProps<unknown>>,
    defaultValue: bancosDefault,
    required: false,
  },
  "solicitud-mantenimiento": {
    Component: SolicitudMantenimientoForm as ComponentType<CategoryFormProps<unknown>>,
    defaultValue: mantenimientoDefault,
    required: true,
  },
};

export function getCategoryForm(categoryId: CategoryId): RegistryEntry | undefined {
  return FORM_REGISTRY[categoryId];
}
