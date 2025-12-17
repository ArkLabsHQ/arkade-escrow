import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import Config from "@/Config.ts";
import Home from "./pages/Home";
import Contracts from "./pages/Contracts";
import ContractDetails from "./pages/ContractDetails";
import NotFound from "./pages/NotFound";
import { DemoModeBanner } from "@/components/DemoModeBanner";

const queryClient = new QueryClient();

const App = () => (
	<QueryClientProvider client={queryClient}>
		<ThemeProvider attribute="class" defaultTheme="system" enableSystem>
			<TooltipProvider>
				<Toaster />
				<Toaster />
				<Sonner />
				<DemoModeBanner />
				<BrowserRouter>
					<Routes>
						<Route path={Config.appRootUrl} element={<Home />} />
						<Route
							path={`${Config.appRootUrl}/contracts`}
							element={<Contracts />}
						/>
						<Route
							path={`${Config.appRootUrl}/contracts/:externalId`}
							element={<ContractDetails />}
						/>
						{/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
						<Route path="*" element={<NotFound />} />
					</Routes>
				</BrowserRouter>
			</TooltipProvider>
		</ThemeProvider>
	</QueryClientProvider>
);

export default App;
