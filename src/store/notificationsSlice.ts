import { createSlice, nanoid, type PayloadAction } from "@reduxjs/toolkit";

export type NotificationKind = "success" | "error" | "info" | "warning";

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  message?: string;
  link?: string;      // optional route opened when the item is clicked in the bell
  createdAt: number;  // epoch ms
  read: boolean;
}

interface NotificationsState {
  items: AppNotification[]; // history (newest first) — feeds the bell
  toasts: string[];         // ids currently shown as floating toasts
}

const MAX_HISTORY = 50;

const initialState: NotificationsState = { items: [], toasts: [] };

const notificationsSlice = createSlice({
  name: "notifications",
  initialState,
  reducers: {
    // Single entry point: pushes to history AND queues a toast.
    notify: {
      reducer(state, action: PayloadAction<AppNotification>) {
        state.items.unshift(action.payload);
        if (state.items.length > MAX_HISTORY) state.items.length = MAX_HISTORY;
        state.toasts.unshift(action.payload.id);
      },
      prepare(input: {
        kind?: NotificationKind;
        title: string;
        message?: string;
        link?: string;
      }) {
        return {
          payload: {
            id: nanoid(),
            kind: input.kind ?? "info",
            title: input.title,
            message: input.message,
            link: input.link,
            createdAt: Date.now(),
            read: false,
          } satisfies AppNotification,
        };
      },
    },
    dismissToast(state, action: PayloadAction<string>) {
      state.toasts = state.toasts.filter((id) => id !== action.payload);
    },
    markAllRead(state) {
      for (const n of state.items) n.read = true;
    },
    markRead(state, action: PayloadAction<string>) {
      const n = state.items.find((x) => x.id === action.payload);
      if (n) n.read = true;
    },
    removeNotification(state, action: PayloadAction<string>) {
      state.items = state.items.filter((n) => n.id !== action.payload);
      state.toasts = state.toasts.filter((id) => id !== action.payload);
    },
    clearAll(state) {
      state.items = [];
      state.toasts = [];
    },
  },
});

export const {
  notify,
  dismissToast,
  markAllRead,
  markRead,
  removeNotification,
  clearAll,
} = notificationsSlice.actions;

export default notificationsSlice.reducer;
