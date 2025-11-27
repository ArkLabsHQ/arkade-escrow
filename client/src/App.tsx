import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import Index from "./pages/Index";
import Requests from "./pages/Requests";
import Contracts from "./pages/Contracts";
import NotFound from "./pages/NotFound";
import { MessageProvider } from "./components/MessageBus";
import { SessionProvider } from "@/components/SessionProvider";
import Config from "@/Config";

const queryClient = new QueryClient();

const App = () => (
	<QueryClientProvider client={queryClient}>
		<MessageProvider allowedChildOrigins={Config.hostUrls}>
			<SessionProvider>
				<ThemeProvider attribute="class" defaultTheme="system" enableSystem>
					<TooltipProvider>
						<Toaster />
						<Sonner />
						<BrowserRouter>
							<Routes>
								<Route path={Config.appRootUrl} element={<Index />} />
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
								{/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
								<Route path="*" element={<NotFound />} />
							</Routes>
						</BrowserRouter>
					</TooltipProvider>
				</ThemeProvider>
			</SessionProvider>
		</MessageProvider>
	</QueryClientProvider>
);

export default App;
