/** Contract every category-specific form must satisfy. Forms are controlled. */
export interface CategoryFormProps<T = unknown> {
  value: T;
  onChange: (next: T) => void;
  /** When true, the form renders as a read-only viewer of `value`. */
  readOnly?: boolean;
  /** When true, post-creation sections (e.g. execution log) are rendered. */
  showExecSection?: boolean;
  /** Ticket que se está editando (undefined al crear). */
  ticketId?: string;
}
