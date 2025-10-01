import { configureStore } from "@reduxjs/toolkit";
import appReducer from "./orderbook/slice";
import { api as orderBookApi } from "./orderbook/api";
import { api as accountApi } from "./account/api";
import { api as contractsApi } from "./contracts/api";

export const store = configureStore({
	reducer: {
		[orderBookApi.reducerPath]: orderBookApi.reducer,
		[accountApi.reducerPath]: accountApi.reducer,
		[contractsApi.reducerPath]: contractsApi.reducer,
	},
	middleware: (getDefaultMiddleware) =>
		getDefaultMiddleware().concat(
			orderBookApi.middleware,
			accountApi.middleware,
			contractsApi.middleware,
		),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
