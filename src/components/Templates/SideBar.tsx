import type { ReactNode } from "react";
import { CirclePlus, LayoutDashboard, Ticket, Settings } from "lucide-react";
import Tap from "../Atoms/Tap";
import ThemeToggle from "../Atoms/ThemeToggle";
import { useNavigate, useLocation } from "react-router-dom";
import Logo from "../Atoms/Logo";
import { useCurrentUser } from "../../store/hooks";
import { canViewDashboard } from "../../store/permissions";
import type { AppUser } from "../../store/authSlice";

// Visibilidad por permiso, no por nombre de rol. El Dashboard exige dashboard.view;
// el resto está disponible para cualquier usuario autenticado.
const allTaps: { label: string; path: string; icon: ReactNode; show: (u: AppUser) => boolean }[] = [
  { label: "Dashboard",     path: "/",          icon: <LayoutDashboard size={18} />, show: (u) => canViewDashboard(u) },
  { label: "Tickets",       path: "/tickets",   icon: <Ticket size={18} />,          show: () => true },
  { label: "Nuevo Ticket",  path: "/new-ticket",icon: <CirclePlus size={18} />,      show: () => true },
  { label: "Configuración", path: "/config",    icon: <Settings size={18} />,        show: () => true },
];

const SideBar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const currentUser = useCurrentUser();

  const visibleTaps = allTaps.filter((t) => t.show(currentUser));

  return (
    <div className="w-64 min-h-screen h-full p-4 border-r border-gray-100 bg-white flex flex-col">
      <div className="mb-8 px-2">
        <Logo className="w-32 h-auto" />
      </div>
      <nav className="flex flex-col w-full gap-1">
        {visibleTaps.map((tap) => (
          <Tap
            key={tap.label}
            label={tap.label}
            icon={tap.icon}
            active={location.pathname === tap.path}
            onClick={() => navigate(tap.path)}
          />
        ))}
      </nav>
      <div className="mt-auto pt-3 border-t border-gray-100">
        <ThemeToggle />
      </div>
    </div>
  );
};

export default SideBar;
