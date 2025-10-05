"use client";

import Orderbook from "./orderbook/view";
import AccountBadge from "./components/AccountBadge";
import Header from "./components/Header";
import { store } from "./store";
import { Provider } from "react-redux";

export default function Page() {
	return (
		<main className="p-6">
			<Header title="Orderbook" />
			<Orderbook />
		</main>
	);
}
