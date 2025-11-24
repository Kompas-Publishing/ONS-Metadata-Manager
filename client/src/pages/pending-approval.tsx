import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserX, Archive, Mail, User } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export default function PendingApproval() {
  const { user } = useAuth();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
    window.location.href = "/";
  };

  const isPending = user?.status === "pending";

  const Icon = isPending ? UserX : Archive;
  const iconBgClass = isPending ? "bg-primary/10" : "bg-muted";
  const iconColorClass = isPending ? "text-primary" : "text-muted-foreground";
  
  const title = isPending 
    ? "Account Pending Approval" 
    : "Account Archived";

  const message = isPending
    ? "Your account is awaiting administrator approval. You will be notified once your account has been activated."
    : "Your account has been archived. Please contact an administrator to reactivate your account.";

  return (
    <div className="flex items-center justify-center min-h-screen p-6 bg-background">
      <Card className="p-8 max-w-md w-full" data-testid="card-pending-approval">
        <div className="flex flex-col items-center text-center space-y-6">
          <div className={`w-16 h-16 rounded-full ${iconBgClass} flex items-center justify-center`}>
            <Icon className={`w-8 h-8 ${iconColorClass}`} />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-foreground">
              {title}
            </h1>
            <p className="text-muted-foreground" data-testid="text-pending-message">
              {message}
            </p>
          </div>

          <Card className="p-4 w-full bg-muted/30">
            <div className="space-y-3 text-sm">
              {user?.firstName && user?.lastName && (
                <div className="flex items-center gap-3">
                  <User className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <div className="text-left">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Account Name</p>
                    <p className="font-medium text-foreground" data-testid="text-user-name">
                      {user.firstName} {user.lastName}
                    </p>
                  </div>
                </div>
              )}
              {user?.email && (
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <div className="text-left">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Email Address</p>
                    <p className="font-medium text-foreground break-all" data-testid="text-user-email">
                      {user.email}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </Card>

          <div className="space-y-3 w-full">
            <p className="text-sm text-muted-foreground">
              Please contact an administrator to activate your account.
            </p>
            <Button 
              variant="outline" 
              className="w-full" 
              onClick={handleLogout}
              data-testid="button-logout"
            >
              Sign Out
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
