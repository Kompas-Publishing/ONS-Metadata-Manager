import { AuthLayout } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from "@/hooks/use-auth";
import { Clock } from "lucide-react";

export default function Pending() {
  const { logout } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <AuthLayout
      title="Account Pending Approval"
      description="Your account is being reviewed"
    >
      <div className="space-y-6">
        <Alert>
          <Clock className="h-4 w-4" />
          <AlertTitle>Approval Required</AlertTitle>
          <AlertDescription>
            Your account is pending approval. Please contact an administrator to
            activate your account. You'll receive access once your account has been
            reviewed and approved.
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Please contact an administrator via Slack to activate your account. 
            They will get back to you as soon as possible.
          </p>

          <Button
            variant="outline"
            className="w-full"
            onClick={handleLogout}
            data-testid="button-logout"
          >
            Sign out
          </Button>
        </div>
      </div>
    </AuthLayout>
  );
}
