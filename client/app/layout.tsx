import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
	title: "Ark Escrow Demo Host",
	description: "Parent wallet hosting an escrow iframe with postMessage RPC",
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html lang="en">
			<body className="min-h-screen bg-indigo-50 text-slate-900">
				{children}
			</body>
		</html>
	);
}
