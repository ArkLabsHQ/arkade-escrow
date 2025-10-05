import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { OrderbookItemDto } from "./api";

type AppState = {
	isLoading: boolean;
	isPristine: boolean;
	items: OrderbookItemDto[];
	cursor: string | null;
};

const initialState: AppState = {
	isLoading: false,
	isPristine: true,
	items: [],
	cursor: null,
};

const appSlice = createSlice({
	name: "orderbook",
	initialState,
	reducers: {
		fetchNextPage(state, action: PayloadAction<void>) {
			// TODO
		},
	},
});

export const { fetchNextPage } = appSlice.actions;
export default appSlice.reducer;
