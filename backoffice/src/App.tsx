import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Contracts from "./pages/Contracts";
import ContractDetails from "./pages/ContractDetails";
import NotFound from "./pages/NotFound";
import Config from "@/Config.ts";

const queryClient = new QueryClient();

const App = () => (
	<QueryClientProvider client={queryClient}>
		<TooltipProvider>
			<Toaster />
			<Toaster />
			<Sonner />
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
	</QueryClientProvider>
);

export default App;
