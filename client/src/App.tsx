import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { AuthenticatedRoute } from "@/components/authenticated-route";
import { useAuth } from "@/hooks/use-auth";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Register from "@/pages/register";
import Pending from "@/pages/pending";
import Dashboard from "@/pages/dashboard";
import CreateFile from "@/pages/create-file";
import BatchCreate from "@/pages/batch-create";
import Browse from "@/pages/browse";
import AllFiles from "@/pages/all-files";
import EditFile from "@/pages/edit-file";
import ViewFile from "@/pages/view-file";
import EditSeason from "@/pages/edit-season";
import Admin from "@/pages/admin";
import Licenses from "@/pages/licenses";
import CreateLicense from "@/pages/create-license";
import ViewLicense from "@/pages/view-license";
import EditLicense from "@/pages/edit-license";
import Tasks from "@/pages/tasks";
import AiUpload from "@/pages/ai-upload";

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/pending" component={Pending} />
      
      <Route path="/">
        <AuthenticatedRoute>
          <ProtectedLayout>
            <Dashboard />
          </ProtectedLayout>
        </AuthenticatedRoute>
      </Route>
      
      <Route path="/create">
        <AuthenticatedRoute>
          <ProtectedLayout>
            <CreateFile />
          </ProtectedLayout>
        </AuthenticatedRoute>
      </Route>
      
      <Route path="/batch">
        <AuthenticatedRoute>
          <ProtectedLayout>
            <BatchCreate />
          </ProtectedLayout>
        </AuthenticatedRoute>
      </Route>
      
      <Route path="/browse">
        <AuthenticatedRoute>
          <ProtectedLayout>
            <Browse />
          </ProtectedLayout>
        </AuthenticatedRoute>
      </Route>
      
      <Route path="/all-files">
        <AuthenticatedRoute>
          <ProtectedLayout>
            <AllFiles />
          </ProtectedLayout>
        </AuthenticatedRoute>
      </Route>
      
      <Route path="/edit/:id">
        <AuthenticatedRoute>
          <ProtectedLayout>
            <EditFile />
          </ProtectedLayout>
        </AuthenticatedRoute>
      </Route>
      
      <Route path="/view/:id">
        <AuthenticatedRoute>
          <ProtectedLayout>
            <ViewFile />
          </ProtectedLayout>
        </AuthenticatedRoute>
      </Route>
      
      <Route path="/edit-season/:title/:season">
        <AuthenticatedRoute>
          <ProtectedLayout>
            <EditSeason />
          </ProtectedLayout>
        </AuthenticatedRoute>
      </Route>

      <Route path="/licenses">
        <AuthenticatedRoute>
          <ProtectedLayout>
            <Licenses />
          </ProtectedLayout>
        </AuthenticatedRoute>
      </Route>
      
      <Route path="/create-license">
        <AuthenticatedRoute>
          <ProtectedLayout>
            <CreateLicense />
          </ProtectedLayout>
        </AuthenticatedRoute>
      </Route>

      <Route path="/licenses/:id">
        <AuthenticatedRoute>
          <ProtectedLayout>
            <ViewLicense />
          </ProtectedLayout>
        </AuthenticatedRoute>
      </Route>

      <Route path="/licenses/:id/edit">
        <AuthenticatedRoute>
          <ProtectedLayout>
            <EditLicense />
          </ProtectedLayout>
        </AuthenticatedRoute>
      </Route>

      <Route path="/tasks">
        <AuthenticatedRoute>
          <ProtectedLayout>
            <Tasks />
          </ProtectedLayout>
        </AuthenticatedRoute>
      </Route>

      <Route path="/ai-upload">
        <AuthenticatedRoute>
          <ProtectedLayout>
            <AiUpload />
          </ProtectedLayout>
        </AuthenticatedRoute>
      </Route>
      
      <Route path="/admin">
        <AuthenticatedRoute>
          <ProtectedLayout>
            <Admin />
          </ProtectedLayout>
        </AuthenticatedRoute>
      </Route>
      
      <Route component={NotFound} />
    </Switch>
  );
}

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between p-4 border-b bg-background">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
          </header>
          <main className="flex-1 overflow-auto p-6 lg:p-12">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function AuthenticatedApp() {
  return (
    <>
      <Router />
      <Toaster />
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthenticatedApp />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
