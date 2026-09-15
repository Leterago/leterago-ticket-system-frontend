import { useState, useMemo } from "react";
import { ArrowRight, Filter } from "lucide-react";
import PageHeader from "../Molecules/PageHeader";
import { useNavigate } from "react-router-dom";
import { useCurrentUser } from "../../store/hooks";
import { canSeeAllTickets, creatableDepartmentIds } from "../../store/permissions";
import { CATEGORIES, DEPARTMENTS, getCategoriesForDepartments } from "../../config/catalog";
import type { DepartmentId } from "../../types/types";

const ALL_DEPT_IDS = Object.keys(DEPARTMENTS) as DepartmentId[];

export default function CreateTicketPage() {
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
  const [deptFilter, setDeptFilter] = useState<DepartmentId | "all">("all");

  // Categorías de los departamentos donde el usuario puede CREAR (o todos si ve todo).
  // Se deriva del permiso `tickets.create` (global o por-departamento), NO de la lista
  // solo-visual `departments`: un requester GLOBAL no tiene entradas por-departamento y
  // aun así puede crear en todos.
  const userDeptIds: DepartmentId[] = useMemo(
    () => (canSeeAllTickets(currentUser) ? ALL_DEPT_IDS : creatableDepartmentIds(currentUser)),
    [currentUser]
  );

  // Accessible categories based on the departments the user can create in
  const accessibleCategories = useMemo(
    () => getCategoriesForDepartments(userDeptIds),
    [userDeptIds]
  );

  // Apply optional department filter
  const visibleCategories = useMemo(() => {
    if (deptFilter === "all") return accessibleCategories;
    return DEPARTMENTS[deptFilter]?.categories.filter((c) =>
      accessibleCategories.includes(c)
    ) ?? [];
  }, [accessibleCategories, deptFilter]);

  // Departamentos del usuario que tienen categorías hoy (los únicos con algo que crear).
  const deptPillIds = userDeptIds.filter((id) => DEPARTMENTS[id]?.categories.length > 0);

  // Only show dept filter selector if the user has 2+ departments with categories
  const showDeptFilter = deptPillIds.length > 1;

  return (
    <div className="flex flex-col w-full min-h-screen p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Crear Solicitud"
        description="Seleccione el tipo de solicitud para dirigir su requerimiento al equipo correcto."
      />

      {/* Department filter — only visible for multi-dept users */}
      {showDeptFilter && (
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-400">
            <Filter size={13} />
            Filtrar por departamento:
          </div>
          <div className="flex gap-2 flex-wrap">
            <FilterPill
              active={deptFilter === "all"}
              onClick={() => setDeptFilter("all")}
              label="Todos"
            />
            {deptPillIds.map((dId) => (
              <FilterPill
                key={dId}
                active={deptFilter === dId}
                onClick={() => setDeptFilter(dId)}
                label={DEPARTMENTS[dId].label}
              />
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {visibleCategories.map((catId) => {
          const cat = CATEGORIES[catId];
          // Find which department this category belongs to
          const dept = Object.values(DEPARTMENTS).find((d) =>
            d.categories.includes(catId)
          );
          const Icon = cat.icon;

          return (
            <button
              key={catId}
              onClick={() => navigate(`/create-ticket?category=${catId}`)}
              className="group text-left bg-white border border-gray-200 rounded-lg p-6 hover:border-[#0047AC] hover:scale-[1.02] transition-all duration-200 cursor-pointer"
            >
              <div className="flex items-center justify-between gap-4">
                {/* Left: title, description, cta */}
                <div className="flex flex-col flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-gray-900 mb-1.5">
                    {cat.label}
                  </h3>
                  <p className="text-gray-400 text-sm leading-relaxed mb-4">{cat.description}</p>
                  <span className="flex items-center gap-1.5 text-[#0047AC] text-sm font-semibold opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200">
                    Seleccionar
                    <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform duration-200" />
                  </span>
                </div>
                {/* Right: icon top, tag bottom */}
                <div className="flex flex-col items-end justify-between self-stretch shrink-0">
                  <Icon className="w-16 h-16 text-gray-300 dark:text-gray-500 group-hover:text-[#0047AC] dark:group-hover:text-blue-400 transition-colors" />
                  {dept && (
                    <span className="text-[10px] font-bold uppercase tracking-widest text-white bg-[#0047AC] px-2 py-0.5 rounded-md whitespace-nowrap">
                      {dept.label}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FilterPill({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`text-xs font-semibold px-3 py-1.5 rounded-md border transition-all ${
        active
          ? "bg-[#0047AC] text-white border-[#0047AC]"
          : "bg-white text-gray-600 border-gray-200 hover:border-[#0047AC] hover:text-[#0047AC]"
      }`}
    >
      {label}
    </button>
  );
}
