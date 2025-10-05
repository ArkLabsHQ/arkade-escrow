import { Header } from "@/components/Header";
import { mockNotifications } from "@/data/mockData";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  CheckCircle2, 
  FileCheck, 
  AlertCircle, 
  DollarSign, 
  XCircle,
  Clock
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { NotificationType } from "@/types/escrow";

const notificationIcons: Record<NotificationType, React.ReactNode> = {
  approve_contract: <FileCheck className="h-5 w-5" />,
  settle_transaction: <DollarSign className="h-5 w-5" />,
  new_settlement: <CheckCircle2 className="h-5 w-5" />,
  contract_funded: <DollarSign className="h-5 w-5" />,
  contract_rejected: <XCircle className="h-5 w-5" />,
  dispute: <AlertCircle className="h-5 w-5" />,
};

const notificationColors: Record<NotificationType, string> = {
  approve_contract: "bg-primary/10 text-primary",
  settle_transaction: "bg-success/10 text-success",
  new_settlement: "bg-success/10 text-success",
  contract_funded: "bg-success/10 text-success",
  contract_rejected: "bg-destructive/10 text-destructive",
  dispute: "bg-destructive/10 text-destructive",
};

export const Notifications = () => {
  return (
    <div className="min-h-screen bg-gradient-subtle">
      <Header notificationCount={mockNotifications.filter(n => !n.read).length} />

      <main className="container px-4 py-8 md:px-6">
        <div className="mb-8 space-y-2 animate-slide-up">
          <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Notifications
          </h1>
          <p className="text-muted-foreground">
            Stay updated with your escrow activities
          </p>
        </div>

        <div className="space-y-4">
          {mockNotifications.map((notification, index) => (
            <Card
              key={notification.id}
              className={`p-4 transition-all hover:shadow-md animate-slide-up ${
                !notification.read ? "border-l-4 border-l-primary" : ""
              }`}
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <div className="flex items-start gap-4">
                <div className={`rounded-lg p-2 ${notificationColors[notification.type]}`}>
                  {notificationIcons[notification.type]}
                </div>

                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground">
                        {notification.title}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {notification.description}
                      </p>
                    </div>
                    {!notification.read && (
                      <Badge variant="default" className="shrink-0">New</Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(notification.createdAt, { addSuffix: true })}
                    </span>
                    
                    {notification.actionUrl && (
                      <Button size="sm" variant="outline">
                        View Details
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
};
