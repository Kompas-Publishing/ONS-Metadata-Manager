import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import type { MetadataFile, License, Task } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

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
    <div className="space-y-6">
      {/* Page header — matches License Manager pattern */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {getGreeting()}, {user?.firstName || "User"}
          </h1>
          <p className="text-muted-foreground mt-2">
            {!statsLoading && stats
              ? `${stats.totalFiles} files across ${stats.totalSeries} series${stats.recentFiles > 0 ? ` · ${stats.recentFiles} added today` : ""}`
              : "Loading your workspace..."}
          </p>
        </div>
        {canWriteMetadata && (
          <Link href="/create">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Metadata
            </Button>
          </Link>
        )}
      </div>

      {/* Alerts — inline text, not cards */}
      {!statsLoading && stats && (stats.overdueTasks > 0 || stats.expiringLicenses > 0 || stats.incompleteMeta > 0) && (
        <Card className="border-destructive/20">
          <CardContent className="p-4 text-sm space-y-1">
            {stats.overdueTasks > 0 && (
              <p><Link href="/tasks" className="text-destructive font-medium hover:underline">{stats.overdueTasks} overdue {stats.overdueTasks === 1 ? "task" : "tasks"}</Link></p>
            )}
            {stats.expiringLicenses > 0 && (
              <p><Link href="/licenses" className="font-medium hover:underline">{stats.expiringLicenses} {stats.expiringLicenses === 1 ? "license" : "licenses"} expiring within 30 days</Link></p>
            )}
            {stats.incompleteMeta > 0 && (
              <p><Link href="/all-files" className="font-medium hover:underline">{stats.incompleteMeta} files with incomplete metadata</Link></p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recent files — table in a Card like License Manager */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-lg">Recent Metadata</CardTitle>
          <Link href="/all-files">
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-7 gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="overflow-x-auto pt-0">
          {filesLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : recentFiles && recentFiles.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs">ID</TableHead>
                  <TableHead className="text-xs">Title</TableHead>
                  <TableHead className="text-xs hidden sm:table-cell">Episode</TableHead>
                  <TableHead className="text-xs hidden md:table-cell">Added</TableHead>
                  <TableHead className="text-xs text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentFiles.slice(0, 8).map(file => (
                  <TableRow key={file.id}>
                    <TableCell>
                      <Link href={`/view/${file.id}`} className="font-mono text-xs text-primary hover:underline">{file.id}</Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/view/${file.id}`} className="hover:underline text-sm truncate block max-w-[250px]">{file.title}</Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm hidden sm:table-cell">
                      {file.season ? `S${file.season}E${file.episode}` : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs hidden md:table-cell">
                      {file.createdAt ? format(new Date(file.createdAt), "dd MMM") : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {file.draft === 1
                        ? <span className="text-xs text-orange-600 font-medium">Draft</span>
                        : <span className="text-xs text-muted-foreground">Published</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">No metadata files yet.</p>
          )}
        </CardContent>
      </Card>

      {/* Tasks + Licenses side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tasks */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-lg">Pending Tasks</CardTitle>
            <Link href="/tasks">
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-7 gap-1">
                All tasks <ArrowRight className="w-3 h-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="pt-0">
            {tasks && tasks.length > 0 ? (
              <Table>
                <TableBody>
                  {tasks.slice(0, 5).map(task => {
                    const isOverdue = task.deadline && new Date(task.deadline) < new Date();
                    return (
                      <TableRow key={task.id}>
                        <TableCell className="py-2">
                          <Link href={`/view/${task.metadataFileId}`} className="text-sm hover:underline">
                            {task.description}
                          </Link>
                          <span className="text-xs text-muted-foreground ml-2">{task.metadataFile?.title}</span>
                        </TableCell>
                        <TableCell className="text-right py-2">
                          {task.deadline && (
                            <span className={cn("text-xs", isOverdue ? "text-destructive font-medium" : "text-muted-foreground")}>
                              {isOverdue ? "Overdue" : format(new Date(task.deadline), "dd MMM")}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">No pending tasks.</p>
            )}
          </CardContent>
        </Card>

        {/* Licenses */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-lg">Licenses</CardTitle>
            <Link href="/licenses">
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-7 gap-1">
                All licenses <ArrowRight className="w-3 h-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="pt-0">
            {licenses && licenses.length > 0 ? (
              <Table>
                <TableBody>
                  {licenses.slice(0, 5).map(license => {
                    const endDate = license.licenseEnd ? new Date(license.licenseEnd) : null;
                    const isExpired = endDate && endDate < new Date();
                    return (
                      <TableRow key={license.id}>
                        <TableCell className="py-2">
                          <Link href={`/licenses/${license.id}`} className="text-sm hover:underline">{license.name}</Link>
                          {license.season && <span className="text-xs text-muted-foreground ml-2">S{license.season}</span>}
                        </TableCell>
                        <TableCell className="text-right py-2">
                          {endDate && (
                            <span className={cn("text-xs", isExpired ? "text-destructive" : "text-muted-foreground")}>
                              {isExpired ? "Expired" : format(endDate, "dd MMM yy")}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">No licenses.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
