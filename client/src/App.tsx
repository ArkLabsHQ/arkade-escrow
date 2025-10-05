import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import { Notifications } from "./pages/Notifications";
import Requests from "./pages/Requests";
import Contracts from "./pages/Contracts";
import NotFound from "./pages/NotFound";
import { MessageProvider } from "./components/MessageBus/MessageProvider";

const queryClient = new QueryClient();

const App = () => (
	<QueryClientProvider client={queryClient}>
		<MessageProvider allowedChildOrigins={["http://localhost:3003"]}>
			<TooltipProvider>
				<Toaster />
				<Sonner />
				<BrowserRouter>
					<Routes>
						<Route path="/" element={<Index />} />
						<Route path="/notifications" element={<Notifications />} />
						<Route path="/requests" element={<Requests />} />
						<Route path="/contracts" element={<Contracts />} />
						{/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
						<Route path="*" element={<NotFound />} />
					</Routes>
				</BrowserRouter>
			</TooltipProvider>
		</MessageProvider>
	</QueryClientProvider>
);

export default App;
