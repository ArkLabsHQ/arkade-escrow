import { CheckCircle2, Circle, XCircle, AlertCircle, Bitcoin, Handshake, Play } from "lucide-react";

interface TimelineEvent {
  label: string;
  timestamp: number;
  type: "created" | "accepted" | "canceled" | "funded" | "execution" | "completed" | "disputed";
}

interface ContractTimelineProps {
  events: TimelineEvent[];
}

const ContractTimeline = ({ events }: ContractTimelineProps) => {
  const sortedEvents = [...events].sort((a, b) => a.timestamp - b.timestamp);

  const getIcon = (type: string) => {
    switch (type) {
      case "completed":
        return <CheckCircle2 className="h-5 w-5 text-success" />;
      case "canceled":
        return <XCircle className="h-5 w-5 text-destructive" />;
      case "disputed":
        return <AlertCircle className="h-5 w-5 text-warning" />;
      case "funded":
        return <Bitcoin className="h-5 w-5 text-warning" />;
      case "accepted":
        return <Handshake className="h-5 w-5 text-primary" />;
      case "execution":
        return <Play className="h-5 w-5 text-primary" />;
      default:
        return <Circle className="h-5 w-5 text-primary" />;
    }
  };

  const formatDateTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="relative">
      <div className="absolute left-[9px] top-2 bottom-2 w-0.5 bg-border" />
      <div className="space-y-6">
        {sortedEvents.map((event, index) => (
          <div key={index} className="relative flex gap-3">
            <div className="relative z-10 bg-background">{getIcon(event.type)}</div>
            <div className="flex-1 pt-0.5">
              <p className="font-medium text-foreground">{event.label}</p>
              <p className="text-sm text-muted-foreground">{formatDateTime(event.timestamp)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ContractTimeline;
