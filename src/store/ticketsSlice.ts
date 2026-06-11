import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import type {
  Ticket,
  TicketStatus,
  TicketPriority,
  DepartmentId,
  CategoryId,
} from "../types/types";
import {
  api,
  ApiError,
  type ServerTicket,
  type UpdateTicketBody,
} from "../api/client";
import type { RootState } from "./store";
import { notify } from "./notificationsSlice";

const STATUS_LABELS: Record<TicketStatus, string> = {
  pending: "Pendiente", in_progress: "En progreso", completed: "Resuelto",
  confirmed: "Confirmado", canceled: "Cancelado",
};
const PRIORITY_LABELS: Record<TicketPriority, string> = {
  urgent: "Urgente", high: "Alta", medium: "Media", low: "Baja",
};

/** Builds a contextual success message by diffing the ticket before/after the update. */
function buildUpdateMessage(
  before: { status?: TicketStatus; priority?: TicketPriority; assignedTo?: string } | undefined,
  next: Ticket,
): { title: string; message?: string } {
  if (before && before.status !== next.status) {
    return { title: `Estado actualizado a "${STATUS_LABELS[next.status]}"`, message: `Ticket ${next.id}` };
  }
  if (before && (before.assignedTo ?? null) !== (next.assignedTo ?? null)) {
    return next.assignedTo
      ? { title: "Ticket asignado satisfactoriamente", message: `Asignado a ${next.assignedTo}` }
      : { title: "Asignación removida", message: `Ticket ${next.id}` };
  }
  if (before && before.priority !== next.priority) {
    return { title: "Prioridad actualizada", message: `${PRIORITY_LABELS[next.priority]} · ${next.id}` };
  }
  return { title: "Ticket actualizado", message: `Ticket ${next.id}` };
}

