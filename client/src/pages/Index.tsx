import { useState } from "react";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Header } from "@/components/Header";
import { RequestCard } from "@/components/RequestCard";
import { RequestDetailSheet } from "@/components/RequestDetailSheet";
import { NewRequestSheet } from "@/components/NewRequestSheet";
import { mockRequests } from "@/data/mockData";
import { EscrowRequest } from "@/types/escrow";
import { Button } from "@/components/ui/button";
import { FileText, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

const Index = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<EscrowRequest | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [newRequestOpen, setNewRequestOpen] = useState(false);

  const handleRequestClick = (request: EscrowRequest) => {
    setSelectedRequest(request);
    setSheetOpen(true);
  };

  const handleCreateContract = (requestId: string) => {
    toast.success("Contract created successfully!", {
      description: "You can now view and manage your contract.",
    });
    console.log("Creating contract for request:", requestId);
  };

  const handleNewRequest = (data: any) => {
    console.log("New request data:", data);
    // In production, this would create the request via API
  };

  if (isLoading) {
    return <LoadingScreen onLoadComplete={() => setIsLoading(false)} />;
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <Header notificationCount={3} />

      <main className="container px-4 py-8 md:px-6">
        {/* Quick Actions */}
        <div className="mb-8 flex gap-3 animate-slide-up">
          <Link to="/requests">
            <Button 
              variant="outline" 
              className="gap-2"
            >
              <FileText className="h-4 w-4" />
              My Requests
            </Button>
          </Link>
          <Link to="/contracts">
            <Button 
              variant="outline" 
              className="gap-2"
            >
              <FileText className="h-4 w-4" />
              My Contracts
            </Button>
          </Link>
          <Button 
            className="gap-2 bg-gradient-primary hover:opacity-90 transition-opacity"
            onClick={() => setNewRequestOpen(true)}
          >
            <Plus className="h-4 w-4" />
            New Request
          </Button>
        </div>

        {/* Requests List */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">Orderbook</h2>
          
          <div className="grid gap-4">
            {mockRequests.map((request, index) => (
              <div 
                key={request.id}
                className="animate-slide-up"
                style={{ animationDelay: `${0.2 + index * 0.05}s` }}
              >
                <RequestCard
                  request={request}
                  onClick={() => handleRequestClick(request)}
                />
              </div>
            ))}
          </div>
        </div>
      </main>

      <RequestDetailSheet
        request={selectedRequest}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onCreateContract={handleCreateContract}
      />

      <NewRequestSheet
        open={newRequestOpen}
        onOpenChange={setNewRequestOpen}
        onSubmit={handleNewRequest}
      />
    </div>
  );
};

export default Index;
