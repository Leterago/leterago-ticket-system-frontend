import { useDispatch, useSelector } from "react-redux";
import type { RootState, AppDispatch } from "./store";
import type { AppUser } from "./authSlice";

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector = <T>(selector: (state: RootState) => T): T =>
  useSelector(selector);

/** Use inside the authenticated tree — assumes the bootstrap has populated currentUser. */
export function useCurrentUser(): AppUser {
  const user = useAppSelector((s) => s.auth.currentUser);
  if (!user) {
    throw new Error("useCurrentUser called before bootstrap completed");
  }
  return user;
}

/**
 * Returns true if the current user has ALL of the given app-level permission codes.
 * Por permiso, sin caso especial por nombre de rol.
 */
export function usePermission(...codes: string[]): boolean {
  const user = useAppSelector((s) => s.auth.currentUser);
  if (!user) return false;
  const perms = user.permissions ?? [];
  return codes.every((code) => perms.includes(code));
}