function adaptServerTicket(t: ServerTicket): Ticket {
  return {
    id: t.id,
    title: t.title,
    description: t.description ?? undefined,
    departmentId: t.departmentId,
    categoryId: t.categoryId,
    status: t.status,
    priority: t.priority,
    createdById: t.createdById,
    createdBy: t.createdBy?.name ?? t.createdById,
    assignedToId: t.assignedToId ?? undefined,
    assignedTo: t.assignedTo?.name ?? undefined,
    executionAt: t.executionAt ?? undefined,
    rating: t.rating ?? undefined,
    payload: t.payload ?? undefined,
    payloadVersion: t.payloadVersion,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

function requireUserId(state: RootState): string {
  const id = state.auth.currentUser?.id;
  if (!id) throw new Error("No current user");
  return id;
}

// ─── Thunks ───────────────────────────────────────────────────────────────────

export const fetchTickets = createAsyncThunk<
  Ticket[],
  void,
  { state: RootState; rejectValue: string }
>("tickets/fetch", async (_, { getState, rejectWithValue }) => {
  try {
    const userId = requireUserId(getState());
    const list = await api.listTickets(userId, { take: 100 });
    return list.items.map(adaptServerTicket);
  } catch (e) {
    return rejectWithValue(e instanceof ApiError ? e.message : "Network error");
  }
});

/** Detail fetch — list endpoint omits payloads for perf, so we re-fetch to hydrate them. */
export const fetchTicketDetailAsync = createAsyncThunk<
  Ticket,
  string,
  { state: RootState; rejectValue: string }
>("tickets/fetchDetail", async (id, { getState, rejectWithValue }) => {
  try {
    const userId = requireUserId(getState());
    const server = await api.getTicket(userId, id);
    return adaptServerTicket(server);
  } catch (e) {
    return rejectWithValue(e instanceof ApiError ? e.message : "Network error");
  }
});

export const createTicketAsync = createAsyncThunk<
  Ticket,
  {
    title: string;
    description: string;
    departmentId: DepartmentId;
    categoryId: CategoryId;
    priority: TicketPriority;
    assignedToId?: string;
    payload?: unknown;
  },
  { state: RootState; rejectValue: string }
>("tickets/create", async (input, { getState, dispatch, rejectWithValue }) => {
  try {
    const userId = requireUserId(getState());
    const server = await api.createTicket(userId, {
      title: input.title,
      description: input.description || undefined,
      departmentId: input.departmentId,
      categoryId: input.categoryId,
      priority: input.priority,
      assignedToId: input.assignedToId || undefined,
      payload: input.payload,
    });
    const next = adaptServerTicket(server);
    dispatch(notify({
      kind: "success",
      title: "Ticket creado",
      message: `${next.id} · ${next.title}`,
      link: `/ticket-detail/${next.id}`,
    }));
    return next;
  } catch (e) {
    const msg = e instanceof ApiError ? e.message : "Network error";
    dispatch(notify({ kind: "error", title: "No se pudo crear el ticket", message: msg }));
    return rejectWithValue(msg);
  }
});

export type UpdateTicketChanges = {
  title?: string;
  description?: string;
  status?: TicketStatus;
  priority?: TicketPriority;
  assignedToId?: string | null;
  executionAt?: string | null;
  payload?: unknown;
};

export const updateTicketAsync = createAsyncThunk<
  Ticket,
  { id: string; changes: UpdateTicketChanges },
  { state: RootState; rejectValue: string }
>("tickets/update", async ({ id, changes }, { getState, dispatch, rejectWithValue }) => {
  // Snapshot the relevant fields before the update so we can describe what changed.
  const prev = getState().tickets.tickets.find((t) => t.id === id);
  const before = prev
    ? { status: prev.status, priority: prev.priority, assignedTo: prev.assignedTo }
    : undefined;
  try {
    const userId = requireUserId(getState());
    const body: UpdateTicketBody = {};
    if (changes.title !== undefined) body.title = changes.title;
    if (changes.description !== undefined) body.description = changes.description;
    if (changes.status !== undefined) body.status = changes.status;
    if (changes.priority !== undefined) body.priority = changes.priority;
    if (changes.assignedToId !== undefined) body.assignedToId = changes.assignedToId;
    if (changes.executionAt !== undefined) body.executionAt = changes.executionAt;
    if (changes.payload !== undefined) body.payload = changes.payload;

    const server = await api.updateTicket(userId, id, body);
    const next = adaptServerTicket(server);
    const { title, message } = buildUpdateMessage(before, next);
    dispatch(notify({ kind: "success", title, message, link: `/ticket-detail/${next.id}` }));
    return next;
  } catch (e) {
    const msg = e instanceof ApiError ? e.message : "Network error";
    dispatch(notify({ kind: "error", title: "No se pudo actualizar el ticket", message: msg }));
    return rejectWithValue(msg);
  }
});

export const rateTicketAsync = createAsyncThunk<
  Ticket,
  { id: string; value: number; comment?: string },
  { state: RootState; rejectValue: string }
>("tickets/rate", async ({ id, value, comment }, { getState, dispatch, rejectWithValue }) => {
  try {
    const userId = requireUserId(getState());
    const server = await api.rateTicket(userId, id, { value, comment: comment?.trim() || null });
    const next = adaptServerTicket(server);
    dispatch(notify({
      kind: "success",
      title: "¡Gracias por tu calificación!",
      message: `Ticket ${next.id}`,
      link: `/ticket-detail/${next.id}`,
    }));
    return next;
  } catch (e) {
    const msg = e instanceof ApiError ? e.message : "Network error";
    dispatch(notify({ kind: "error", title: "No se pudo registrar la calificación", message: msg }));
    return rejectWithValue(msg);
  }
});

export const deleteTicketAsync = createAsyncThunk<
  string,
  string,
  { state: RootState; rejectValue: string }
>("tickets/delete", async (id, { getState, dispatch, rejectWithValue }) => {
  try {
    const userId = requireUserId(getState());
    await api.deleteTicket(userId, id);
    dispatch(notify({ kind: "success", title: "Ticket eliminado", message: `Ticket ${id}` }));
    return id;
  } catch (e) {
    const msg = e instanceof ApiError ? e.message : "Network error";
    dispatch(notify({ kind: "error", title: "No se pudo eliminar el ticket", message: msg }));
    return rejectWithValue(msg);
  }
});

// ─── Slice ────────────────────────────────────────────────────────────────────

interface TicketsState {
  tickets: Ticket[];
  status: "idle" | "loading" | "ready" | "error";
  fetchError: string | null;
  creating: boolean;
  createError: string | null;
  mutationError: string | null;
}

const initialState: TicketsState = {
  tickets: [],
  status: "idle",
  fetchError: null,
  creating: false,
  createError: null,
  mutationError: null,
};

const ticketsSlice = createSlice({
  name: "tickets",
  initialState,
  reducers: {
    clearCreateError: (state) => {
      state.createError = null;
    },
    clearMutationError: (state) => {
      state.mutationError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // fetch
      .addCase(fetchTickets.pending, (state) => {
        state.status = "loading";
        state.fetchError = null;
      })
      .addCase(fetchTickets.fulfilled, (state, action) => {
        state.status = "ready";
        state.tickets = action.payload.map((t) => {
          const prev = state.tickets.find((p) => p.id === t.id);
          if (prev?.payload != null) {
            return { ...t, payload: prev.payload, payloadVersion: prev.payloadVersion };
          }
          return t;
        });
      })
      .addCase(fetchTickets.rejected, (state, action) => {
        state.status = "error";
        state.fetchError = action.payload ?? "Error desconocido";
      })
      // create
      .addCase(createTicketAsync.pending, (state) => {
        state.creating = true;
        state.createError = null;
      })
      .addCase(createTicketAsync.fulfilled, (state, action) => {
        state.creating = false;
        state.tickets.unshift(action.payload);
      })
      .addCase(createTicketAsync.rejected, (state, action) => {
        state.creating = false;
        state.createError = action.payload ?? "Error desconocido";
      })
      // detail
      .addCase(fetchTicketDetailAsync.fulfilled, (state, action) => {
        const idx = state.tickets.findIndex((t) => t.id === action.payload.id);
        if (idx >= 0) state.tickets[idx] = action.payload;
        else state.tickets.unshift(action.payload);
      })
      // update
      .addCase(updateTicketAsync.fulfilled, (state, action) => {
        const idx = state.tickets.findIndex((t) => t.id === action.payload.id);
        if (idx >= 0) state.tickets[idx] = action.payload;
      })
      .addCase(updateTicketAsync.rejected, (state, action) => {
        state.mutationError = action.payload ?? "Error al actualizar";
      })
      // rate
      .addCase(rateTicketAsync.fulfilled, (state, action) => {
        const idx = state.tickets.findIndex((t) => t.id === action.payload.id);
        if (idx >= 0) state.tickets[idx] = action.payload;
        else state.tickets.unshift(action.payload);
      })
      .addCase(rateTicketAsync.rejected, (state, action) => {
        state.mutationError = action.payload ?? "Error al calificar";
      })
      // delete
      .addCase(deleteTicketAsync.fulfilled, (state, action) => {
        state.tickets = state.tickets.filter((t) => t.id !== action.payload);
      })
      .addCase(deleteTicketAsync.rejected, (state, action) => {
        state.mutationError = action.payload ?? "Error al eliminar";
      });
  },
});

export const { clearCreateError, clearMutationError } = ticketsSlice.actions;
export default ticketsSlice.reducer;
