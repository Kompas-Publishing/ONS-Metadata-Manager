import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Search, Pencil, Trash2, Download, FileText, Calendar, Tv, X, Eye } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import type { MetadataFile } from "@shared/schema";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";

export default function AllFiles() {
  const [searchQuery, setSearchQuery] = useState("");
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [ratingFilter, setRatingFilter] = useState<string>("all");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canReadMetadata, canWriteMetadata, isLoading: authLoading } = useAuth();

  useEffect(() => {
    document.title = "All Files | ONS Broadcast Portal";
  }, []);

  const { data: files, isLoading, error } = useQuery<MetadataFile[]>({
    queryKey: ["/api/metadata"],
    enabled: !authLoading && (canReadMetadata || canWriteMetadata),
  });

  // Move all hooks to the top before any conditional returns
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/metadata/${id}`, undefined);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "File deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/metadata"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      setDeleteId(null);
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: error.message || "Failed to delete file",
        variant: "destructive",
      });
    },
  });

  const uniqueChannels = useMemo(() => {
    if (!files) return [];
    const channels = new Set<string>();
    files.forEach(file => {
      if (file.channel) channels.add(file.channel);
    });
    return Array.from(channels).sort();
  }, [files]);

  const ratingOptions = ["AL", "6", "9", "12", "16", "18"];

  const filteredFiles = useMemo(() => {
    if (!files) return [];
    
    return files.filter((file) => {
      const matchesSearch = 
        file.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        file.id.includes(searchQuery) ||
        (file.channel && file.channel.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (file.seriesTitle && file.seriesTitle.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (file.episodeTitle && file.episodeTitle.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesChannel = channelFilter === "all" || file.channel === channelFilter;
      const matchesRating = ratingFilter === "all" || file.programRating === ratingFilter;
      
      return matchesSearch && matchesChannel && matchesRating;
    });
  }, [files, searchQuery, channelFilter, ratingFilter]);

  const hasActiveFilters = channelFilter !== "all" || ratingFilter !== "all";

  const clearFilters = () => {
    setChannelFilter("all");
    setRatingFilter("all");
  };

  const handleDownload = async (id: string, format: "json" | "xml" | "xlsx") => {
    try {
      const response = await fetch(`/api/metadata/${id}/download?format=${format}`);
      if (!response.ok) throw new Error("Download failed");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${id}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Success",
        description: `File downloaded as ${format.toUpperCase()}`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to download file",
        variant: "destructive",
      });
    }
  };

  // Conditional rendering logic - moved after all hooks
  if (authLoading || isLoading) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  // Check for permission errors (403/423) or explicit lack of permissions
  const isPermissionError = error && isUnauthorizedError(error as Error);
  if (isPermissionError || (!canReadMetadata && !canWriteMetadata)) {
    return (
      <div className="max-w-4xl mx-auto">
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">You don't have permission to view files.</p>
        </Card>
      </div>
    );
  }

  // Handle other errors (network, server, etc.)
  if (error) {
    return (
      <div className="max-w-4xl mx-auto">
        <Card className="p-12 text-center space-y-4">
          <p className="text-muted-foreground">Failed to load files. Please try again.</p>
          <Button onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/metadata"] })}>
            Retry
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-foreground">All Files</h1>
        <p className="text-muted-foreground mt-2">
          View, search, and manage all metadata files
        </p>
      </div>

      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by title, ID, channel, series title, or episode title..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="input-search-files"
          />
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-foreground">Channel:</label>
            <Select value={channelFilter} onValueChange={setChannelFilter}>
              <SelectTrigger className="w-[180px]" data-testid="select-channel-filter">
                <SelectValue placeholder="All Channels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Channels</SelectItem>
                {uniqueChannels.map((channel) => (
                  <SelectItem key={channel} value={channel}>
                    {channel}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-foreground">Rating:</label>
            <Select value={ratingFilter} onValueChange={setRatingFilter}>
              <SelectTrigger className="w-[140px]" data-testid="select-rating-filter">
                <SelectValue placeholder="All Ratings" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Ratings</SelectItem>
                {ratingOptions.map((rating) => (
                  <SelectItem key={rating} value={rating}>
                    {rating}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearFilters}
              data-testid="button-clear-filters"
            >
              <X className="w-4 h-4 mr-1" />
              Clear Filters
            </Button>
          )}

          <div className="text-sm text-muted-foreground ml-auto">
            {filteredFiles.length} {filteredFiles.length === 1 ? "file" : "files"}
          </div>
        </div>
      </div>

      <Card className="p-6">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-9 w-24" />
              </div>
            ))}
          </div>
        ) : filteredFiles.length > 0 ? (
          <div className="space-y-3">
            {filteredFiles.map((file) => (
              <div
                key={file.id}
                className={`p-4 border rounded-lg hover-elevate ${(file.draft === 1 || file.draft === '1' || file.draft === true) ? '!bg-orange-100/80 !border-orange-400' : ''}`}
                data-testid={`file-row-${file.id}`}
              >
                <div className="flex items-start justify-between gap-4">
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
                      {file.duration && (
                        <span className="text-sm text-muted-foreground">
                          {file.duration}
                        </span>
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
                      {file.category && (
                        <Badge variant="secondary" data-testid={`file-category-${file.id}`}>
                          {file.category}
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
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDownload(file.id, "xml")}
                      data-testid={`button-download-xml-${file.id}`}
                      title="Download XML"
                    >
                      <Download className="w-4 h-4 mr-1" />
                      .xml
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDownload(file.id, "xlsx")}
                      data-testid={`button-download-xlsx-${file.id}`}
                      title="Download XLSX"
                    >
                      <Download className="w-4 h-4 mr-1" />
                      .xlsx
                    </Button>
                    {canReadMetadata && (
                      <Link href={`/view/${file.id}`}>
                        <Button size="sm" variant="outline" data-testid={`button-view-file-${file.id}`} title="View File">
                          <Eye className="w-4 h-4" />
                        </Button>
                      </Link>
                    )}
                    {canWriteMetadata && (
                      <>
                        <Link href={`/edit/${file.id}`}>
                          <Button size="sm" variant="outline" data-testid={`button-edit-file-${file.id}`} title="Edit File">
                            <Pencil className="w-4 h-4" />
                          </Button>
                        </Link>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setDeleteId(file.id)}
                          data-testid={`button-delete-${file.id}`}
                          title="Delete File"
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No files found</p>
          </div>
        )}
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent data-testid="dialog-delete-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete File</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete file ID {deleteId}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
