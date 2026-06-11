import { configureStore } from "@reduxjs/toolkit";
import ticketsReducer from "./ticketsSlice";
import authReducer from "./authSlice";
import usersReducer from "./usersSlice";
import notificationsReducer from "./notificationsSlice";

export const store = configureStore({
  reducer: {
    tickets: ticketsReducer,
    auth: authReducer,
    users: usersReducer,
    notifications: notificationsReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
