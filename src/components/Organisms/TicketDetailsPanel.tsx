import { TrendingDown, Minus, TrendingUp, TriangleAlert } from "lucide-react";
import type { CategoryId, DepartmentId, TicketPriority } from "../../types/types";
import { CATEGORIES, DEPARTMENTS } from "../../config/catalog";
import AssigneePicker, { type User as AssigneeUser } from "./AssigneePicker";
import { getInitials } from "../../lib/initials";
import { formatDateTime } from "../../lib/formatDate";

const priorityOptions = [
  { value: "urgent" as TicketPriority, label: "Urgente", icon: <TriangleAlert size={13} />, sla: "1–2 horas" },
  { value: "high"   as TicketPriority, label: "Alta",    icon: <TrendingUp size={13} />,    sla: "12–24 horas" },
  { value: "medium" as TicketPriority, label: "Media",   icon: <Minus size={13} />,         sla: "2–4 días" },
  { value: "low"    as TicketPriority, label: "Baja",    icon: <TrendingDown size={13} />,  sla: "4–7 días" },
];

const deptLabels: Record<string, string> = {
  "compras": "Compras",
  "servicios-generales": "Servicios Generales",
  "mantenimiento-seguridad": "Mantenimiento y Seguridad",
};

type ReadOnlyProps = {
  readOnly: true;
  categoryId: CategoryId;
  departmentId: DepartmentId;
  createdBy: string;
  assignedToName?: string;
  assignedToId?: string | null;
  currentUserId?: string;
  createdAt?: string;
  updatedAt?: string;
};

type EditProps = {
  readOnly: false;
  categoryId: CategoryId;
  departmentId: DepartmentId;
  priority: TicketPriority;
  onPriorityChange: (p: TicketPriority) => void;
  canAssign: boolean;
  assigneeUsers: AssigneeUser[];
  assignedTo: AssigneeUser | null;
  onAssignedToChange: (u: AssigneeUser | null) => void;
};

type Props = ReadOnlyProps | EditProps;

export default function TicketDetailsPanel(props: Props) {
  const cat  = CATEGORIES[props.categoryId];
  const dept = DEPARTMENTS[props.departmentId];
  const Icon = cat?.icon;

  return (
    <div className="bg-white border border-gray-300 rounded-lg p-6 flex flex-col gap-5">
      <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
        <span className="w-1 h-4 bg-[#0047AC] rounded-full" />
        Detalles del Ticket
      </h2>

      <Field label="CATEGORÍA">
        <div className={`flex items-center gap-2.5 ${cat?.iconBg ?? "bg-gray-50"} dark:bg-[#2d3f55] border border-gray-300 dark:border-gray-600 rounded-md px-3.5 py-2.5`}>
          {Icon && <Icon className={`w-4 h-4 ${cat.iconColor} shrink-0`} />}
          <span className="text-sm font-semibold text-gray-800">{cat?.label ?? props.categoryId}</span>
        </div>
      </Field>

      <Field label="DEPARTAMENTO">
        <div className="bg-gray-50 border border-gray-300 rounded-md px-3.5 py-2.5 text-sm text-gray-600 font-medium">
          {dept?.label ?? deptLabels[props.departmentId] ?? props.departmentId}
        </div>
      </Field>

      {props.readOnly && (
        <Field label="CREADO POR">
          <UserChip name={props.createdBy} />
        </Field>
      )}

      {props.readOnly ? (
        <>
          <Field label="ASIGNADO A">
            {props.assignedToName
              ? <UserChip name={props.assignedToName} badge={props.assignedToId != null && props.assignedToId === props.currentUserId ? "Tú" : undefined} />
              : <p className="text-gray-400 italic text-sm">Sin asignar</p>
            }
          </Field>

          {props.createdAt && (
            <Field label="CREADO EL">
              <p className="text-sm font-medium text-gray-800">{formatDateTime(props.createdAt)}</p>
            </Field>
          )}

          {props.updatedAt && (
            <Field label="ACTUALIZADO">
              <p className="text-sm font-medium text-gray-800">{formatDateTime(props.updatedAt)}</p>
            </Field>
          )}
        </>
      ) : (
        props.canAssign && (
          <Field label="ASIGNADO A">
            <AssigneePicker
              users={props.assigneeUsers}
              value={props.assignedTo}
              onChange={props.onAssignedToChange}
              width="w-full"
            />
          </Field>
        )
      )}

      {!props.readOnly && (
        <>
          <Field label="PRIORIDAD">
            <div className="flex flex-col gap-1.5">
              {priorityOptions.map((p) => {
                const selected = props.priority === p.value;
                const urgentColor = p.value === "urgent" ? "text-[#ef4444]" : "text-[#777777]";
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => props.onPriorityChange(p.value)}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-md border text-xs font-normal transition-all cursor-pointer
                      ${selected
                        ? "bg-[#0047AC]/10 border-[#0047AC] text-[#0047AC]"
                        : `bg-white border-gray-300 ${urgentColor} hover:border-gray-300 hover:bg-gray-50`
                      }`}
                  >
                    <span className="flex items-center gap-1.5">{p.icon}{p.label}</span>
                    <span className={`text-[11px] ${selected ? "text-[#0047AC]/70" : "text-gray-400"}`}>{p.sla}</span>
                  </button>
                );
              })}
            </div>
          </Field>
        </>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}

function UserChip({ name, badge }: { name: string; badge?: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-7 h-7 rounded-full bg-blue-100 text-[#0047AC] text-[10px] font-bold flex items-center justify-center shrink-0">
        {getInitials(name)}
      </div>
      <p className="text-sm font-semibold text-gray-800 leading-tight">{name}</p>
      {badge && (
        <span className="ml-auto text-[9px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-md">
          {badge}
        </span>
      )}
    </div>
  );
}
