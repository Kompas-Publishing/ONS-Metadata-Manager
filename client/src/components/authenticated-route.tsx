import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";

interface AuthenticatedRouteProps {
  children: React.ReactNode;
}

export function AuthenticatedRoute({ children }: AuthenticatedRouteProps) {
  const { user, isLoading, isPending, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  if (isPending) {
    return <Redirect to="/pending" />;
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  return <>{children}</>;
}
