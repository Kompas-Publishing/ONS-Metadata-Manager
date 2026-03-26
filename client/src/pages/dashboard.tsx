import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileText,
  Film,
  Plus,
  Eye,
  Pencil,
  CheckSquare,
  FileKey,
  ArrowRight,
  Clock,
  LayoutDashboard,
  AlertTriangle,
  FileWarning,
  FilePen
} from "lucide-react";
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
  const { user, isAdmin, canWriteMetadata, canReadMetadata, canReadLicenses, canReadTasks } = useAuth();

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
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Header & Greeting */}
      <div className="relative overflow-hidden rounded-3xl bg-primary/5 border border-primary/10 p-8 md:p-12">
        <div className="relative z-10">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
            {getGreeting()}, {user?.firstName || 'User'}!
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl text-lg">
            Welcome back, here's what's going on across your metadata and licenses today.
          </p>
          <div className="flex gap-3 mt-6">
            {canWriteMetadata && (
              <Link href="/create">
                <Button className="rounded-full px-6 shadow-lg shadow-primary/20">
                  <Plus className="w-4 h-4 mr-2" />
                  New Metadata
                </Button>
              </Link>
            )}
            <Link href="/tasks">
              <Button variant="outline" className="rounded-full px-6 bg-background">
                View Tasks
              </Button>
            </Link>
          </div>
        </div>
        <div className="absolute top-0 right-0 -translate-y-1/4 translate-x-1/4 w-64 h-64 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 translate-y-1/4 -translate-x-1/4 w-48 h-48 bg-primary/5 rounded-full blur-2xl" />
      </div>

      {/* Attention Needed */}
      {!statsLoading && stats && (stats.overdueTasks > 0 || stats.expiringLicenses > 0 || stats.incompleteMeta > 0 || stats.drafts > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.overdueTasks > 0 && (
            <Link href="/tasks">
              <Card className="border-destructive/30 bg-destructive/5 hover:border-destructive/50 transition-colors cursor-pointer">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-5 h-5 text-destructive" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-destructive">{stats.overdueTasks}</p>
                    <p className="text-xs text-muted-foreground">Overdue tasks</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )}
          {stats.expiringLicenses > 0 && (
            <Link href="/licenses">
              <Card className="border-orange-300/50 bg-orange-50/50 hover:border-orange-400/50 transition-colors cursor-pointer">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                    <FileKey className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-orange-700">{stats.expiringLicenses}</p>
                    <p className="text-xs text-muted-foreground">Licenses expiring soon</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )}
          {stats.incompleteMeta > 0 && (
            <Link href="/all-files">
              <Card className="border-amber-300/50 bg-amber-50/50 hover:border-amber-400/50 transition-colors cursor-pointer">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                    <FileWarning className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-amber-700">{stats.incompleteMeta}</p>
                    <p className="text-xs text-muted-foreground">Files need completion</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )}
          {stats.drafts > 0 && (
            <Link href="/all-files">
              <Card className="border-blue-300/50 bg-blue-50/50 hover:border-blue-400/50 transition-colors cursor-pointer">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                    <FilePen className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-blue-700">{stats.drafts}</p>
                    <p className="text-xs text-muted-foreground">Drafts</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )}
        </div>
      )}

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatsCard
          title="Total Metadata"
          value={stats?.totalFiles}
          loading={statsLoading}
          icon={FileText}
          description="Files in database"
        />
        <StatsCard
          title="Recent Activity"
          value={stats?.recentFiles}
          loading={statsLoading}
          icon={Clock}
          description="Added in last 24h"
          highlight
        />
        <StatsCard
          title="Active Series"
          value={stats?.totalSeries}
          loading={statsLoading}
          icon={Film}
          description="Unique series titles"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Recent Metadata */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="shadow-sm border-muted">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  <LayoutDashboard className="w-5 h-5 text-primary" />
                  Recent Metadata
                </CardTitle>
                <CardDescription>The latest additions to the portal</CardDescription>
              </div>
              <Link href="/all-files">
                <Button variant="ghost" size="sm" className="text-primary hover:text-primary hover:bg-primary/5">
                  View All <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {filesLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
                </div>
              ) : recentFiles && recentFiles.length > 0 ? (
                <div className="space-y-3">
                  {recentFiles.slice(0, 5).map((file) => (
                    <div
                      key={file.id}
                      className={cn(
                        "group flex items-center justify-between p-4 border rounded-xl transition-all hover:border-primary/30 hover:shadow-md",
                        file.draft === 1 && "bg-orange-50/50 border-orange-200"
                      )}
                    >
                      <div className="flex-1 min-w-0 pr-4">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-tighter">
                            {file.id}
                          </span>
                          {file.season && (
                            <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-medium">
                              S{file.season}E{file.episode}
                            </Badge>
                          )}
                          {file.draft === 1 && (
                            <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100 border-none text-[10px] h-5 px-1.5">
                              Draft
                            </Badge>
                          )}
                        </div>
                        <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                          {file.title}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {file.seriesTitle || 'Stand-alone content'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        <Link href={`/view/${file.id}`}>
                          <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full">
                            <Eye className="w-4 h-4" />
                          </Button>
                        </Link>
                        <Link href={`/edit/${file.id}`}>
                          <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full">
                            <Pencil className="w-4 h-4" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 border-2 border-dashed rounded-xl">
                  <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                  <p className="text-muted-foreground font-medium">No metadata files yet</p>
                  <Link href="/create">
                    <Button variant="ghost" className="text-primary">Create your first record</Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Tasks & Quick Actions */}
        <div className="space-y-6">
          {/* Tasks Overview */}
          <Card className="shadow-sm border-muted h-fit">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-orange-500" />
                Pending Tasks
              </CardTitle>
              <CardDescription>Action items requiring attention</CardDescription>
            </CardHeader>
            <CardContent>
              {tasks && tasks.length > 0 ? (
                <div className="space-y-3">
                  {tasks.slice(0, 5).map((task) => {
                    const isOverdue = task.deadline && new Date(task.deadline) < new Date();
                    return (
                      <Link key={task.id} href={`/view/${task.metadataFileId}`}>
                        <div className={cn(
                          "p-3 rounded-lg border transition-colors hover:border-primary/30 cursor-pointer",
                          isOverdue ? "border-destructive/20 bg-destructive/5" : "border-transparent bg-muted/30"
                        )}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium">{task.description}</span>
                            {(task as any).priority === "high" && (
                              <Badge variant="outline" className="text-[9px] h-4 border-orange-400 text-orange-600">high</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                            <span className="font-semibold uppercase">{task.metadataFile?.title}</span>
                            {task.metadataFile?.season && (
                              <span>S{task.metadataFile.season}E{task.metadataFile.episode}</span>
                            )}
                            {task.deadline && (
                              <span className={cn("ml-auto", isOverdue && "text-destructive font-bold")}>
                                {isOverdue ? "Overdue" : `Due ${format(new Date(task.deadline), "dd MMM")}`}
                              </span>
                            )}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                  <Link href="/tasks">
                    <Button variant="outline" className="w-full text-xs h-8 mt-2 rounded-lg">
                      View all {tasks.length} tasks
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="py-6 text-center">
                  <div className="w-10 h-10 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-3">
                    <CheckSquare className="w-5 h-5 text-green-600" />
                  </div>
                  <p className="text-sm text-muted-foreground">All caught up!</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Licenses Preview */}
          <Card className="shadow-sm border-muted h-fit">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <FileKey className="w-5 h-5 text-blue-500" />
                Latest Licenses
              </CardTitle>
            </CardHeader>
            <CardContent>
              {licenses && licenses.length > 0 ? (
                <div className="space-y-3">
                  {licenses.slice(0, 4).map((license) => {
                    const endDate = license.licenseEnd ? new Date(license.licenseEnd) : null;
                    const now = new Date();
                    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
                    const isExpiring = endDate && endDate > now && endDate < thirtyDays;
                    const isExpired = endDate && endDate < now;
                    return (
                      <Link key={license.id} href={`/licenses/${license.id}`}>
                        <div className={cn(
                          "p-3 rounded-lg border transition-colors cursor-pointer hover:border-primary/30",
                          isExpired ? "border-destructive/20 bg-destructive/5" :
                          isExpiring ? "border-orange-200 bg-orange-50/50" :
                          "border-transparent bg-muted/30"
                        )}>
                          <p className="text-sm font-semibold truncate">{license.name}</p>
                          <div className="flex justify-between items-center mt-1">
                            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                              {license.distributor}
                            </span>
                            {endDate && (
                              <span className={cn(
                                "text-[10px]",
                                isExpired ? "text-destructive font-bold" :
                                isExpiring ? "text-orange-600 font-semibold" :
                                "text-muted-foreground"
                              )}>
                                {isExpired ? "Expired" : `Ends ${format(endDate, "dd MMM yyyy")}`}
                              </span>
                            )}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                  <Link href="/licenses">
                    <Button variant="outline" className="w-full text-xs h-8 mt-2 rounded-lg">
                      Open License Manager
                    </Button>
                  </Link>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No licenses found.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatsCard({ title, value, loading, icon: Icon, description, highlight }: any) {
  return (
    <Card className={cn(
      "border-muted shadow-sm transition-all hover:shadow-md",
      highlight && "border-primary/20 bg-primary/5 shadow-primary/5"
    )}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
              {title}
            </p>
            {loading ? (
              <Skeleton className="h-9 w-16" />
            ) : (
              <p className="text-3xl font-black tracking-tight text-foreground">
                {value || 0}
              </p>
            )}
            <p className="text-[10px] text-muted-foreground font-medium">
              {description}
            </p>
          </div>
          <div className={cn(
            "w-12 h-12 rounded-2xl flex items-center justify-center transition-colors shadow-inner",
            highlight ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
          )}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
