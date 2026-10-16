import { useNavigate, useSearchParams } from "react-router-dom";
import { CirclePlus } from "lucide-react";
import PageHeader from "../Molecules/PageHeader";
import RoomCalendar from "../Organisms/RoomCalendar";
import { useCurrentUser } from "../../store/hooks";
import { creatableDepartmentIds } from "../../store/permissions";
import { getDepartmentForCategory } from "../../config/catalog";

const CATEGORY = "solicitud-reunion";

// Calendario de ocupación de los salones. Quien puede crear reservas elige una
// franja en la rejilla y pasa al formulario con fecha y horas ya rellenas.
export default function RoomCalendarPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const currentUser = useCurrentUser();

  const department = getDepartmentForCategory(CATEGORY);
  const canBook = !!department && creatableDepartmentIds(currentUser).includes(department);
  const focusDate = params.get("fecha") ?? undefined;

  const goToForm = (slot?: { fecha: string; horaDesde: string; horaHasta: string }) => {
    const q = new URLSearchParams({ category: CATEGORY });
    if (slot) {
      q.set("fecha", slot.fecha);
      q.set("desde", slot.horaDesde);
      q.set("hasta", slot.horaHasta);
    }
    navigate(`/create-ticket?${q.toString()}`);
  };

  return (
    <div className="flex flex-col w-full min-h-screen px-6 py-8 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Salones"
          description={
            canBook
              ? "Consulta la ocupación de los salones. Haz clic o arrastra sobre un horario libre para reservarlo."
              : "Consulta la ocupación de los salones."
          }
        />
        {canBook && (
          <button
            onClick={() => goToForm()}
            className="flex items-center gap-2 bg-[#0047AC] text-white px-4 py-2.5 rounded-md text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            <CirclePlus size={16} />
            Nueva reserva
          </button>
        )}
      </div>

      <RoomCalendar
        focusDate={focusDate}
        onSelectSlot={canBook ? goToForm : undefined}
        gridHeight={640}
      />
    </div>
  );
}
