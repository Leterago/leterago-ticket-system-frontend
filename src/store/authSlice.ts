import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";
import type { DepartmentId } from "../types/types";
import { api, ApiError } from "../api/client";

export type UserRole = "master" | "admin" | "participant" | "requester";

export interface AppUser {
  id: string;
  name: string;
  email?: string;
  role: UserRole;
  departments: Array<{ departmentId: DepartmentId; role: "admin" | "participant" | "requester" }>;
  permissions: string[];
  status: "active" | "inactive" | "pending";
  lastAccess: string | null;
  originDepartmentId?: string | null;
}

const STORAGE_KEY = "mesa_auth_user";

function loadUser(): AppUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AppUser) : null;
  } catch {
    return null;
  }
}

interface AuthState {
  currentUser: AppUser | null;
  loginStatus: "idle" | "loading" | "error";
  loginError: string | null;
}

const initialState: AuthState = {
  currentUser: loadUser(),
  loginStatus: "idle",
  loginError: null,
};

export const loginAsync = createAsyncThunk(
  "auth/login",
  async (
    { email, password }: { email: string; password: string },
    { rejectWithValue },
  ) => {
    try {
      return await api.login(email, password);
    } catch (e) {
      return rejectWithValue(e instanceof ApiError ? e.message : "Error de conexión");
    }
  },
);

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setCurrentUser: (state, action: PayloadAction<AppUser | null>) => {
      state.currentUser = action.payload;
      if (action.payload) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(action.payload));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    },
    logout: (state) => {
      state.currentUser = null;
      state.loginStatus = "idle";
      state.loginError = null;
      localStorage.removeItem(STORAGE_KEY);
    },
    clearLoginError: (state) => {
      state.loginError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginAsync.pending, (state) => {
        state.loginStatus = "loading";
        state.loginError = null;
      })
      .addCase(loginAsync.fulfilled, (state, action) => {
        state.loginStatus = "idle";
        state.currentUser = action.payload;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(action.payload));
      })
      .addCase(loginAsync.rejected, (state, action) => {
        state.loginStatus = "error";
        state.loginError = action.payload as string;
      });
  },
});

export const { setCurrentUser, logout, clearLoginError } = authSlice.actions;
export default authSlice.reducer;
