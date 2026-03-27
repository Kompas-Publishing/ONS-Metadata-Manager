import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  AlertTriangle,
  FileWarning,
  FilePen,
  CheckCircle2,
  TrendingUp,
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

  const hasAlerts = stats && (stats.overdueTasks > 0 || stats.expiringLicenses > 0 || stats.incompleteMeta > 0 || stats.drafts > 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Compact header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {getGreeting()}, {user?.firstName || "User"}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Here's your broadcast operations overview.
          </p>
        </div>
        <div className="flex gap-2">
          {canWriteMetadata && (
            <Link href="/create">
              <Button size="sm" className="gap-2">
                <Plus className="w-4 h-4" />
                Create Metadata
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Attention row — always visible */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <AlertCard
          label="Overdue"
          count={stats?.overdueTasks ?? 0}
          loading={statsLoading}
          icon={AlertTriangle}
          href="/tasks"
          variant="red"
        />
        <AlertCard
          label="Expiring licenses"
          count={stats?.expiringLicenses ?? 0}
          loading={statsLoading}
          icon={FileKey}
          href="/licenses"
          variant="orange"
        />
        <AlertCard
          label="Incomplete"
          count={stats?.incompleteMeta ?? 0}
          loading={statsLoading}
          icon={FileWarning}
          href="/all-files"
          variant="amber"
        />
        <AlertCard
          label="Drafts"
          count={stats?.drafts ?? 0}
          loading={statsLoading}
          icon={FilePen}
          href="/all-files"
          variant="blue"
        />
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-3">
        <MiniStat label="Total files" value={stats?.totalFiles} loading={statsLoading} icon={FileText} />
        <MiniStat label="Added today" value={stats?.recentFiles} loading={statsLoading} icon={TrendingUp} highlight />
        <MiniStat label="Series" value={stats?.totalSeries} loading={statsLoading} icon={Film} />
      </div>

      {/* Main content — two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent metadata */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-semibold">Recent Metadata</CardTitle>
            <Link href="/all-files">
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-7 gap-1">
                View all <ArrowRight className="w-3 h-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="pt-0">
            {filesLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
              </div>
            ) : recentFiles && recentFiles.length > 0 ? (
              <div className="space-y-1">
                {recentFiles.slice(0, 6).map((file) => (
                  <Link key={file.id} href={`/view/${file.id}`}>
                    <div className={cn(
                      "group flex items-center gap-3 p-3 rounded-lg transition-colors hover:bg-muted/50 cursor-pointer",
                      file.draft === 1 && "border-l-2 border-l-orange-400"
                    )}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">{file.title}</span>
                          {file.season && (
                            <Badge variant="secondary" className="text-xs h-5 px-1.5 shrink-0">
                              S{file.season}E{file.episode}
                            </Badge>
                          )}
                          {file.draft === 1 && (
                            <Badge className="bg-orange-100 text-orange-700 border-none text-xs h-5 px-1.5 shrink-0">
                              Draft
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground font-mono">{file.id}</span>
                          <span className="text-xs text-muted-foreground truncate">{file.seriesTitle || "Stand-alone"}</span>
                        </div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => e.stopPropagation()} asChild>
                          <Link href={`/edit/${file.id}`}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-10">
                <FileText className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No metadata files yet</p>
                {canWriteMetadata && (
                  <Link href="/create">
                    <Button variant="ghost" size="sm" className="mt-1 text-primary">Create your first record</Button>
                  </Link>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tasks + Licenses stacked */}
        <div className="space-y-6">
          {/* Tasks */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-orange-500" />
                Pending Tasks
              </CardTitle>
              <Link href="/tasks">
                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-7 gap-1">
                  All tasks <ArrowRight className="w-3 h-3" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="pt-0">
              {tasks && tasks.length > 0 ? (
                <div className="space-y-1">
                  {tasks.slice(0, 5).map((task) => {
                    const isOverdue = task.deadline && new Date(task.deadline) < new Date();
                    return (
                      <Link key={task.id} href={`/view/${task.metadataFileId}`}>
                        <div className={cn(
                          "flex items-center justify-between p-2.5 rounded-lg transition-colors hover:bg-muted/50 cursor-pointer",
                          isOverdue && "bg-destructive/5"
                        )}>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{task.description}</span>
                              {(task as any).priority === "high" && (
                                <Badge variant="outline" className="text-xs h-4 px-1 border-orange-400 text-orange-600 shrink-0">!</Badge>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground">{task.metadataFile?.title}</span>
                          </div>
                          {task.deadline && (
                            <span className={cn(
                              "text-xs shrink-0 ml-2",
                              isOverdue ? "text-destructive font-semibold" : "text-muted-foreground"
                            )}>
                              {isOverdue ? "Overdue" : format(new Date(task.deadline), "dd MMM")}
                            </span>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center gap-3 py-6 justify-center">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  <span className="text-sm text-muted-foreground">All caught up</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Licenses */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <FileKey className="w-4 h-4 text-blue-500" />
                Licenses
              </CardTitle>
              <Link href="/licenses">
                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-7 gap-1">
                  All licenses <ArrowRight className="w-3 h-3" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="pt-0">
              {licenses && licenses.length > 0 ? (
                <div className="space-y-1">
                  {licenses.slice(0, 4).map((license) => {
                    const endDate = license.licenseEnd ? new Date(license.licenseEnd) : null;
                    const now = new Date();
                    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
                    const isExpiring = endDate && endDate > now && endDate < thirtyDays;
                    const isExpired = endDate && endDate < now;
                    return (
                      <Link key={license.id} href={`/licenses/${license.id}`}>
                        <div className="flex items-center justify-between p-2.5 rounded-lg transition-colors hover:bg-muted/50 cursor-pointer">
                          <div className="min-w-0">
                            <span className="text-sm font-medium truncate block">{license.name}</span>
                            <span className="text-xs text-muted-foreground">{license.distributor}</span>
                          </div>
                          {endDate && (
                            <span className={cn(
                              "text-xs shrink-0 ml-2",
                              isExpired ? "text-destructive font-semibold" :
                              isExpiring ? "text-orange-600 font-medium" :
                              "text-muted-foreground"
                            )}>
                              {isExpired ? "Expired" : format(endDate, "dd MMM yyyy")}
                            </span>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6">No licenses yet</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Alert card — always visible, shows count or checkmark when 0
function AlertCard({ label, count, loading, icon: Icon, href, variant }: {
  label: string;
  count: number;
  loading: boolean;
  icon: React.ElementType;
  href: string;
  variant: "red" | "orange" | "amber" | "blue";
}) {
  const colors = {
    red: { active: "border-red-200 bg-red-50/80 text-red-700", icon: "bg-red-100 text-red-600", idle: "text-green-600" },
    orange: { active: "border-orange-200 bg-orange-50/80 text-orange-700", icon: "bg-orange-100 text-orange-600", idle: "text-green-600" },
    amber: { active: "border-amber-200 bg-amber-50/80 text-amber-700", icon: "bg-amber-100 text-amber-600", idle: "text-green-600" },
    blue: { active: "border-blue-200 bg-blue-50/80 text-blue-700", icon: "bg-blue-100 text-blue-600", idle: "text-muted-foreground" },
  }[variant];

  const isActive = count > 0;

  return (
    <Link href={href}>
      <Card className={cn(
        "transition-all cursor-pointer hover:shadow-sm",
        isActive ? colors.active : "border-muted"
      )}>
        <CardContent className="p-3 flex items-center gap-3">
          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", isActive ? colors.icon : "bg-muted")}>
            {isActive ? <Icon className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4 text-green-500" />}
          </div>
          <div className="min-w-0">
            {loading ? (
              <Skeleton className="h-6 w-8" />
            ) : (
              <p className="text-xl font-bold leading-none">{count}</p>
            )}
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{label}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

// Compact stat — single row
function MiniStat({ label, value, loading, icon: Icon, highlight }: {
  label: string;
  value: number | undefined;
  loading: boolean;
  icon: React.ElementType;
  highlight?: boolean;
}) {
  return (
    <Card className={cn("border-muted", highlight && "border-primary/20 bg-primary/5")}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={cn(
          "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
          highlight ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
        )}>
          <Icon className="w-4.5 h-4.5" />
        </div>
        <div>
          {loading ? (
            <Skeleton className="h-7 w-10" />
          ) : (
            <p className="text-2xl font-bold leading-none tracking-tight">{value ?? 0}</p>
          )}
          <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
