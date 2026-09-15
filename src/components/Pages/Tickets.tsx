import { useState, useEffect } from "react";
import { Download, Plus, List, LayoutDashboard } from "lucide-react";
import TicketsTable from "../Templates/TicketsTable";
import PageHeader from "../Molecules/PageHeader";
import { useNavigate } from "react-router-dom";
import { useAppSelector, useCurrentUser } from "../../store/hooks";
import { canViewExtended, canSeeAllTickets, viewableDepartmentIds } from "../../store/permissions";
import { getCategoriesForDepartments } from "../../config/catalog";

const Tickets = () => {
  const navigate = useNavigate();
  const { tickets } = useAppSelector((s) => s.tickets);
  const currentUser = useCurrentUser();
  const [viewMode, setViewMode] = useState<"compact" | "extended">(
    () => (localStorage.getItem("mesa_tickets_view") === "extended" ? "extended" : "compact"),
  );

  const isAdminUser = canViewExtended(currentUser);

  // Recuerda en el navegador la última vista elegida (compacta/extendida)
  // para que se mantenga entre recargas y reinicios de sesión.
  useEffect(() => {
    localStorage.setItem("mesa_tickets_view", viewMode);
  }, [viewMode]);

  // Visibilidad por permiso (espejo del backend): ve todo quien tiene view_all;
  // si no, ve los departamentos donde su rol concede view_department, más lo propio.
  const visible = canSeeAllTickets(currentUser)
    ? tickets
    : (() => {
        const cats = getCategoriesForDepartments(viewableDepartmentIds(currentUser));
        return tickets.filter(
          (t) =>
            cats.includes(t.categoryId) ||
            t.createdById === currentUser.id ||
            t.assignedToId === currentUser.id,
        );
      })();

  const handleExport = () => {
    const headers = ["ID", "Título", "Departamento", "Categoría", "Prioridad", "Estado", "Asignado a", "Creado el"];
    const rows = visible.map((t) => [
      t.id, t.title, t.departmentId, t.categoryId, t.priority, t.status, t.assignedTo || "", t.createdAt,
    ]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tickets.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col w-full min-h-screen p-6 gap-5 max-w-[1800px] mx-auto">
      <div className="flex justify-between items-start gap-4 flex-wrap">
        <PageHeader
          title="Tickets"
          description="Visualice y gestione todas las solicitudes del sistema."
        />
        <div className="flex gap-2 shrink-0 items-center">
          {isAdminUser && (
            <div className="flex items-center border border-gray-200 rounded-md overflow-hidden">
              <button
                onClick={() => setViewMode("compact")}
                className={`flex items-center gap-1.5 text-sm px-3 py-2.5 font-semibold transition-colors ${
                  viewMode === "compact"
                    ? "bg-[#0047AC] text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                <List size={14} />
                Compacta
              </button>
              <button
                onClick={() => setViewMode("extended")}
                className={`flex items-center gap-1.5 text-sm px-3 py-2.5 font-semibold transition-colors border-l border-gray-200 ${
                  viewMode === "extended"
                    ? "bg-[#0047AC] text-white border-l-[#0047AC]"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                <LayoutDashboard size={14} />
                Extendida
              </button>
            </div>
          )}
          <button
            className="flex items-center gap-2 bg-white border border-gray-200 text-gray-600 text-sm px-4 py-2.5 rounded-md cursor-pointer font-semibold hover:bg-gray-50 transition-colors"
            onClick={handleExport}
          >
            <Download size={15} />
            Exportar CSV
          </button>
          <button
            className="flex items-center gap-2 bg-[#0047AC] text-white text-sm px-4 py-2.5 rounded-md cursor-pointer font-semibold hover:bg-blue-700 transition-colors"
            onClick={() => navigate("/new-ticket")}
          >
            <Plus size={15} />
            Nuevo Ticket
          </button>
        </div>
      </div>
      <TicketsTable viewMode={isAdminUser ? viewMode : "compact"} />
    </div>
  );
};

export default Tickets;
