import { Contract } from "@/types/escrow";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { ArrowDownLeft, ArrowUpRight, Calendar, User, Copy } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface ContractCardProps {
  contract: Contract;
  onClick: () => void;
}

export const ContractCard = ({ contract, onClick }: ContractCardProps) => {
  const formattedAmount = (contract.amount / 100000000).toFixed(8);
  const formattedDate = format(contract.createdAt, "MMM dd, yyyy");
  
  const truncatedArkAddress = `${contract.arkAddress.slice(0, 9)}...${contract.arkAddress.slice(-4)}`;

  const handleCopyAddress = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(contract.arkAddress);
    toast.success("ARK address copied to clipboard");
  };

  const getStatusColor = (status: Contract["status"]) => {
    switch (status) {
      case "completed":
        return "bg-success/10 text-success border-success/20";
      case "funded":
      case "pending-execution":
        return "bg-primary/10 text-primary border-primary/20";
      case "created":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "draft":
        return "bg-muted-foreground/10 text-muted-foreground border-muted-foreground/20";
      case "canceled":
        return "bg-destructive/10 text-destructive border-destructive/20";
      default:
        return "bg-muted-foreground/10 text-muted-foreground border-muted-foreground/20";
    }
  };

  return (
    <Card
      className="p-6 cursor-pointer transition-all hover:shadow-elegant hover:-translate-y-0.5 border-border bg-card"
      onClick={onClick}
    >
      <div className="flex flex-col gap-4">
        {/* Header Row */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`rounded-lg p-2 ${
              contract.side === "receiver" 
                ? "bg-success/10 text-success" 
                : "bg-primary/10 text-primary"
            }`}>
              {contract.side === "receiver" ? (
                <ArrowDownLeft className="h-5 w-5" />
              ) : (
                <ArrowUpRight className="h-5 w-5" />
              )}
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">
                  {contract.side === "receiver" ? "Receiving from" : "Sending to"}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium text-foreground">{contract.counterparty}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge className={getStatusColor(contract.status)}>
              {contract.status}
            </Badge>
            <div className="text-right">
              <p className="text-lg font-bold text-foreground">{formattedAmount} SAT</p>
            </div>
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground line-clamp-2">
          {contract.description}
        </p>

        {/* Footer Row */}
        <div className="flex items-center justify-between gap-4 pt-2 border-t border-border">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            <span>{formattedDate}</span>
          </div>
          <button
            onClick={handleCopyAddress}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors group"
          >
            <span className="font-mono">{truncatedArkAddress}</span>
            <Copy className="h-3.5 w-3.5 group-hover:scale-110 transition-transform" />
          </button>
        </div>
      </div>
    </Card>
  );
};
