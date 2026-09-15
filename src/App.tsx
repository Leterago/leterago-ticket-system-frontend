import { useEffect } from "react";
import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";
import "./App.css";
import RootTemplate from "./components/Layouts/RootTemplate";
import LoginPage from "./components/Pages/LoginPage";
import RegisterPage from "./components/Pages/RegisterPage";
import ForgotPasswordPage from "./components/Pages/ForgotPasswordPage";
import CreateTicketPage from "./components/Pages/CreateTicketPage";
import NewTicketFormPage from "./components/Pages/NewTicketFormPage";
import Tickets from "./components/Pages/Tickets";
import DashboardPage from "./components/Pages/DashboardPage";
import TicketDetail from "./components/Pages/TicketDetailPage";
import ConfigPage from "./components/Pages/ConfigPage";
import { useAppDispatch, useAppSelector } from "./store/hooks";
import { fetchUsers } from "./store/usersSlice";
import { fetchTickets } from "./store/ticketsSlice";
import { setCurrentUser } from "./store/authSlice";
import { canViewDashboard } from "./store/permissions";

function AppRoutes() {
  const currentUser = useAppSelector((s) => s.auth.currentUser);
  // El dashboard se gatea por permiso (dashboard.view), no por nombre de rol.
  const isRestricted = currentUser ? !canViewDashboard(currentUser) : true;

  const router = createBrowserRouter([
    {
      path: "/login",
      element: currentUser ? <Navigate to="/" replace /> : <LoginPage />,
    },
    {
      path: "/register",
      element: currentUser ? <Navigate to="/" replace /> : <RegisterPage />,
    },
    {
      path: "/forgot-password",
      element: currentUser ? <Navigate to="/" replace /> : <ForgotPasswordPage />,
    },
    {
      path: "/",
      element: currentUser ? <RootTemplate /> : <Navigate to="/login" replace />,
      children: [
        { path: "/",                  element: isRestricted ? <Navigate to="/tickets" replace /> : <DashboardPage /> },
        { path: "/tickets",           element: <Tickets /> },
        { path: "/new-ticket",        element: <CreateTicketPage /> },
        { path: "/create-ticket",     element: <NewTicketFormPage /> },
        { path: "/ticket-detail/:id", element: <TicketDetail /> },
        { path: "/ticket-detail",     element: <TicketDetail /> },
        { path: "/config",            element: <ConfigPage /> },
      ],
    },
    { path: "*", element: <Navigate to={currentUser ? "/" : "/login"} replace /> },
  ]);

  return (
    <div className="w-full h-screen text-gray-900">
      <RouterProvider router={router} />
    </div>
  );
}

function LoadingScreen({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center w-full h-screen bg-white text-gray-500 gap-3">
      <div className="w-8 h-8 border-2 border-blue-200 border-t-[#0047AC] rounded-full animate-spin" />
      <p className="text-sm font-semibold">{message}</p>
    </div>
  );
}

function ErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center w-full h-screen bg-white text-gray-700 gap-3 p-6">
      <p className="text-base font-bold">No se pudo conectar con el servidor</p>
      <p className="text-sm text-gray-500 max-w-md text-center">{message}</p>
      <button
        onClick={onRetry}
        className="mt-2 bg-[#0047AC] text-white px-4 py-2 rounded-md text-sm font-semibold hover:bg-blue-700"
      >
        Reintentar
      </button>
    </div>
  );
}

function AppBootstrap() {
  const dispatch     = useAppDispatch();
  const currentUser  = useAppSelector((s) => s.auth.currentUser);
  const usersStatus  = useAppSelector((s) => s.users.status);
  const usersError   = useAppSelector((s) => s.users.error);
  const users        = useAppSelector((s) => s.users.list);

  useEffect(() => {
    if (currentUser?.id) {
      dispatch(fetchUsers());
    }
  }, [dispatch, currentUser?.id]);

  useEffect(() => {
    if (currentUser) dispatch(fetchTickets());
  }, [dispatch, currentUser?.id]);

  // Auto-reparación: tras cargar la lista (autoritativa), refresca los permisos
  // resueltos del usuario logueado. Sana sesiones guardadas con forma vieja tras un
  // despliegue, sin obligar a re-login.
  useEffect(() => {
    if (!currentUser || usersStatus !== "ready") return;
    const fresh = users.find((u) => u.id === currentUser.id);
    if (!fresh) return;
    const stale =
      JSON.stringify(fresh.permissions) !== JSON.stringify(currentUser.permissions) ||
      JSON.stringify(fresh.globalPermissions) !== JSON.stringify(currentUser.globalPermissions) ||
      JSON.stringify(fresh.deptPermissions) !== JSON.stringify(currentUser.deptPermissions);
    if (stale) dispatch(setCurrentUser({ ...currentUser, ...fresh }));
  }, [dispatch, usersStatus, users, currentUser]);

  // No session → go straight to login routes
  if (!currentUser) return <AppRoutes />;

  if (usersStatus === "error") {
    return (
      <ErrorScreen
        message={usersError ?? "Error desconocido"}
        onRetry={() => dispatch(fetchUsers())}
      />
    );
  }

  if (usersStatus !== "ready") {
    return <LoadingScreen message="Cargando..." />;
  }

  return <AppRoutes />;
}

export default function App() {
  return <AppBootstrap />;
}
