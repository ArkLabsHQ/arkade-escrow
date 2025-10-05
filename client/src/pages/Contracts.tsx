import { useState, useEffect, useRef, useCallback } from "react";
import { Header } from "@/components/Header";
import { ContractCard } from "@/components/ContractCard";
import { ContractDetailSheet } from "@/components/ContractDetailSheet";
import { mockContracts } from "@/data/mockData";
import { Contract } from "@/types/escrow";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Filter } from "lucide-react";

const ITEMS_PER_PAGE = 10;

const Contracts = () => {
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [requestIdFilter, setRequestIdFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | Contract["status"]>("all");
  const [sideFilter, setSideFilter] = useState<"all" | "sender" | "receiver">("all");
  const [displayedContracts, setDisplayedContracts] = useState<Contract[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const observerTarget = useRef<HTMLDivElement>(null);

  // Simulate fetching more data
  const loadMoreContracts = useCallback(() => {
    if (isLoading || !hasMore) return;
    
    setIsLoading(true);
    
    // Simulate API call delay
    setTimeout(() => {
      const filteredContracts = mockContracts.filter((contract) => {
        const matchesRequestId = !requestIdFilter || contract.requestId.includes(requestIdFilter);
        const matchesStatus = statusFilter === "all" || contract.status === statusFilter;
        const matchesSide = sideFilter === "all" || contract.side === sideFilter;
        return matchesRequestId && matchesStatus && matchesSide;
      });

      const start = (page - 1) * ITEMS_PER_PAGE;
      const end = start + ITEMS_PER_PAGE;
      const newContracts = filteredContracts.slice(start, end);
      
      if (newContracts.length === 0) {
        setHasMore(false);
      } else {
        setDisplayedContracts((prev) => [...prev, ...newContracts]);
        setPage((prev) => prev + 1);
      }
      
      setIsLoading(false);
    }, 500);
  }, [page, requestIdFilter, statusFilter, sideFilter, isLoading, hasMore]);

  // Reset pagination when filters change
  useEffect(() => {
    setDisplayedContracts([]);
    setPage(1);
    setHasMore(true);
  }, [requestIdFilter, statusFilter, sideFilter]);

  // Load initial data
  useEffect(() => {
    if (displayedContracts.length === 0 && hasMore) {
      loadMoreContracts();
    }
  }, [displayedContracts.length, hasMore, loadMoreContracts]);

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          loadMoreContracts();
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
  }, [hasMore, isLoading, loadMoreContracts]);

  const handleContractClick = (contract: Contract) => {
    setSelectedContract(contract);
    setSheetOpen(true);
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <Header notificationCount={3} />

      <main className="container px-4 py-8 md:px-6">
        {/* Page Header */}
        <div className="mb-6 space-y-2 animate-slide-up">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            My Contracts
          </h1>
          <p className="text-muted-foreground">
            View and manage all your escrow contracts
          </p>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-col gap-4 animate-slide-up" style={{ animationDelay: "0.1s" }}>
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by request ID..."
                value={requestIdFilter}
                onChange={(e) => setRequestIdFilter(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="created">Created</SelectItem>
                <SelectItem value="funded">Funded</SelectItem>
                <SelectItem value="pending-execution">Pending Execution</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="canceled">Canceled</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sideFilter} onValueChange={(value: any) => setSideFilter(value)}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Filter by side" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sides</SelectItem>
                <SelectItem value="sender">Sending</SelectItem>
                <SelectItem value="receiver">Receiving</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Contracts List */}
        <div className="space-y-4">
          {displayedContracts.length === 0 && !isLoading && (
            <div className="text-center py-12 text-muted-foreground">
              No contracts found
            </div>
          )}
          
          {displayedContracts.map((contract, index) => (
            <div 
              key={`${contract.id}-${index}`}
              className="animate-slide-up"
              style={{ animationDelay: `${0.05 * (index % 10)}s` }}
            >
              <ContractCard
                contract={contract}
                onClick={() => handleContractClick(contract)}
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
          {!hasMore && displayedContracts.length > 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No more contracts to load
            </div>
          )}
        </div>
      </main>

      <ContractDetailSheet
        contract={selectedContract}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </div>
  );
};

export default Contracts;
