"use client";

import { Provider } from "react-redux";

import { store } from "./store";

import "./globals.css";
import { MessageProvider } from "./components/MessageProvider";

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html lang="en" className="bg-amber-50">
			<body className="bg-indigo-50 text-slate-900">
				<Provider store={store}>
					<MessageProvider allowedChildOrigins={["http://localhost:3003"]}>
						{children}
					</MessageProvider>
				</Provider>
			</body>
		</html>
	);
}
