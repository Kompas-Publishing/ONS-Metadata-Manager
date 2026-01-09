import { useState, useEffect } from "react";
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
import { Search, Pencil, Trash2, Download, FileText, Calendar, Tv, X, Eye, ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import type { PaginatedMetadataResult } from "@shared/schema";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useAuth } from "@/hooks/use-auth";
import { useDebounce } from "@/hooks/use-debounce";

export default function AllFiles() {
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [channelFilter, setChannelFilter] = useState<string>(""); // Text input for channel
  const debouncedChannel = useDebounce(channelFilter, 300);
  const [ratingFilter, setRatingFilter] = useState<string>("all");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, isLoading: authLoading } = useAuth();
  
  const canWrite = user?.canWrite === 1;
  const canRead = user?.canRead === 1;

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, debouncedChannel, ratingFilter]);

  const { data: paginatedData, isLoading, error } = useQuery<PaginatedMetadataResult>({
    queryKey: [
      "/api/metadata/paginated", 
      page, 
      50, 
      debouncedSearch || undefined, 
      debouncedChannel && debouncedChannel !== 'all' ? debouncedChannel : undefined, 
      ratingFilter && ratingFilter !== 'all' ? ratingFilter : undefined
    ].filter(Boolean),
    enabled: !authLoading,
  });

  const files = paginatedData?.files || [];
  const totalPages = paginatedData?.totalPages || 1;
  const totalFiles = paginatedData?.total || 0;

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/metadata/${id}`, undefined);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "File deleted successfully",
      });
      // Invalidate the specific page query
      queryClient.invalidateQueries({ queryKey: ["/api/metadata/paginated"] });
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

  const ratingOptions = ["AL", "6", "9", "12", "16", "18"];

  const hasActiveFilters = (channelFilter && channelFilter !== "all") || ratingFilter !== "all";

  const clearFilters = () => {
    setChannelFilter("");
    setRatingFilter("all");
    setSearchQuery("");
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

  if (authLoading) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const isPermissionError = error && isUnauthorizedError(error as Error);
  if (isPermissionError || (!canRead && !canWrite)) {
    return (
      <div className="max-w-4xl mx-auto">
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">You don't have permission to view files.</p>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto">
        <Card className="p-12 text-center space-y-4">
          <p className="text-muted-foreground">Failed to load files. Please try again.</p>
          <Button onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/metadata/paginated"] })}>
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
            placeholder="Search by title, ID, series title, or episode title..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="input-search-files"
          />
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-foreground">Channel:</label>
            <Input 
              placeholder="Filter by channel..." 
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              className="w-[180px]"
              data-testid="input-channel-filter"
            />
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
            {totalFiles} {totalFiles === 1 ? "file" : "files"}
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
        ) : files.length > 0 ? (
          <>
            <div className="space-y-3">
              {files.map((file) => (
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
                      {(canRead || canWrite) && (
                        <Link href={`/view/${file.id}`}>
                          <Button size="sm" variant="outline" data-testid={`button-view-file-${file.id}`} title="View File">
                            <Eye className="w-4 h-4" />
                          </Button>
                        </Link>
                      )}
                      {canWrite && (
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

            {/* Pagination Controls */}
            <div className="flex items-center justify-between pt-6 border-t mt-6">
               <div className="text-sm text-muted-foreground">
                 Page {page} of {totalPages}
               </div>
               <div className="flex gap-2">
                 <Button
                   variant="outline"
                   size="sm"
                   onClick={() => setPage(p => Math.max(1, p - 1))}
                   disabled={page === 1}
                   data-testid="button-prev-page"
                 >
                   <ChevronLeft className="w-4 h-4 mr-1" />
                   Previous
                 </Button>
                 <Button
                   variant="outline"
                   size="sm"
                   onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                   disabled={page >= totalPages}
                   data-testid="button-next-page"
                 >
                   Next
                   <ChevronRight className="w-4 h-4 ml-1" />
                 </Button>
               </div>
            </div>
          </>
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