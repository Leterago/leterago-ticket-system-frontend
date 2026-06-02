import {
  CircleCheckBig,
  CircleX,
  TriangleAlert,
  Clock,
  CircleDashed,
  BadgeCheck,
} from "lucide-react";

interface BadgeProps {
  variant:
    | "urgent"
    | "high"
    | "medium"
    | "low"
    | "pending"
    | "in_progress"
    | "completed"
    | "confirmed"
    | "canceled";
}

const Badge = ({ variant }: Readonly<BadgeProps>) => {
  const styles = {
    urgent: "priority-badge priority-badge--urgent px-2 py-1 bg-white text-[#ef4444] border-[#ef4444] dark:border-transparent rounded-md font-normal w-20",
    high: "priority-badge priority-badge--high px-2 py-1 bg-white text-[#f97316] border-[#f97316] dark:border-transparent rounded-md font-normal w-20",
    medium: "priority-badge priority-badge--medium px-2 py-1 bg-white text-[#eab308] border-[#eab308] dark:border-transparent rounded-md font-normal w-20",
    low: "priority-badge priority-badge--low px-2 py-1 bg-white text-[#22c55e] border-[#22c55e] dark:border-transparent rounded-md font-normal w-20",
    pending:
      "px-3 py-1 bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/20 rounded-full",
    in_progress:
      "px-3 py-1 bg-[#0047AC]/10 text-[#0047AC] border-[#0047AC]/20 rounded-full",
    completed:
      "px-3 py-1 text-[#10B981] bg-[#10B981]/10 border-[#10B981]/20 rounded-full",
    confirmed:
      "px-3 py-1 text-white bg-[#10B981] border-[#10B981] rounded-full",
    canceled:
      "px-3 py-1 text-[#EF4444] bg-[#EF4444]/10 border-[#EF4444]/20 rounded-full",
  };

  const texts = {
    urgent: "Urgente",
    high: "Alta",
    medium: "Media",
    low: "Baja",
    pending: "Pendiente",
    in_progress: "En progreso",
    completed: "Resuelto",
    confirmed: "Confirmado",
    canceled: "Cancelado",
  };

  const icons = {
    urgent: <TriangleAlert size={14} className="text-[#ef4444]" />,
    high: null,
    medium: null,
    low: null,
    pending: <Clock size={14} />,
    in_progress: <CircleDashed size={14} />,
    completed: <CircleCheckBig size={14} />,
    confirmed: <BadgeCheck size={14} />,
    canceled: <CircleX size={14} />,
  };

  return (
    <div
      className={`flex justify-center items-center gap-1 text-[12px] border h-7 ${styles[variant]}`}
    >
      {icons[variant]} {texts[variant]}
    </div>
  );
};

export default Badge;
