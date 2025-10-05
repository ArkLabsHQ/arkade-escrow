import { useState, useEffect, useRef, useCallback } from "react";
import { Header } from "@/components/Header";
import { RequestCard } from "@/components/RequestCard";
import { RequestDetailSheet } from "@/components/RequestDetailSheet";
import { mockRequests } from "@/data/mockData";
import { EscrowRequest } from "@/types/escrow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Filter } from "lucide-react";
import { toast } from "sonner";

const ITEMS_PER_PAGE = 10;

const Requests = () => {
  const [selectedRequest, setSelectedRequest] = useState<EscrowRequest | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sideFilter, setSideFilter] = useState<"all" | "sender" | "receiver">("all");
  const [displayedRequests, setDisplayedRequests] = useState<EscrowRequest[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const observerTarget = useRef<HTMLDivElement>(null);

  // Simulate fetching more data
  const loadMoreRequests = useCallback(() => {
    if (isLoading || !hasMore) return;
    
    setIsLoading(true);
    
    // Simulate API call delay
    setTimeout(() => {
      const filteredRequests = mockRequests.filter((request) => {
        const matchesSearch = request.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                             request.creator.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesSide = sideFilter === "all" || request.side === sideFilter;
        return matchesSearch && matchesSide;
      });

      const start = (page - 1) * ITEMS_PER_PAGE;
      const end = start + ITEMS_PER_PAGE;
      const newRequests = filteredRequests.slice(start, end);
      
      if (newRequests.length === 0) {
        setHasMore(false);
      } else {
        setDisplayedRequests((prev) => [...prev, ...newRequests]);
        setPage((prev) => prev + 1);
      }
      
      setIsLoading(false);
    }, 500);
  }, [page, searchQuery, sideFilter, isLoading, hasMore]);

  // Reset pagination when filters change
  useEffect(() => {
    setDisplayedRequests([]);
    setPage(1);
    setHasMore(true);
  }, [searchQuery, sideFilter]);

  // Load initial data
  useEffect(() => {
    if (displayedRequests.length === 0 && hasMore) {
      loadMoreRequests();
    }
  }, [displayedRequests.length, hasMore, loadMoreRequests]);

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          loadMoreRequests();
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [hasMore, isLoading, loadMoreRequests]);

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

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <Header notificationCount={3} />

      <main className="container px-4 py-8 md:px-6">
        {/* Page Header */}
        <div className="mb-6 space-y-2 animate-slide-up">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            My Requests
          </h1>
          <p className="text-muted-foreground">
            Manage and track all your escrow requests
          </p>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row animate-slide-up" style={{ animationDelay: "0.1s" }}>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search requests..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select value={sideFilter} onValueChange={(value: any) => setSideFilter(value)}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Filter by side" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Requests</SelectItem>
              <SelectItem value="sender">Sending</SelectItem>
              <SelectItem value="receiver">Receiving</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Requests List */}
        <div className="space-y-4">
          {displayedRequests.length === 0 && !isLoading && (
            <div className="text-center py-12 text-muted-foreground">
              No requests found
            </div>
          )}
          
          {displayedRequests.map((request, index) => (
            <div 
              key={`${request.id}-${index}`}
              className="animate-slide-up"
              style={{ animationDelay: `${0.05 * (index % 10)}s` }}
            >
              <RequestCard
                request={request}
                onClick={() => handleRequestClick(request)}
              />
            </div>
          ))}

          {/* Loading indicator */}
          {isLoading && (
            <div className="text-center py-8">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
            </div>
          )}

          {/* Infinite scroll trigger */}
          <div ref={observerTarget} className="h-4" />

          {/* End of list message */}
          {!hasMore && displayedRequests.length > 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No more requests to load
            </div>
          )}
        </div>
      </main>

      <RequestDetailSheet
        request={selectedRequest}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onCreateContract={handleCreateContract}
      />
    </div>
  );
};

export default Requests;
