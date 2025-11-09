import { Badge } from "@/components/ui/badge";

interface StatusBadgeProps {
  status: string;
  type?: "contract" | "execution" | "dispute";
}

const StatusBadge = ({ status, type = "contract" }: StatusBadgeProps) => {
  const getVariant = () => {
    // Contract statuses
    if (type === "contract") {
      if (["completed"].includes(status)) return "success";
      if (["under-arbitration", "voided-by-arbiter"].includes(status)) return "destructive";
      if (["canceled-by-creator", "rejected-by-counterparty"].includes(status)) return "warning";
      if (["pending-execution", "funded", "created"].includes(status)) return "default";
      return "secondary";
    }
    
    // Execution statuses
    if (type === "execution") {
      if (status === "executed") return "success";
      if (["canceled-by-initiator", "rejected-by-counterparty"].includes(status)) return "destructive";
      return "default";
    }
    
    // Dispute statuses
    if (type === "dispute") {
      if (status === "closed") return "success";
      if (status === "pending") return "warning";
    }
    
    return "secondary";
  };

  return (
    <Badge variant={getVariant()} className="font-normal">
      {status}
    </Badge>
  );
};

export default StatusBadge;
