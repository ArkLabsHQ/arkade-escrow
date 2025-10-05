import { EscrowRequest } from "@/types/escrow";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "./ui/sheet";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { ArrowDownLeft, ArrowUpRight, Calendar, User, Wallet } from "lucide-react";
import { format } from "date-fns";
import { Separator } from "./ui/separator";

interface RequestDetailSheetProps {
  request: EscrowRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateContract: (requestId: string) => void;
}

export const RequestDetailSheet = ({
  request,
  open,
  onOpenChange,
  onCreateContract,
}: RequestDetailSheetProps) => {
  if (!request) return null;

  const formattedAmount = (request.amount / 100000000).toFixed(8);
  const formattedDate = format(request.createdAt, "PPP 'at' p");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <SheetTitle className="text-2xl">Request Details</SheetTitle>
              <p className="text-xs text-muted-foreground mt-1">
                {formattedDate}
              </p>
            </div>
            <div className={`rounded-lg p-2 ${
              request.side === "receiver" 
                ? "bg-success/10 text-success" 
                : "bg-primary/10 text-primary"
            }`}>
              {request.side === "receiver" ? (
                <ArrowDownLeft className="h-6 w-6" />
              ) : (
                <ArrowUpRight className="h-6 w-6" />
              )}
            </div>
          </div>
          <SheetDescription className="text-base">
            Review the escrow request details before creating a contract
          </SheetDescription>
        </SheetHeader>

        <div className="mt-8 space-y-6">
          {/* Amount Section */}
          <div className="bg-gradient-shine rounded-xl p-6 border border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Amount</p>
                <p className="text-4xl font-bold text-foreground">{formattedAmount}</p>
                <p className="text-sm text-muted-foreground mt-1">SAT</p>
              </div>
              <Wallet className="h-12 w-12 text-primary opacity-50" />
            </div>
          </div>

          {/* Details Section */}
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Badge variant={request.side === "receiver" ? "default" : "secondary"} className="mt-1">
                {request.side}
              </Badge>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Your Role</p>
                <p className="text-base font-medium text-foreground">
                  You are the {request.side} in this escrow
                </p>
              </div>
            </div>

            <Separator />

            <div className="flex items-start gap-3">
              <User className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Created by</p>
                <p className="text-base font-medium text-foreground">{request.creator}</p>
              </div>
            </div>

            <Separator />

            <div>
              <p className="text-sm text-muted-foreground mb-2">Description</p>
              <p className="text-base text-foreground leading-relaxed">
                {request.description}
              </p>
            </div>

            <Separator />

            <div>
              <p className="text-sm text-muted-foreground mb-2">Status</p>
              <Badge variant="outline">{request.status}</Badge>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-gradient-primary hover:opacity-90 transition-opacity"
              onClick={() => {
                onCreateContract(request.id);
                onOpenChange(false);
              }}
            >
              Create Contract
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
