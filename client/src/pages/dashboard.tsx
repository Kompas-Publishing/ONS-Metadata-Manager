import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, ArrowRight, Circle } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import type { MetadataFile, License, Task } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

interface Stats {
  totalFiles: number;
  recentFiles: number;
  totalSeries: number;
  overdueTasks: number;
  expiringLicenses: number;
  incompleteMeta: number;
  drafts: number;
}

export default function Dashboard() {
  const { user, canWriteMetadata, canReadMetadata, canReadLicenses, canReadTasks } = useAuth();

  useEffect(() => {
    document.title = "Dashboard | ONS Broadcast Portal";
  }, []);

  const { data: stats, isLoading: statsLoading } = useQuery<Stats>({
    queryKey: ["/api/stats"],
    enabled: canReadMetadata || canWriteMetadata,
  });

  const { data: recentFiles, isLoading: filesLoading } = useQuery<MetadataFile[]>({
    queryKey: ["/api/metadata/recent"],
    enabled: canReadMetadata || canWriteMetadata,
  });

  const { data: licenses } = useQuery<License[]>({
    queryKey: ["/api/licenses"],
    enabled: !!canReadLicenses,
  });

  const { data: tasks } = useQuery<(Task & { metadataFile: MetadataFile })[]>({
    queryKey: ["/api/tasks", { status: "pending" }],
    enabled: !!canReadTasks,
  });

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {getGreeting()}, {user?.firstName || "User"}
          </h1>
          {!statsLoading && stats ? (
            <p className="text-sm text-muted-foreground mt-1">
              {stats.totalFiles} files across {stats.totalSeries} series
              {stats.recentFiles > 0 && <> · <span className="text-foreground font-medium">{stats.recentFiles} added today</span></>}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground mt-1">Loading your workspace...</p>
          )}
        </div>
        {canWriteMetadata && (
          <Link href="/create">
            <Button size="sm" className="gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              Create Metadata
            </Button>
          </Link>
        )}
      </div>

      <div className="border-b" />

      {/* Alerts — text-based, not cards */}
      {!statsLoading && stats && (stats.overdueTasks > 0 || stats.expiringLicenses > 0 || stats.incompleteMeta > 0) && (
        <div className="text-sm border-l-2 border-destructive pl-4 py-1 space-y-1">
          {stats.overdueTasks > 0 && (
            <p>
              <Link href="/tasks" className="hover:underline">
                <span className="text-destructive font-medium">{stats.overdueTasks} overdue {stats.overdueTasks === 1 ? "task" : "tasks"}</span>
              </Link>
            </p>
          )}
          {stats.expiringLicenses > 0 && (
            <p>
              <Link href="/licenses" className="hover:underline">
                <span className="font-medium">{stats.expiringLicenses} {stats.expiringLicenses === 1 ? "license" : "licenses"} expiring within 30 days</span>
              </Link>
            </p>
          )}
          {stats.incompleteMeta > 0 && (
            <p>
              <Link href="/all-files" className="hover:underline">
                <span className="font-medium">{stats.incompleteMeta} files with incomplete metadata</span>
              </Link>
            </p>
          )}
        </div>
      )}

      {/* Two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Left: Recent files table */}
        <div className="lg:col-span-3">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Recent files</h2>
            <Link href="/all-files">
              <Button variant="ghost" size="sm" className="text-xs h-6 gap-1 text-muted-foreground">
                All files <ArrowRight className="w-3 h-3" />
              </Button>
            </Link>
          </div>
          {filesLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : recentFiles && recentFiles.length > 0 ? (
            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left font-medium text-muted-foreground px-3 py-2 text-xs">ID</th>
                    <th className="text-left font-medium text-muted-foreground px-3 py-2 text-xs">Title</th>
                    <th className="text-left font-medium text-muted-foreground px-3 py-2 text-xs hidden sm:table-cell">Episode</th>
                    <th className="text-left font-medium text-muted-foreground px-3 py-2 text-xs hidden md:table-cell">Added</th>
                    <th className="text-right font-medium text-muted-foreground px-3 py-2 text-xs">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentFiles.slice(0, 8).map((file) => (
                    <tr key={file.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-3 py-2">
                        <Link href={`/view/${file.id}`} className="font-mono text-xs text-primary hover:underline">{file.id}</Link>
                      </td>
                      <td className="px-3 py-2">
                        <Link href={`/view/${file.id}`} className="hover:underline truncate block max-w-[200px]">{file.title}</Link>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell">
                        {file.season ? `S${file.season}E${file.episode}` : "—"}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground text-xs hidden md:table-cell">
                        {file.createdAt ? format(new Date(file.createdAt), "dd MMM") : "—"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {file.draft === 1 ? (
                          <span className="text-xs text-orange-600 font-medium">Draft</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Published</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="border rounded-md p-8 text-center">
              <p className="text-sm text-muted-foreground">No metadata files yet.</p>
              {canWriteMetadata && (
                <Link href="/create">
                  <Button variant="ghost" size="sm" className="mt-2 text-primary">Create your first record</Button>
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Right: Tasks + Licenses */}
        <div className="lg:col-span-2 space-y-8">
          {/* Tasks */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Tasks</h2>
              <Link href="/tasks">
                <Button variant="ghost" size="sm" className="text-xs h-6 gap-1 text-muted-foreground">
                  All <ArrowRight className="w-3 h-3" />
                </Button>
              </Link>
            </div>
            {tasks && tasks.length > 0 ? (
              <div className="space-y-0.5">
                {tasks.slice(0, 6).map((task) => {
                  const isOverdue = task.deadline && new Date(task.deadline) < new Date();
                  return (
                    <Link key={task.id} href={`/view/${task.metadataFileId}`}>
                      <div className="flex items-start gap-2.5 py-2 px-1 rounded hover:bg-muted/40 transition-colors cursor-pointer group">
                        <Circle className={cn("w-2 h-2 mt-1.5 shrink-0", isOverdue ? "fill-destructive text-destructive" : "fill-muted-foreground/30 text-muted-foreground/30")} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm truncate">{task.description}</span>
                            {(task as any).priority === "high" && (
                              <span className="text-xs text-destructive">!</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            <span className="truncate">{task.metadataFile?.title}</span>
                            {task.deadline && (
                              <span className={cn("shrink-0", isOverdue && "text-destructive")}>
                                {isOverdue ? "overdue" : format(new Date(task.deadline), "dd MMM")}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-3">No pending tasks.</p>
            )}
          </div>

          {/* Licenses */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Licenses</h2>
              <Link href="/licenses">
                <Button variant="ghost" size="sm" className="text-xs h-6 gap-1 text-muted-foreground">
                  All <ArrowRight className="w-3 h-3" />
                </Button>
              </Link>
            </div>
            {licenses && licenses.length > 0 ? (
              <div className="space-y-0.5">
                {licenses.slice(0, 5).map((license) => {
                  const endDate = license.licenseEnd ? new Date(license.licenseEnd) : null;
                  const now = new Date();
                  const isExpired = endDate && endDate < now;
                  const isExpiring = endDate && endDate > now && endDate < new Date(now.getTime() + 30 * 86400000);
                  return (
                    <Link key={license.id} href={`/licenses/${license.id}`}>
                      <div className="flex items-center justify-between py-2 px-1 rounded hover:bg-muted/40 transition-colors cursor-pointer">
                        <div className="min-w-0">
                          <span className="text-sm truncate block">{license.name}</span>
                          <span className="text-xs text-muted-foreground">{license.distributor}</span>
                        </div>
                        {endDate && (
                          <span className={cn(
                            "text-xs shrink-0 ml-3",
                            isExpired ? "text-destructive" : isExpiring ? "text-orange-600" : "text-muted-foreground"
                          )}>
                            {isExpired ? "Expired" : format(endDate, "dd MMM yy")}
                          </span>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-3">No licenses.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
