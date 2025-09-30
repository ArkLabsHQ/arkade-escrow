import { configureStore } from "@reduxjs/toolkit";
import appReducer from "./orderbook/slice";
import { api as orderBookApi } from "./orderbook/api";
import { api as accountApi } from "./account/api";

export const store = configureStore({
	reducer: {
		app: appReducer,
		[orderBookApi.reducerPath]: orderBookApi.reducer,
		[accountApi.reducerPath]: accountApi.reducer,
	},
	middleware: (getDefaultMiddleware) =>
		getDefaultMiddleware().concat(
			orderBookApi.middleware,
			accountApi.middleware,
		),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
