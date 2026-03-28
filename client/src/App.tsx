import { Switch, Route, Redirect } from "wouter";
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
import Contracts from "@/pages/contracts";
import Tasks from "@/pages/tasks";
import AiUpload from "@/pages/ai-upload";
import AiChat from "@/pages/ai-chat";

function Router() {
  const { 
    canReadMetadata, 
    canWriteMetadata, 
    canReadLicenses, 
    canWriteLicenses, 
    canReadTasks, 
    canWriteTasks, 
    canUseAI,
    canUseAIChat,
    canAccessContracts,
    isAdmin
  } = useAuth();

  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/pending" component={Pending} />
      
      <Route path="/">
        <AuthenticatedRoute>
          {canReadMetadata || canWriteMetadata ? (
            <ProtectedLayout>
              <Dashboard />
            </ProtectedLayout>
          ) : (canReadTasks || canWriteTasks ? <Redirect to="/tasks" /> : <Redirect to="/pending" />)}
        </AuthenticatedRoute>
      </Route>
      
      <Route path="/create">
        <AuthenticatedRoute>
          {canWriteMetadata ? (
            <ProtectedLayout>
              <CreateFile />
            </ProtectedLayout>
          ) : <Redirect to="/" />}
        </AuthenticatedRoute>
      </Route>
      
      <Route path="/batch">
        <AuthenticatedRoute>
          {canWriteMetadata ? (
            <ProtectedLayout>
              <BatchCreate />
            </ProtectedLayout>
          ) : <Redirect to="/" />}
        </AuthenticatedRoute>
      </Route>
      
      <Route path="/browse/:title">
        <AuthenticatedRoute>
          {canReadMetadata || canWriteMetadata ? (
            <ProtectedLayout>
              <Browse />
            </ProtectedLayout>
          ) : <Redirect to="/" />}
        </AuthenticatedRoute>
      </Route>

      <Route path="/browse">
        <AuthenticatedRoute>
          {canReadMetadata || canWriteMetadata ? (
            <ProtectedLayout>
              <Browse />
            </ProtectedLayout>
          ) : <Redirect to="/" />}
        </AuthenticatedRoute>
      </Route>
      
      <Route path="/all-files">
        <AuthenticatedRoute>
          {canReadMetadata || canWriteMetadata ? (
            <ProtectedLayout>
              <AllFiles />
            </ProtectedLayout>
          ) : <Redirect to="/" />}
        </AuthenticatedRoute>
      </Route>
      
      <Route path="/edit/:id">
        <AuthenticatedRoute>
          {canWriteMetadata ? (
            <ProtectedLayout>
              <EditFile />
            </ProtectedLayout>
          ) : <Redirect to="/" />}
        </AuthenticatedRoute>
      </Route>
      
      <Route path="/view/:id">
        <AuthenticatedRoute>
          {canReadMetadata || canWriteMetadata ? (
            <ProtectedLayout>
              <ViewFile />
            </ProtectedLayout>
          ) : <Redirect to="/" />}
        </AuthenticatedRoute>
      </Route>
      
      <Route path="/edit-season/:title/:season">
        <AuthenticatedRoute>
          {canWriteMetadata ? (
            <ProtectedLayout>
              <EditSeason />
            </ProtectedLayout>
          ) : <Redirect to="/" />}
        </AuthenticatedRoute>
      </Route>

      <Route path="/licenses">
        <AuthenticatedRoute>
          {canReadLicenses || canWriteLicenses ? (
            <ProtectedLayout>
              <Licenses />
            </ProtectedLayout>
          ) : <Redirect to="/" />}
        </AuthenticatedRoute>
      </Route>
      
      <Route path="/create-license">
        <AuthenticatedRoute>
          {canWriteLicenses ? (
            <ProtectedLayout>
              <CreateLicense />
            </ProtectedLayout>
          ) : <Redirect to="/licenses" />}
        </AuthenticatedRoute>
      </Route>

      <Route path="/contracts">
        <AuthenticatedRoute>
          {canAccessContracts ? (
            <ProtectedLayout>
              <Contracts />
            </ProtectedLayout>
          ) : <Redirect to="/" />}
        </AuthenticatedRoute>
      </Route>

      <Route path="/licenses/:id">
        <AuthenticatedRoute>
          {canReadLicenses || canWriteLicenses ? (
            <ProtectedLayout>
              <ViewLicense />
            </ProtectedLayout>
          ) : <Redirect to="/licenses" />}
        </AuthenticatedRoute>
      </Route>

      <Route path="/licenses/:id/edit">
        <AuthenticatedRoute>
          {canWriteLicenses ? (
            <ProtectedLayout>
              <EditLicense />
            </ProtectedLayout>
          ) : <Redirect to="/licenses" />}
        </AuthenticatedRoute>
      </Route>

      <Route path="/tasks">
        <AuthenticatedRoute>
          {canReadTasks || canWriteTasks ? (
            <ProtectedLayout>
              <Tasks />
            </ProtectedLayout>
          ) : <Redirect to="/" />}
        </AuthenticatedRoute>
      </Route>

      <Route path="/ai-upload">
        <AuthenticatedRoute>
          {canUseAI ? (
            <ProtectedLayout>
              <AiUpload />
            </ProtectedLayout>
          ) : <Redirect to="/" />}
        </AuthenticatedRoute>
      </Route>

      <Route path="/ai-chat">
        <AuthenticatedRoute>
          {canUseAIChat ? (
            <ProtectedLayout>
              <AiChat />
            </ProtectedLayout>
          ) : <Redirect to="/" />}
        </AuthenticatedRoute>
      </Route>
      
      <Route path="/admin">
        <AuthenticatedRoute>
          {isAdmin ? (
            <ProtectedLayout>
              <Admin tab="users" />
            </ProtectedLayout>
          ) : <Redirect to="/" />}
        </AuthenticatedRoute>
      </Route>

      <Route path="/admin/users">
        <AuthenticatedRoute>
          {isAdmin ? (
            <ProtectedLayout>
              <Admin tab="users" />
            </ProtectedLayout>
          ) : <Redirect to="/" />}
        </AuthenticatedRoute>
      </Route>

      <Route path="/admin/settings">
        <AuthenticatedRoute>
          {isAdmin ? (
            <ProtectedLayout>
              <Admin tab="settings" />
            </ProtectedLayout>
          ) : <Redirect to="/" />}
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
