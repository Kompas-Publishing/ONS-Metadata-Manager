import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Layers, Film, Plus, Tv, Calendar, Eye, Pencil } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import type { MetadataFile } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";

interface Stats {
  totalFiles: number;
  recentFiles: number;
  totalSeries: number;
}

export default function Dashboard() {
  const { isAdmin, canWriteMetadata, canReadMetadata } = useAuth();

  const { data: stats, isLoading: statsLoading } = useQuery<Stats>({
    queryKey: ["/api/stats"],
  });

  const { data: recentFiles, isLoading: filesLoading } = useQuery<MetadataFile[]>({
    queryKey: ["/api/metadata/recent"],
  });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Overview of your metadata files and recent activity
          </p>
        </div>
        {canWriteMetadata && (
          <Link href="/create">
            <Button data-testid="button-create-file">
              <Plus className="w-4 h-4 mr-2" />
              Create File
            </Button>
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {statsLoading ? (
          <>
            <Card className="p-6">
              <Skeleton className="h-4 w-24 mb-4" />
              <Skeleton className="h-10 w-16" />
            </Card>
            <Card className="p-6">
              <Skeleton className="h-4 w-24 mb-4" />
              <Skeleton className="h-10 w-16" />
            </Card>
            <Card className="p-6">
              <Skeleton className="h-4 w-24 mb-4" />
              <Skeleton className="h-10 w-16" />
            </Card>
          </>
        ) : (
          <>
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                    Total Files
                  </p>
                  <p className="text-3xl font-semibold text-foreground mt-2" data-testid="stat-total-files">
                    {stats?.totalFiles || 0}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-primary" />
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                    Recent (24h)
                  </p>
                  <p className="text-3xl font-semibold text-foreground mt-2" data-testid="stat-recent-files">
                    {stats?.recentFiles || 0}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Layers className="w-6 h-6 text-primary" />
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                    Total Series
                  </p>
                  <p className="text-3xl font-semibold text-foreground mt-2" data-testid="stat-total-series">
                    {stats?.totalSeries || 0}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Film className="w-6 h-6 text-primary" />
                </div>
              </div>
            </Card>
          </>
        )}
      </div>

      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
        {filesLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-9 w-20" />
              </div>
            ))}
          </div>
        ) : recentFiles && recentFiles.length > 0 ? (
          <div className="space-y-2">
            {recentFiles.map((file) => (
              <div
                key={file.id}
                className={`flex items-start justify-between p-4 border rounded-lg hover-elevate gap-4 ${(file.draft === 1 || file.draft === '1' || file.draft === true) ? '!bg-orange-100/80 !border-orange-400' : ''}`}
                data-testid={`file-${file.id}`}
              >
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-mono text-sm text-muted-foreground" data-testid={`file-id-${file.id}`}>
                      {file.id}
                    </span>
                    {file.season && file.episode && (
                      <Badge variant="outline" data-testid={`file-season-episode-${file.id}`}>
                        S{file.season}E{file.episode}
                      </Badge>
                    )}
                  </div>

                  <div>
                    <h3 className="font-medium text-foreground" data-testid={`file-title-${file.id}`}>
                      {file.title}
                    </h3>
                    {file.seriesTitle && (
                      <p className="text-sm text-muted-foreground mt-1" data-testid={`file-series-title-${file.id}`}>
                        {file.seriesTitle}
                      </p>
                    )}
                    {file.episodeTitle && (
                      <p className="text-sm text-muted-foreground mt-1" data-testid={`file-episode-title-${file.id}`}>
                        Episode: {file.episodeTitle}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {(file.draft === 1 || file.draft === '1' || file.draft === true) && (
                      <Badge variant="outline" className="border-orange-500 text-orange-700 bg-orange-50" data-testid={`file-draft-${file.id}`}>
                        Draft
                      </Badge>
                    )}
                    {file.channel && (
                      <Badge variant="outline" className="gap-1" data-testid={`file-channel-${file.id}`}>
                        <Tv className="w-3 h-3" />
                        {file.channel}
                      </Badge>
                    )}
                    {file.programRating && (
                      <Badge variant="secondary" data-testid={`file-rating-${file.id}`}>
                        {file.programRating}
                      </Badge>
                    )}
                    {file.dateStart && file.dateEnd && (
                      <Badge variant="outline" className="gap-1" data-testid={`file-availability-${file.id}`}>
                        <Calendar className="w-3 h-3" />
                        {format(new Date(file.dateStart), "MMM d")} - {format(new Date(file.dateEnd), "MMM d, yyyy")}
                      </Badge>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {new Date(file.createdAt!).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {canReadMetadata && (
                    <Link href={`/view/${file.id}`}>
                      <Button size="sm" variant="outline" data-testid={`button-view-${file.id}`} title="View File">
                        <Eye className="w-4 h-4" />
                      </Button>
                    </Link>
                  )}
                  {canWriteMetadata && (
                    <Link href={`/edit/${file.id}`}>
                      <Button size="sm" variant="outline" data-testid={`button-edit-${file.id}`} title="Edit File">
                        <Pencil className="w-4 h-4" />
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            ))}
            <Link href="/all-files">
              <Button variant="outline" className="w-full mt-4" data-testid="button-view-all">
                View All Files
              </Button>
            </Link>
          </div>
        ) : (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No files created yet</p>
            {canWriteMetadata && (
              <Link href="/create">
                <Button className="mt-4" data-testid="button-create-first">
                  Create Your First File
                </Button>
              </Link>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
