import { Button } from "@/components/ui/button";
import { Database, FileText, Layers, TrendingUp } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-6 py-12 lg:px-12">
        <div className="flex flex-col items-center text-center space-y-8">
          <div className="space-y-4">
            <h1 className="text-5xl font-semibold text-foreground tracking-tight">
              ONS Broadcast Portal
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl">
              Professional management system for ONS broadcasting operations. 
              Manage metadata, licenses, and tasks with ease.
            </p>
          </div>

          <div className="flex gap-4">
            <Button
              size="lg"
              onClick={() => window.location.href = '/login'}
              data-testid="button-login"
            >
              Log In to Get Started
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-16 w-full">
            <div className="p-6 space-y-3 text-left">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileText className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">Single & Batch Creation</h3>
              <p className="text-sm text-muted-foreground">
                Create individual metadata files or generate batches of episodes with auto-incrementing IDs.
              </p>
            </div>

            <div className="p-6 space-y-3 text-left">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Database className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">Organized Browsing</h3>
              <p className="text-sm text-muted-foreground">
                Browse and filter by series, season, episode, genre, and content type.
              </p>
            </div>

            <div className="p-6 space-y-3 text-left">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Layers className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">JSON & XML Export</h3>
              <p className="text-sm text-muted-foreground">
                Export metadata in JSON or XML format ready for your broadcasting server.
              </p>
            </div>

            <div className="p-6 space-y-3 text-left">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">Full CRUD Operations</h3>
              <p className="text-sm text-muted-foreground">
                Create, view, edit, and delete metadata files with role-based permissions.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
