import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import Orderbook from "./pages/Orderbook";
import Requests from "./pages/Requests";
import Contracts from "./pages/Contracts";
import NotFound from "./pages/NotFound";
import Settings from "./pages/Settings";
import { RpcProvider } from "@/components/AppShell/RpcProvider";
import { SessionProvider } from "@/components/SessionProvider";
import Config from "@/Config";
import { useEffect, useState } from "react";
import { SingleKey } from "@arkade-os/sdk";
import Identity from "@/pages/Identity";
import About from "./pages/About";

const queryClient = new QueryClient();

const App = () => {
	const isIframe = window.self !== window.top;
	const rpcProviderProps = isIframe
		? { hosted: true }
		: { identity: SingleKey.fromRandomBytes(), hosted: false };

	return (
		<RpcProvider {...rpcProviderProps}>
			<QueryClientProvider client={queryClient}>
				<SessionProvider>
					<ThemeProvider attribute="class" defaultTheme="system" enableSystem>
						<TooltipProvider>
							<Toaster />
							<Sonner />
							<BrowserRouter>
								<Routes>
									<Route path={Config.appRootUrl} element={<Orderbook />} />
									{/*<Route*/}
									{/*	path={`${Config.appRootUrl}/notifications`}*/}
									{/*	element={<Notifications />}*/}
									{/*/>*/}
									<Route
										path={`${Config.appRootUrl}/requests`}
										element={<Requests />}
									/>
									<Route
										path={`${Config.appRootUrl}/contracts`}
										element={<Contracts />}
									/>
									<Route path="/settings" element={<Settings />} />

									<Route path="/settings/about" element={<About />} />

									<Route path="/settings/identity" element={<Identity />} />
									{/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
									<Route path="*" element={<NotFound />} />
								</Routes>
							</BrowserRouter>
						</TooltipProvider>
					</ThemeProvider>
				</SessionProvider>
			</QueryClientProvider>
		</RpcProvider>
	);
};

export default App;
