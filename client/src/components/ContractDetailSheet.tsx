import { useState } from "react";
import { Contract } from "@/types/escrow";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "./ui/sheet";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { ArrowDownLeft, ArrowUpRight, Calendar, User, Wallet, Copy, FileText, AlertCircle, XCircle, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { Separator } from "./ui/separator";
import { toast } from "sonner";
import { ContractActionModal } from "./ContractActionModal";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./ui/collapsible";

interface ContractDetailSheetProps {
  contract: Contract | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ContractDetailSheet = ({
  contract,
  open,
  onOpenChange,
}: ContractDetailSheetProps) => {
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [currentAction, setCurrentAction] = useState<"settle" | "approve" | "reject" | "recede" | "dispute">("settle");

  if (!contract) return null;

  const formattedAmount = (contract.amount / 100000000).toFixed(8);
  const formattedFundedAmount = contract.fundedAmount ? (contract.fundedAmount / 100000000).toFixed(8) : null;
  const formattedDate = format(contract.createdAt, "PPP 'at' p");
  const truncatedArkAddress = `${contract.arkAddress.slice(0, 9)}...${contract.arkAddress.slice(-4)}`;
  
  const isFundingMet = contract.fundedAmount ? contract.fundedAmount >= contract.amount : false;
  const fundingDifference = contract.fundedAmount ? contract.fundedAmount - contract.amount : 0;

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(contract.arkAddress);
    toast.success("ARK address copied to clipboard");
  };

  const handleActionClick = (action: typeof currentAction) => {
    setCurrentAction(action);
    setActionModalOpen(true);
  };

  const handleActionConfirm = (data?: { reason?: string }) => {
    const messages = {
      settle: "Settlement initiated successfully",
      approve: "Settlement approved successfully",
      reject: `Contract rejected${data?.reason ? `: ${data.reason}` : ""}`,
      recede: `Receded from contract${data?.reason ? `: ${data.reason}` : ""}`,
      dispute: `Dispute opened${data?.reason ? `: ${data.reason}` : ""}`,
    };
    toast.success(messages[currentAction]);
    onOpenChange(false);
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <SheetTitle className="text-2xl">Contract Details</SheetTitle>
              <p className="text-xs text-muted-foreground mt-1">
                {formattedDate}
              </p>
            </div>
            <div className={`rounded-lg p-2 ${
              contract.side === "receiver" 
                ? "bg-success/10 text-success" 
                : "bg-primary/10 text-primary"
            }`}>
              {contract.side === "receiver" ? (
                <ArrowDownLeft className="h-6 w-6" />
              ) : (
                <ArrowUpRight className="h-6 w-6" />
              )}
            </div>
          </div>
          <SheetDescription className="text-base">
            Review your contract details and transaction information
          </SheetDescription>
        </SheetHeader>

        <div className="mt-8 space-y-6">
          {/* Amount Section */}
          <div className="bg-gradient-shine rounded-xl p-6 border border-border">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm text-muted-foreground mb-1">Requested Amount</p>
                <p className="text-3xl font-bold text-foreground">{formattedAmount} SAT</p>
                
                {(contract.status === "funded" || contract.status === "pending-execution") && formattedFundedAmount && (
                  <div className="mt-4 pt-4 border-t border-border/50">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm text-muted-foreground">Currently Funded</p>
                      <Badge 
                        className={isFundingMet 
                          ? "bg-success/10 text-success border-success/20" 
                          : "bg-warning/10 text-warning border-warning/20"
                        } 
                        variant="outline"
                      >
                        {isFundingMet ? "Requirement Met" : "Partially Funded"}
                      </Badge>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <p className="text-2xl font-bold text-foreground">{formattedFundedAmount} SAT</p>
                      {fundingDifference !== 0 && (
                        <p className={`text-sm ${fundingDifference > 0 ? "text-success" : "text-warning"}`}>
                          {fundingDifference > 0 ? "+" : ""}{(fundingDifference / 100000000).toFixed(8)} SAT
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <Wallet className="h-12 w-12 text-primary opacity-50" />
            </div>
          </div>

          {/* Details Section */}
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Badge className={getStatusColor(contract.status)} variant="outline">
                {contract.status}
              </Badge>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Status</p>
                <p className="text-base font-medium text-foreground capitalize">
                  {contract.status.replace("-", " ")}
                </p>
              </div>
            </div>

            <Separator />

            <div className="flex items-start gap-3">
              <Badge variant={contract.side === "receiver" ? "default" : "secondary"} className="mt-1">
                {contract.side}
              </Badge>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Your Role</p>
                <p className="text-base font-medium text-foreground">
                  You are the {contract.side} in this contract
                </p>
              </div>
            </div>

            <Separator />

            <div className="flex items-start gap-3">
              <User className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Counterparty</p>
                <p className="text-base font-medium text-foreground">{contract.counterparty}</p>
              </div>
            </div>

            <Separator />

            <div className="flex items-start gap-3">
              <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Request ID</p>
                <p className="text-base font-medium text-foreground font-mono">{contract.requestId}</p>
              </div>
            </div>

            <Separator />

            <div>
              <p className="text-sm text-muted-foreground mb-2">Description</p>
              <p className="text-base text-foreground leading-relaxed">
                {contract.description}
              </p>
            </div>

            <Separator />

            <div>
              <p className="text-sm text-muted-foreground mb-2">ARK Address</p>
              <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-3">
                <p className="text-sm font-mono text-foreground flex-1 break-all">
                  {truncatedArkAddress}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyAddress}
                  className="shrink-0"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Past Settlements - Collapsible */}
            {contract.pastSettlements && contract.pastSettlements.length > 0 && (
              <>
                <Separator />
                <Collapsible>
                  <CollapsibleTrigger className="flex items-center justify-between w-full py-2 hover:opacity-70 transition-opacity">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-destructive" />
                      <p className="text-sm font-medium text-foreground">
                        Past Settlement Attempts ({contract.pastSettlements.length})
                      </p>
                    </div>
                    <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-300 data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-3 pt-3 animate-accordion-down">
                    {contract.pastSettlements.map((settlement) => (
                      <div
                        key={settlement.id}
                        className="bg-destructive/5 border border-destructive/20 rounded-lg p-3 space-y-2 animate-fade-in"
                      >
                        <div className="flex items-start gap-2">
                          <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge
                                variant="outline"
                                className="bg-destructive/10 text-destructive border-destructive/20"
                              >
                                {settlement.status}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {format(settlement.initiatedAt, "PPp")}
                              </span>
                            </div>
                            <p className="text-sm text-foreground mt-1">
                              Initiated by <span className="font-medium">{settlement.initiatedBy}</span>
                            </p>
                            {settlement.reason && (
                              <p className="text-xs text-muted-foreground mt-1 italic">
                                "{settlement.reason}"
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              </>
            )}
          </div>

          {/* Actions */}
          <div className="space-y-3 pt-4">
            {/* Draft status: Reject */}
            {contract.status === "draft" && (
              <Button
                variant="destructive"
                className="w-full"
                onClick={() => handleActionClick("reject")}
              >
                Reject Contract
              </Button>
            )}

            {/* Created status: Recede */}
            {contract.status === "created" && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => handleActionClick("recede")}
              >
                Recede from Contract
              </Button>
            )}

            {/* Funded or Pending-execution: Settle/Approve + Dispute */}
            {(contract.status === "funded" || contract.status === "pending-execution") && (
              <>
                <Button
                  className="w-full bg-gradient-primary hover:opacity-90 transition-opacity"
                  onClick={() => handleActionClick(contract.status === "funded" ? "settle" : "approve")}
                >
                  {contract.status === "funded" ? "Settle Contract" : "Approve Settlement"}
                </Button>
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={() => handleActionClick("dispute")}
                >
                  Open Dispute
                </Button>
              </>
            )}

            {/* Close button - always visible */}
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
          </div>
        </div>
      </SheetContent>

      <ContractActionModal
        open={actionModalOpen}
        onOpenChange={setActionModalOpen}
        actionType={currentAction}
        onConfirm={handleActionConfirm}
      />
    </Sheet>
  );
};
