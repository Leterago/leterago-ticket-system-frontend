import { useState, useMemo, useEffect } from "react";
import { CheckCircle2, ArrowLeft } from "lucide-react";
import TicketDetailsPanel from "../Organisms/TicketDetailsPanel";
import PageHeader from "../Molecules/PageHeader";
import { useSearchParams, useNavigate } from "react-router-dom";
import { type User as AssigneeUser } from "../Organisms/AssigneePicker";
import { useAppDispatch, useAppSelector, useCurrentUser } from "../../store/hooks";
import { createTicketAsync, clearCreateError } from "../../store/ticketsSlice";
import type { TicketPriority, CategoryId } from "../../types/types";
import { CATEGORIES, getDepartmentForCategory } from "../../config/catalog";
import { canAssign } from "../../store/permissions";
import { getCategoryForm } from "../../forms/registry";

export default function NewTicketFormPage() {
  const [title, setTitle]             = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority]       = useState<TicketPriority>("medium");
  const [assignedTo, setAssignedTo]   = useState<AssigneeUser | null>(null);
  const [submitted, setSubmitted]     = useState(false);
  const [errors, setErrors]           = useState<Record<string, string>>({});

  const [params]    = useSearchParams();
  const navigate    = useNavigate();
  const dispatch    = useAppDispatch();
  const currentUser = useCurrentUser();
  const allUsers    = useAppSelector((s) => s.users.list);
  const creating    = useAppSelector((s) => s.tickets.creating);
  const createError = useAppSelector((s) => s.tickets.createError);

  const categoryId   = (params.get("category") || "solicitud-reunion") as CategoryId;
  const catDef       = CATEGORIES[categoryId];
  const departmentId = useMemo(() => getDepartmentForCategory(categoryId), [categoryId]);

  // Category-specific form (registered in src/forms/registry.ts)
  const formDef = useMemo(() => getCategoryForm(categoryId), [categoryId]);
  const [payload, setPayload] = useState<unknown>(formDef?.defaultValue);

  // Reset payload state when navigating between categories
  useEffect(() => {
    setPayload(formDef?.defaultValue);
  }, [categoryId, formDef]);

  // canAssign needs a mock ticket to check permissions; we use the dept
  // A user can assign if their role is admin/master AND the dept is in their array
  const userCanAssign = useMemo(() => {
    if (!departmentId) return false;
    // Create a minimal ticket-like object just for the permission check
    return canAssign(currentUser, {
      id: "", title: "", departmentId, categoryId,
      status: "pending", priority: "medium",
      createdBy: currentUser.name, createdAt: "", updatedAt: "",
    });
  }, [currentUser, departmentId, categoryId]);

  // Users available for assignment: only admin/participant in this dept (not requesters)
  const assigneeUsers: AssigneeUser[] = useMemo(() => {
    if (!departmentId) return [];
    return allUsers
      .filter((u) =>
        u.role === "master" ||
        u.departments.some((d) => d.departmentId === departmentId && d.role !== "requester")
      )
      .map((u) => ({ id: u.id, name: u.name }));
  }, [allUsers, departmentId]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!title.trim())       e.title       = "El título es obligatorio.";
    if (!description.trim()) e.description = "La descripción es obligatoria.";
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    if (!departmentId) return;

    const result = await dispatch(
      createTicketAsync({
        title:        title.trim(),
        description:  description.trim(),
        departmentId,
        categoryId,
        priority:     priority as TicketPriority,
        assignedToId: userCanAssign ? assignedTo?.id : undefined,
        payload:      formDef ? payload : undefined,
      })
    );

    if (createTicketAsync.fulfilled.match(result)) {
      setSubmitted(true);
    }
  };

  const resetForm = () => {
    setSubmitted(false);
    setTitle(""); setDescription("");
    setPriority("medium"); setAssignedTo(null); setErrors({});
    setPayload(formDef?.defaultValue);
    dispatch(clearCreateError());
  };

  if (!catDef) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-400 text-sm">
        Categoría no encontrada.{" "}
        <button className="ml-2 text-[#0047AC]" onClick={() => navigate("/new-ticket")}>
          Volver
        </button>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-6">
        <div className="bg-white border border-gray-200 rounded-lg p-10  text-center max-w-md w-full">
          <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 size={32} className="text-emerald-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">¡Ticket creado!</h2>
          <p className="text-gray-500 text-sm mb-6">
            Tu solicitud fue registrada en estado <strong>Pendiente</strong>.
            {!userCanAssign && " Un administrador la asignará pronto."}
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => navigate("/tickets")}
              className="w-full bg-[#0047AC] text-white py-2.5 rounded-md font-semibold text-sm hover:bg-blue-700 transition-colors"
            >
              {currentUser.role === "master" || currentUser.role === "admin"
                ? "Ver todos los tickets"
                : "Ver mis tickets"}
            </button>
            <button
              onClick={resetForm}
              className="w-full border border-gray-200 text-gray-600 py-2.5 rounded-md font-semibold text-sm hover:bg-gray-50 transition-colors"
            >
              Crear otro ticket
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full min-h-screen px-6 py-8 max-w-7xl mx-auto gap-6">
      <div className="flex items-start gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-md hover:bg-gray-100 text-gray-500 transition-colors mt-1 shrink-0"
        >
          <ArrowLeft size={18} />
        </button>
        <PageHeader
          title={catDef.label}
          description="Complete los campos para registrar su requerimiento."
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* ── Left: main fields ── */}
        <div className="md:col-span-2 flex flex-col gap-4">
          <div className="bg-white border border-gray-200 rounded-lg p-6 ">
            <h2 className="text-sm font-semibold text-gray-700 mb-5 flex items-center gap-2">
              <span className="w-1 h-4 bg-[#0047AC] rounded-full" />
              Información General
            </h2>

            <div className="flex flex-col gap-4">
              <Field label="TÍTULO DE LA SOLICITUD" error={errors.title}>
                <input
                  type="text"
                  placeholder="Ej. Reunión Trimestral de Ventas Q3"
                  className={`w-full bg-gray-50 border rounded-md px-3.5 py-2.5 text-sm outline-none
                    focus:border-[#0047AC] focus:ring-2 focus:ring-blue-100 transition-all
                    ${errors.title ? "border-red-400" : "border-gray-200"}`}
                  value={title}
                  onChange={(e) => { setTitle(e.target.value); setErrors((p) => ({ ...p, title: "" })); }}
                />
              </Field>

              <Field label="DESCRIPCIÓN" error={errors.description}>
                <textarea
                  rows={8}
                  placeholder="Describa el propósito y requerimientos..."
                  className={`w-full bg-gray-50 border rounded-md px-3.5 py-2.5 text-sm outline-none
                    focus:border-[#0047AC] focus:ring-2 focus:ring-blue-100 transition-all resize-none
                    ${errors.description ? "border-red-400" : "border-gray-200"}`}
                  value={description}
                  onChange={(e) => { setDescription(e.target.value); setErrors((p) => ({ ...p, description: "" })); }}
                />
              </Field>

            </div>
          </div>

          {formDef && (
            <formDef.Component value={payload} onChange={setPayload} />
          )}
        </div>

        {/* ── Right: meta ── */}
        <div className="flex flex-col gap-4">
          <TicketDetailsPanel
            readOnly={false}
            categoryId={categoryId}
            departmentId={departmentId!}
            priority={priority as TicketPriority}
            onPriorityChange={setPriority}
            canAssign={userCanAssign}
            assigneeUsers={assigneeUsers}
            assignedTo={assignedTo}
            onAssignedToChange={setAssignedTo}
          />

          {createError && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">
              <strong className="block text-xs uppercase tracking-wider mb-1">Error</strong>
              {createError}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={creating}
            className="w-full bg-[#0047AC] text-white py-3 rounded-md font-semibold text-sm hover:bg-blue-700 transition-colors  disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {creating ? "Creando..." : "Crear Ticket"}
          </button>
          <button
            onClick={() => navigate(-1)}
            disabled={creating}
            className="w-full border border-gray-200 text-gray-600 py-3 rounded-md font-semibold text-sm hover:bg-gray-50 transition-colors disabled:opacity-60"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
    </div>
  );
}
