import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Search, Film, ChevronRight, Calendar, Tv, Download, Edit, Eye, 
  LayoutGrid, List, ArrowUpDown, Trash2, AlertCircle, Upload, Loader2,
  ExternalLink, Globe, FolderOpen, CheckCircle2, ChevronDown, ChevronUp,
  Link2, Info, ShieldCheck, X
} from "lucide-react";
import { Link, useLocation, useRoute } from "wouter";
import { format } from "date-fns";
import type { MetadataFile, SeriesItem, License, Task } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { computeMetadataStatus, STATUS_CONFIG } from "@/lib/metadata-status";
import { useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const handleDownload = (url: string) => {
  const link = document.createElement('a');
  link.href = url;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

interface SeriesGroup {
  title: string;
  category: string;
  seasonCount: number;
  episodeCount: number;
  seriesTitle?: string;
  lastAddedAt: Date;
  seasons: { [key: number]: MetadataFile[] };
}

export default function Browse() {
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = useState<"newest" | "name" | "category" | "seasons" | "episodes">("newest");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [completionFilter, setCompletionFilter] = useState<string>("all");

  // Quick Edit Dialog state
  const [quickEditOpen, setQuickEditOpen] = useState(false);
  const [quickEditIds, setQuickEditIds] = useState<string[]>([]);
  const [quickEditValues, setQuickEditValues] = useState({ title: "", subsStatus: "", category: "", seasonType: "", contentType: "" });
  const [, setLocation] = useLocation();
  const [, routeParams] = useRoute("/browse/:title");
  const selectedSeries = routeParams?.title ? decodeURIComponent(routeParams.title) : null;
  const { canWriteMetadata, canReadMetadata } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [importPreview, setImportPreview] = useState<{ rows: any[]; errors: string[]; formData: FormData } | null>(null);
  const [importLoading, setImportLoading] = useState(false);

  const importXlsxMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch("/api/metadata/import-xlsx", {
        method: "POST",
        body: formData,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to import XLSX");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/metadata"] });
      setImportPreview(null);
      toast({
        title: "Import successful",
        description: data.message,
      });
      if (data.errors && data.errors.length > 0) {
        data.errors.slice(0, 3).forEach((err: string) => {
          toast({ title: "Import Warning", description: err, variant: "destructive" });
        });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Import failed", description: error.message, variant: "destructive" });
    },
  });

  const handleImportClick = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = ".xlsx";
    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (!files || files.length === 0) return;

      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append("files", files[i]);
      }

      // Preview first
      setImportLoading(true);
      try {
        const token = localStorage.getItem("auth_token");
        const res = await fetch("/api/metadata/import-xlsx?preview=true", {
          method: "POST",
          body: formData,
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error("Preview failed");
        const data = await res.json();
        // Build a fresh FormData for the actual import (can't reuse consumed one)
        const importFormData = new FormData();
        for (let i = 0; i < files.length; i++) {
          importFormData.append("files", files[i]);
        }
        setImportPreview({ rows: data.rows || [], errors: data.errors || [], formData: importFormData });
      } catch (err: any) {
        toast({ title: "Preview failed", description: err.message, variant: "destructive" });
      } finally {
        setImportLoading(false);
      }
    };
    input.click();
  };

  useEffect(() => {
    document.title = "Browse Series | ONS Broadcast Portal";
  }, []);

  const { data: files, isLoading } = useQuery<MetadataFile[]>({
    queryKey: ["/api/metadata"],
    enabled: canReadMetadata || canWriteMetadata,
  });

  const [openSeasons, setOpenSeasons] = useState<Record<number, boolean>>({});
  const [isEditingSeries, setIsEditingSeries] = useState(false);
  const [editSeriesData, setEditSeriesData] = useState<Partial<SeriesItem>>({});

  const toggleSeason = (season: number) => {
    setOpenSeasons((prev) => ({
      ...prev,
      [season]: !prev[season],
    }));
  };

  const { data: seriesDetails, isLoading: isSeriesDetailsLoading } = useQuery<SeriesItem & { 
    licenses: (License & { seasonRange: string | null })[],
    tasks: (Task & { metadataFile: MetadataFile })[]
  }>({
    queryKey: [`/api/series/by-title/${encodeURIComponent(selectedSeries || "")}`],
    enabled: !!selectedSeries,
  });

  const updateSeriesMutation = useMutation({
    mutationFn: async (data: Partial<SeriesItem>) => {
      if (!seriesDetails?.id) throw new Error("Series ID not found");
      const res = await apiRequest("PATCH", `/api/series/${seriesDetails.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/series/by-title/${encodeURIComponent(selectedSeries || "")}`] });
      toast({
        title: "Series updated",
        description: "Series details have been successfully updated.",
      });
      setIsEditingSeries(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const linkLicenseMutation = useMutation({
    mutationFn: async ({ licenseId, seasonRange }: { licenseId: string, seasonRange?: string }) => {
      if (!seriesDetails?.id) throw new Error("Series ID not found");
      await apiRequest("POST", `/api/series/${seriesDetails.id}/licenses`, { licenseId, seasonRange });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/series/by-title/${encodeURIComponent(selectedSeries || "")}`] });
      toast({
        title: "License linked",
        description: "License has been linked to the series.",
      });
    },
  });

  const unlinkLicenseMutation = useMutation({
    mutationFn: async (licenseId: string) => {
      if (!seriesDetails?.id) throw new Error("Series ID not found");
      await apiRequest("DELETE", `/api/series/${seriesDetails.id}/licenses/${licenseId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/series/by-title/${encodeURIComponent(selectedSeries || "")}`] });
      toast({
        title: "License unlinked",
        description: "License has been unlinked from the series.",
      });
    },
  });

  const deleteSeriesMutation = useMutation({
    mutationFn: async (title: string) => {
      await apiRequest("DELETE", `/api/metadata/series/${encodeURIComponent(title)}`);
    },
    onSuccess: (_, title) => {
      queryClient.invalidateQueries({ queryKey: ["/api/metadata"] });
      toast({
        title: "Series deleted",
        description: `Successfully deleted all files for ${title}`,
      });
      if (selectedSeries === title) {
        setLocation("/browse");
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteSeasonMutation = useMutation({
    mutationFn: async ({ title, season }: { title: string; season: number }) => {
      await apiRequest("DELETE", `/api/metadata/season/${encodeURIComponent(title)}/${season}`);
    },
    onSuccess: (_, { title, season }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/metadata"] });
      toast({
        title: "Season deleted",
        description: `Successfully deleted all files for ${title} Season ${season}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteEpisodeMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/metadata/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/metadata"] });
      toast({
        title: "Episode deleted",
        description: "The episode has been permanently removed.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const bulkEditMutation = useMutation({
    mutationFn: async ({ ids, data }: { ids: string[]; data: Record<string, any> }) => {
      await apiRequest("POST", "/api/metadata/bulk-edit", { ids, data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/metadata"] });
      toast({ title: "Bulk edit applied", description: "Episodes updated successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Bulk edit failed", description: error.message, variant: "destructive" });
    },
  });

  const seriesGroups = useMemo(() => {
    const groups: { [key: string]: SeriesGroup } = {};
    if (files) {
      files.forEach((file) => {
        if (!file.title) return;
        if (!groups[file.title]) {
          groups[file.title] = {
            title: file.title,
            category: file.category || "Unknown",
            seasonCount: 0,
            episodeCount: 0,
            seriesTitle: file.seriesTitle ?? undefined,
            lastAddedAt: file.createdAt ? new Date(file.createdAt) : new Date(0),
            seasons: {},
          };
        }
        const fileDate = file.createdAt ? new Date(file.createdAt) : new Date(0);
        if (fileDate > groups[file.title].lastAddedAt) {
          groups[file.title].lastAddedAt = fileDate;
        }
        const seasonNum = file.season || 0;
        if (!groups[file.title].seasons[seasonNum]) {
          groups[file.title].seasons[seasonNum] = [];
          groups[file.title].seasonCount++;
        }
        groups[file.title].seasons[seasonNum].push(file);
        groups[file.title].episodeCount++;
      });
    }
    return groups;
  }, [files]);

  const availableCategories = useMemo(() => {
    const cats = new Set(Object.values(seriesGroups).map(s => s.category).filter(c => c && c !== "Unknown"));
    return Array.from(cats).sort();
  }, [seriesGroups]);

  const filteredSeries = useMemo(() => {
    return Object.values(seriesGroups)
      .filter((series) => {
        if (!series.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        if (categoryFilter !== "all" && series.category !== categoryFilter) return false;
        const allEpisodes = Object.values(series.seasons).flat();
        if (statusFilter === "draft" && !allEpisodes.some(f => f.draft === 1)) return false;
        if (statusFilter === "published" && allEpisodes.every(f => f.draft === 1)) return false;
        if (completionFilter === "incomplete" && !allEpisodes.some(f => computeMetadataStatus(f) === "incomplete")) return false;
        if (completionFilter === "complete" && allEpisodes.some(f => computeMetadataStatus(f) === "incomplete")) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "newest") return b.lastAddedAt.getTime() - a.lastAddedAt.getTime();
        if (sortBy === "name") return a.title.localeCompare(b.title);
        if (sortBy === "category") return a.category.localeCompare(b.category);
        if (sortBy === "seasons") return b.seasonCount - a.seasonCount;
        if (sortBy === "episodes") return b.episodeCount - a.episodeCount;
        return 0;
      });
  }, [seriesGroups, searchQuery, sortBy, categoryFilter, statusFilter, completionFilter]);

  const selectedSeriesData = selectedSeries ? seriesGroups[selectedSeries] : null;

  const SortIcon = ({ column }: { column: typeof sortBy }) => {
    if (sortBy !== column) return <ArrowUpDown className="ml-2 h-4 w-4" />;
    return <ArrowUpDown className="ml-2 h-4 w-4 text-primary" />;
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Browse Series</h1>
        <p className="text-muted-foreground mt-2">
          Browse and filter your metadata files by series and season
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search series..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="input-search-series"
          />
        </div>
        {!selectedSeries && (
          <div className="flex items-center gap-2 w-full md:w-auto">
            {canWriteMetadata && (
              <Button
                variant="outline"
                className="gap-2"
                onClick={handleImportClick}
                disabled={importXlsxMutation.isPending || importLoading}
                data-testid="button-import-xlsx"
              >
                {(importXlsxMutation.isPending || importLoading) ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                Import XLSX
              </Button>
            )}
            <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Latest Added</SelectItem>
                <SelectItem value="name">Name (A-Z)</SelectItem>
                <SelectItem value="category">Category (A-Z)</SelectItem>
                <SelectItem value="seasons">Seasons (Most)</SelectItem>
                <SelectItem value="episodes">Episodes (Most)</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex border rounded-md overflow-hidden flex-shrink-0">
              <Button
                variant={viewMode === "grid" ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setViewMode("grid")}
                className="rounded-none h-10 w-10"
              >
                <LayoutGrid className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setViewMode("list")}
                className="rounded-none h-10 w-10"
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {!selectedSeries && (
        <div className="flex flex-wrap gap-2">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {availableCategories.map(c => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="draft">Has Drafts</SelectItem>
            </SelectContent>
          </Select>
          <Select value={completionFilter} onValueChange={setCompletionFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Completion" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="complete">Complete</SelectItem>
              <SelectItem value="incomplete">Incomplete</SelectItem>
            </SelectContent>
          </Select>
          {(categoryFilter !== "all" || statusFilter !== "all" || completionFilter !== "all") && (
            <Button variant="ghost" size="sm" onClick={() => { setCategoryFilter("all"); setStatusFilter("all"); setCompletionFilter("all"); }}>
              <X className="w-3 h-3 mr-1" /> Clear filters
            </Button>
          )}
        </div>
      )}

      {!selectedSeries ? (
        <div>
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Card key={i} className="p-6">
                  <Skeleton className="h-6 w-3/4 mb-4" />
                  <Skeleton className="h-4 w-1/2 mb-2" />
                  <Skeleton className="h-4 w-1/3" />
                </Card>
              ))}
            </div>
          ) : filteredSeries.length > 0 ? (
            viewMode === "grid" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredSeries.map((series) => (
                  <Card
                    key={series.title}
                    className="p-6 hover-elevate cursor-pointer group relative"
                    onClick={() => setLocation(`/browse/${encodeURIComponent(series.title)}`)}
                    data-testid={`series-card-${series.title}`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Film className="w-6 h-6 text-primary" />
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2 text-foreground">{series.title}</h3>
                    {series.seriesTitle && (
                      <p className="text-sm text-muted-foreground mb-2">{series.seriesTitle}</p>
                    )}
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">
                        {series.seasonCount} {series.seasonCount === 1 ? "Season" : "Seasons"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {series.episodeCount} {series.episodeCount === 1 ? "Episode" : "Episodes"}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        {series.category && series.category !== "Unknown" && (
                          <Badge variant="secondary">{series.category}</Badge>
                        )}
                        <span className="text-xs text-muted-foreground uppercase tracking-wider">
                          Added {format(series.lastAddedAt, "dd MMM yyyy")}
                        </span>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead 
                        className="cursor-pointer hover:text-primary transition-colors"
                        onClick={() => setSortBy("name")}
                      >
                        <div className="flex items-center">
                          Series Title
                          <SortIcon column="name" />
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:text-primary transition-colors"
                        onClick={() => setSortBy("category")}
                      >
                        <div className="flex items-center">
                          Category
                          <SortIcon column="category" />
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:text-primary transition-colors"
                        onClick={() => setSortBy("seasons")}
                      >
                        <div className="flex items-center">
                          Seasons
                          <SortIcon column="seasons" />
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:text-primary transition-colors"
                        onClick={() => setSortBy("episodes")}
                      >
                        <div className="flex items-center">
                          Episodes
                          <SortIcon column="episodes" />
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:text-primary transition-colors"
                        onClick={() => setSortBy("newest")}
                      >
                        <div className="flex items-center">
                          Last Added
                          <SortIcon column="newest" />
                        </div>
                      </TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSeries.map((series) => (
                      <TableRow 
                        key={series.title} 
                        className="cursor-pointer"
                        onClick={() => setLocation(`/browse/${encodeURIComponent(series.title)}`)}
                      >
                        <TableCell className="font-medium">{series.title}</TableCell>
                        <TableCell>
                          {series.category && series.category !== "Unknown" ? (
                            <Badge variant="outline">{series.category}</Badge>
                          ) : null}
                        </TableCell>
                        <TableCell>{series.seasonCount}</TableCell>
                        <TableCell>{series.episodeCount}</TableCell>
                        <TableCell className="text-muted-foreground">{format(series.lastAddedAt, "dd-MM-yyyy")}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setLocation(`/browse/${encodeURIComponent(series.title)}`); }}>
                              <Eye className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )
          ) : (
            <Card className="p-12 text-center">
              <Film className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No series found</p>
            </Card>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <Button
            variant="outline"
            onClick={() => setLocation("/browse")}
            data-testid="button-back-to-series"
          >
            Back to All Series
          </Button>

          {/* Series Overview Section */}
          <Card className="p-6 overflow-hidden border-2 border-primary/10 shadow-md">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
              <div className="flex-1 space-y-4">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h2 className="text-3xl font-bold tracking-tight">{selectedSeriesData?.title}</h2>
                    {seriesDetails?.productionYear && (
                      <span className="text-xl text-muted-foreground font-medium">
                        ({seriesDetails.productionYear})
                      </span>
                    )}
                    {canWriteMetadata && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        disabled={isSeriesDetailsLoading || !seriesDetails}
                        onClick={() => {
                          setEditSeriesData({
                            productionYear: seriesDetails?.productionYear,
                            websiteLink: seriesDetails?.websiteLink,
                            driveLinks: seriesDetails?.driveLinks || []
                          });
                          setIsEditingSeries(true);
                        }}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {selectedSeriesData?.category && selectedSeriesData.category !== "Unknown" && (
                      <Badge variant="secondary" className="px-3 py-1 text-sm">{selectedSeriesData.category}</Badge>
                    )}
                    <Badge variant="outline" className="px-3 py-1 text-sm bg-primary/5 border-primary/20">
                      {selectedSeriesData?.seasonCount} {selectedSeriesData?.seasonCount === 1 ? "Season" : "Seasons"}
                    </Badge>
                    <Badge variant="outline" className="px-3 py-1 text-sm">
                      {selectedSeriesData?.episodeCount} Episodes
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4 pt-2">
                  {/* Links Section */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <Link2 className="w-4 h-4" /> Links & Resources
                    </h4>
                    <div className="space-y-2">
                      {seriesDetails?.websiteLink ? (
                        <a 
                          href={seriesDetails.websiteLink} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                          >
                          <Globe className="w-4 h-4" />
                          Website ONS <ExternalLink className="w-3 h-3" />
                          </a>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">No website link set</p>
                      )}

                      {seriesDetails?.driveLinks && Array.isArray(seriesDetails.driveLinks) && seriesDetails.driveLinks.length > 0 ? (
                        <div className="space-y-1">
                          {seriesDetails.driveLinks.map((link: any, idx: number) => (
                            <a 
                              key={idx}
                              href={link.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 text-sm text-green-700 hover:underline"
                            >
                              <FolderOpen className="w-4 h-4 text-green-600" />
                              {link.name || "Google Drive Folder"} <ExternalLink className="w-3 h-3" />
                            </a>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">No drive links set</p>
                      )}
                    </div>
                  </div>

                  {/* Licenses Section */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4" /> Associated Licenses
                      </h4>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {seriesDetails?.licenses && seriesDetails.licenses.length > 0 ? (
                        seriesDetails.licenses.map((license: any) => (
                          <Link key={license.id} href={`/licenses/${license.id}`}>
                            <Badge variant="outline" className="cursor-pointer hover:bg-primary/5 py-1.5 px-2.5">
                              {license.name}
                              {license.seasonRange && <span className="text-muted-foreground ml-1.5">S{license.seasonRange}</span>}
                            </Badge>
                          </Link>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground italic">No licenses linked</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Tasks Section */}
                {seriesDetails?.tasks && seriesDetails.tasks.length > 0 && (
                  <div className="pt-4 border-t border-dashed">
                    <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2 mb-3">
                      <AlertCircle className="w-4 h-4 text-orange-500" /> Pending Tasks
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {seriesDetails.tasks.slice(0, 5).map((task) => (
                        <Badge key={task.id} variant="outline" className="bg-orange-50 border-orange-200 text-orange-800 text-xs py-0.5">
                          {task.metadataFile?.episode ? `E${task.metadataFile.episode}: ` : ""}{task.description}
                          {task.deadline && (
                            <span className="ml-1.5 opacity-70 font-mono">
                              (Due: {format(new Date(task.deadline), "dd-MM")})
                            </span>
                          )}
                        </Badge>
                      ))}
                      {seriesDetails.tasks.length > 5 && (
                        <Badge variant="outline" className="text-xs py-0.5">
                          +{seriesDetails.tasks.length - 5} more
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Edit Dialog */}
              <AlertDialog open={isEditingSeries} onOpenChange={setIsEditingSeries}>
                <AlertDialogContent className="max-w-2xl">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Edit Series Details: {selectedSeriesData?.title}</AlertDialogTitle>
                    <AlertDialogDescription>
                      Update series-level metadata, links, and associated licenses.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  
                  <div className="grid gap-6 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Production Year</label>
                        <Input 
                          type="number" 
                          value={editSeriesData.productionYear || ""} 
                          onChange={(e) => setEditSeriesData({...editSeriesData, productionYear: parseInt(e.target.value) || undefined})}
                          placeholder="e.g. 2024"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Website ONS</label>
                        <Input 
                          value={editSeriesData.websiteLink || ""} 
                          onChange={(e) => setEditSeriesData({...editSeriesData, websiteLink: e.target.value})}
                          placeholder="https://example.com"
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold">Google Drive Links</h4>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => {
                            const currentLinks = Array.isArray(editSeriesData.driveLinks) ? editSeriesData.driveLinks : [];
                            setEditSeriesData({
                              ...editSeriesData, 
                              driveLinks: [...currentLinks, { name: "", url: "" }]
                            });
                          }}
                        >
                          Add Link
                        </Button>
                      </div>
                      <div className="space-y-2 max-h-[150px] overflow-y-auto pr-2">
                        {Array.isArray(editSeriesData.driveLinks) && editSeriesData.driveLinks.map((link: any, idx: number) => (
                          <div key={idx} className="flex gap-2">
                            <Input 
                              placeholder="Name (e.g. Season 1)" 
                              value={link.name} 
                              className="flex-1"
                              onChange={(e) => {
                                const newLinks = [...(editSeriesData.driveLinks as any[])];
                                newLinks[idx].name = e.target.value;
                                setEditSeriesData({...editSeriesData, driveLinks: newLinks});
                              }}
                            />
                            <Input 
                              placeholder="Google Drive URL" 
                              value={link.url} 
                              className="flex-[2]"
                              onChange={(e) => {
                                const newLinks = [...(editSeriesData.driveLinks as any[])];
                                newLinks[idx].url = e.target.value;
                                setEditSeriesData({...editSeriesData, driveLinks: newLinks});
                              }}
                            />
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => {
                                const newLinks = (editSeriesData.driveLinks as any[]).filter((_, i) => i !== idx);
                                setEditSeriesData({...editSeriesData, driveLinks: newLinks});
                              }}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t">
                      <h4 className="text-sm font-semibold">Associated Licenses</h4>
                      <div className="space-y-3">
                        {seriesDetails?.licenses?.map((license) => (
                          <div key={license.id} className="flex items-center justify-between bg-muted/30 p-2 rounded-md">
                            <div>
                              <p className="text-sm font-medium">{license.name}</p>
                              <p className="text-xs text-muted-foreground">{license.seasonRange || "All Seasons"}</p>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-destructive h-8"
                              onClick={() => unlinkLicenseMutation.mutate(license.id)}
                            >
                              Remove
                            </Button>
                          </div>
                        ))}
                        <LinkLicenseForm 
                          onLink={(licenseId, range) => linkLicenseMutation.mutate({ licenseId, seasonRange: range })}
                          existingLicenseIds={seriesDetails?.licenses?.map(l => l.id) || []}
                        />
                      </div>
                    </div>
                  </div>

                  <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setIsEditingSeries(false)}>Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={() => updateSeriesMutation.mutate(editSeriesData)}
                      disabled={updateSeriesMutation.isPending}
                    >
                      {updateSeriesMutation.isPending ? "Saving..." : "Save Changes"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <div className="flex flex-wrap gap-2 md:flex-col md:items-end flex-shrink-0">
                <div className="flex gap-2 flex-wrap justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownload(`/api/metadata/download/series/${encodeURIComponent(selectedSeriesData?.title || '')}/xml`)}
                    className="gap-2"
                  >
                    <Download className="w-4 h-4" />
                    XML
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownload(`/api/metadata/download/series/${encodeURIComponent(selectedSeriesData?.title || '')}/xlsx`)}
                    className="gap-2"
                  >
                    <Download className="w-4 h-4" />
                    XLSX
                  </Button>
                </div>
                
                {canWriteMetadata && (
                  <div className="flex gap-2 flex-wrap justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={handleImportClick}
                      disabled={importXlsxMutation.isPending || importLoading}
                    >
                      {(importXlsxMutation.isPending || importLoading) ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4" />
                      )}
                      Import XLSX
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2 text-destructive hover:bg-destructive/10 border-destructive/20"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Entire Series?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete all {selectedSeriesData?.episodeCount} episodes across {selectedSeriesData?.seasonCount} seasons for <strong>{selectedSeriesData?.title}</strong>. 
                            This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => selectedSeriesData && deleteSeriesMutation.mutate(selectedSeriesData.title)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete Series
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {selectedSeriesData && Object.entries(selectedSeriesData.seasons)
            .sort(([a], [b]) => parseInt(a) - parseInt(b))
            .map(([seasonNum, episodes]) => (
              <Collapsible
                key={seasonNum}
                open={openSeasons[parseInt(seasonNum)] ?? true}
                onOpenChange={() => toggleSeason(parseInt(seasonNum))}
                className="w-full"
              >
                <Card className="overflow-hidden border-primary/5">
                  <div className="flex items-center justify-between p-4 bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => toggleSeason(parseInt(seasonNum))}>
                    <div className="flex items-center gap-3">
                      <Button variant="ghost" size="sm" className="p-0 h-8 w-8" onClick={(e) => { e.stopPropagation(); toggleSeason(parseInt(seasonNum)); }}>
                        {openSeasons[parseInt(seasonNum)] ?? true ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                      <h3 className="text-xl font-semibold">
                        Season {seasonNum === "0" ? "Unknown" : seasonNum}
                      </h3>
                      <Badge variant="outline" className="ml-2">
                        {episodes.length} {episodes.length === 1 ? "Episode" : "Episodes"}
                      </Badge>
                    </div>
                    <div className="flex gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
                      {canWriteMetadata && (
                        <>
                          {episodes.length > 1 && (
                            <Button
                              variant="outline"
                              size="sm"
                              asChild
                              className="gap-2 h-8"
                            >
                              <Link href={`/edit-season/${encodeURIComponent(selectedSeriesData?.title || '')}/${seasonNum}?ids=${episodes.map(e => e.id).join(',')}`}>
                                <Edit className="w-3.5 h-3.5" />
                                Batch Editor
                              </Link>
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2 h-8"
                            onClick={() => {
                              const first = episodes[0];
                              setQuickEditIds(episodes.map(e => e.id));
                              setQuickEditValues({
                                title: first?.title || "",
                                subsStatus: first?.subsStatus || "Incomplete",
                                category: first?.category || "",
                                seasonType: first?.seasonType || "",
                                contentType: first?.contentType || "",
                              });
                              setQuickEditOpen(true);
                            }}
                          >
                            Quick Edit
                          </Button>
                        </>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(`/api/metadata/download/season/${encodeURIComponent(selectedSeriesData?.title || '')}/${seasonNum}/xml`)}
                        className="gap-2 h-8"
                      >
                        <Download className="w-3.5 h-3.5" />
                        XML
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(`/api/metadata/download/season/${encodeURIComponent(selectedSeriesData?.title || '')}/${seasonNum}/xlsx`)}
                        className="gap-2 h-8"
                      >
                        <Download className="w-3.5 h-3.5" />
                        XLSX
                      </Button>
                      {canWriteMetadata && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-2 text-destructive hover:bg-destructive/10 border-destructive/20 h-8"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Entire Season?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete all episodes in <strong>{selectedSeriesData?.title} Season {seasonNum}</strong>. 
                                This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteSeasonMutation.mutate({ 
                                  title: selectedSeriesData?.title || '', 
                                  season: parseInt(seasonNum) 
                                })}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete Season
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>
                  
                  <CollapsibleContent>
                    <div className="p-0 border-t">
                      <Table>
                        <TableHeader className="bg-muted/20">
                          <TableRow>
                            <TableHead className="w-[80px]">ID</TableHead>
                            <TableHead className="w-[60px]">EP</TableHead>
                            <TableHead>Title</TableHead>
                            <TableHead className="w-[100px]">Duration</TableHead>
                            <TableHead className="w-[120px]">Subs Status</TableHead>
                            <TableHead className="w-[120px]">Metadata</TableHead>
                            <TableHead className="w-[80px]">Tasks</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {episodes
                            .sort((a, b) => (a.episode || 0) - (b.episode || 0))
                            .map((episode) => (
                              <TableRow 
                                key={episode.id}
                                className={episode.draft === 1 ? 'bg-orange-50/50 hover:bg-orange-100/50' : ''}
                              >
                                <TableCell className="font-mono text-[11px] text-muted-foreground">
                                  {episode.id}
                                </TableCell>
                                <TableCell className="font-medium">
                                  {episode.episode || "-"}
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-col">
                                    <span className="font-medium text-sm line-clamp-1">{episode.episodeTitle || episode.title}</span>
                                    {episode.draft === 1 && (
                                      <span className="text-xs text-orange-600 font-semibold uppercase">Draft</span>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                  {episode.duration || "-"}
                                </TableCell>
                                <TableCell>
                                  <Badge 
                                    variant="outline" 
                                    className={`text-xs font-normal px-1.5 py-0 ${
                                      episode.subsStatus === 'Complete' 
                                        ? 'bg-green-50 text-green-700 border-green-200' 
                                        : episode.subsStatus === 'Not needed'
                                          ? 'bg-slate-50 text-slate-600 border-slate-200'
                                          : 'bg-red-50 text-red-700 border-red-200'
                                    }`}
                                  >
                                    {episode.subsStatus || 'Incomplete'}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge 
                                    variant="outline" 
                                    className={`text-xs font-normal px-1.5 py-0 ${
                                      episode.metadataTimesStatus === 'Complete' 
                                        ? 'bg-green-50 text-green-700 border-green-200' 
                                        : 'bg-orange-50 text-orange-700 border-orange-200'
                                    }`}
                                  >
                                    {episode.metadataTimesStatus === 'Complete' ? 'Times OK' : 'Times Incl.'}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  {(() => {
                                    const episodeTasks = seriesDetails?.tasks?.filter(t => t.metadataFileId === episode.id) || [];
                                    if (episodeTasks.length === 0) {
                                      return (
                                        <div className="flex items-center justify-center opacity-40">
                                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                                        </div>
                                      );
                                    }
                                    const pendingCount = episodeTasks.filter(t => t.status === 'pending').length;
                                    const completedCount = episodeTasks.length - pendingCount;

                                    let statusColor = "text-green-500";
                                    if (pendingCount > 0 && completedCount > 0) {
                                      statusColor = "text-orange-500";
                                    } else if (pendingCount > 0) {
                                      statusColor = "text-red-500";
                                    }

                                    return (
                                      <div className="flex flex-col items-center justify-center gap-0.5 group relative">
                                        <div className="flex items-center gap-1">
                                          {pendingCount === 0 ? (
                                            <CheckCircle2 className={`w-4 h-4 ${statusColor}`} />
                                          ) : (
                                            <AlertCircle className={`w-4 h-4 ${statusColor}`} />
                                          )}
                                          <span className="text-xs font-bold">{episodeTasks.length}</span>
                                        </div>
                                        {/* Simple Tooltip on hover */}
                                        <div className="absolute bottom-full mb-2 hidden group-hover:block z-50 min-w-[150px] bg-popover text-popover-foreground p-2 rounded shadow-lg border border-border text-xs">
                                          <div className="space-y-1.5">
                                            {episodeTasks.map(t => (
                                              <div key={t.id} className="flex flex-col border-b border-border last:border-0 pb-1 last:pb-0">
                                                <span className={t.status === 'completed' ? 'line-through opacity-50' : ''}>
                                                  • {t.description}
                                                </span>
                                                {t.deadline && (
                                                  <span className="text-xs text-muted-foreground ml-2 italic">
                                                    Due: {format(new Date(t.deadline), "dd-MM-yyyy")}
                                                  </span>
                                                )}
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </TableCell>                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-1.5">
                                    {canReadMetadata && (
                                      <Link href={`/view/${episode.id}`}>
                                        <Button size="icon" variant="ghost" className="h-7 w-7" title="View Episode">
                                          <Eye className="w-3.5 h-3.5" />
                                        </Button>
                                      </Link>
                                    )}
                                    {canWriteMetadata && (
                                      <>
                                        <Link href={`/edit/${episode.id}`}>
                                          <Button size="icon" variant="ghost" className="h-7 w-7" title="Edit Episode">
                                            <Edit className="w-3.5 h-3.5" />
                                          </Button>
                                        </Link>
                                        <AlertDialog>
                                          <AlertDialogTrigger asChild>
                                            <Button
                                              size="icon"
                                              variant="ghost"
                                              className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                              title="Delete Episode"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </Button>
                                          </AlertDialogTrigger>
                                          <AlertDialogContent>
                                            <AlertDialogHeader>
                                              <AlertDialogTitle>Delete Episode?</AlertDialogTitle>
                                              <AlertDialogDescription>
                                                This will permanently delete episode <strong>{episode.id}</strong>. 
                                                This action cannot be undone.
                                              </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                                              <AlertDialogAction
                                                onClick={() => deleteEpisodeMutation.mutate(episode.id)}
                                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                              >
                                                Delete
                                              </AlertDialogAction>
                                            </AlertDialogFooter>
                                          </AlertDialogContent>
                                        </AlertDialog>
                                      </>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            ))}
        </div>
      )}

      {/* Quick Edit Dialog */}
      <Dialog open={quickEditOpen} onOpenChange={setQuickEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Quick Edit — {quickEditIds.length} Episodes</DialogTitle>
            <DialogDescription>
              Changes apply to all episodes in this season.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Series Title</label>
              <Input
                value={quickEditValues.title}
                onChange={(e) => setQuickEditValues(v => ({ ...v, title: e.target.value }))}
                placeholder="Series title..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Subs Status</label>
                <Select value={quickEditValues.subsStatus} onValueChange={(v) => setQuickEditValues(prev => ({ ...prev, subsStatus: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Incomplete">Incomplete</SelectItem>
                    <SelectItem value="Complete">Complete</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Category</label>
                <Select value={quickEditValues.category} onValueChange={(v) => setQuickEditValues(prev => ({ ...prev, category: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Series">Series</SelectItem>
                    <SelectItem value="Movie">Movie</SelectItem>
                    <SelectItem value="Documentary">Documentary</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Season Type</label>
                <Select value={quickEditValues.seasonType} onValueChange={(v) => setQuickEditValues(prev => ({ ...prev, seasonType: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Winter">Winter</SelectItem>
                    <SelectItem value="Summer">Summer</SelectItem>
                    <SelectItem value="Autumn">Autumn</SelectItem>
                    <SelectItem value="Spring">Spring</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Content Type</label>
                <Select value={quickEditValues.contentType} onValueChange={(v) => setQuickEditValues(prev => ({ ...prev, contentType: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Long Form">Long Form</SelectItem>
                    <SelectItem value="Short Form">Short Form</SelectItem>
                    <SelectItem value="program">Program</SelectItem>
                    <SelectItem value="commercial">Commercial</SelectItem>
                    <SelectItem value="Promo">Promo</SelectItem>
                    <SelectItem value="Filler">Filler</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuickEditOpen(false)}>Cancel</Button>
            <Button
              disabled={bulkEditMutation.isPending}
              onClick={() => {
                const data: Record<string, string | number> = {};
                if (quickEditValues.title) data.title = quickEditValues.title;
                if (quickEditValues.subsStatus) data.subsStatus = quickEditValues.subsStatus;
                if (quickEditValues.category) data.category = quickEditValues.category;
                if (quickEditValues.seasonType) data.seasonType = quickEditValues.seasonType;
                if (quickEditValues.contentType) data.contentType = quickEditValues.contentType;
                bulkEditMutation.mutate({ ids: quickEditIds, data }, {
                  onSuccess: () => setQuickEditOpen(false),
                });
              }}
            >
              {bulkEditMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Apply to {quickEditIds.length} Episodes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* XLSX Import Preview Dialog */}
      <Dialog open={!!importPreview} onOpenChange={(open) => { if (!open) setImportPreview(null); }}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Import Preview</DialogTitle>
            <DialogDescription>
              {importPreview?.rows.length || 0} rows parsed. Review before importing.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            {importPreview?.errors && importPreview.errors.length > 0 && (
              <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                <p className="text-sm font-medium text-destructive mb-1">Errors ({importPreview.errors.length})</p>
                {importPreview.errors.slice(0, 5).map((err, i) => (
                  <p key={i} className="text-xs text-destructive/80">{err}</p>
                ))}
                {importPreview.errors.length > 5 && (
                  <p className="text-xs text-muted-foreground mt-1">...and {importPreview.errors.length - 5} more</p>
                )}
              </div>
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">#</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Season</TableHead>
                  <TableHead>Episode</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Duration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {importPreview?.rows.slice(0, 50).map((row: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell className="text-muted-foreground text-xs">{i + 1}</TableCell>
                    <TableCell className="font-medium text-sm">{row.title}</TableCell>
                    <TableCell>{row.season || "-"}</TableCell>
                    <TableCell>{row.episode || "-"}</TableCell>
                    <TableCell>{row.category || "-"}</TableCell>
                    <TableCell className="font-mono text-xs">{row.duration || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {importPreview && importPreview.rows.length > 50 && (
              <p className="text-xs text-muted-foreground text-center py-2">Showing first 50 of {importPreview.rows.length} rows</p>
            )}
          </div>
          <DialogFooter className="pt-4 border-t">
            <Button variant="outline" onClick={() => setImportPreview(null)}>Cancel</Button>
            <Button
              onClick={() => {
                if (importPreview?.formData) {
                  importXlsxMutation.mutate(importPreview.formData);
                }
              }}
              disabled={importXlsxMutation.isPending}
            >
              {importXlsxMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Import {importPreview?.rows.length || 0} Records
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LinkLicenseForm({ onLink, existingLicenseIds }: { 
  onLink: (licenseId: string, range?: string) => void,
  existingLicenseIds: string[]
}) {
  const [selectedLicenseId, setSelectedLicenseId] = useState<string>("");
  const [seasonRange, setSeasonRange] = useState<string>("");

  const { data: licenses } = useQuery<License[]>({
    queryKey: ["/api/licenses"],
  });

  const availableLicenses = licenses?.filter(l => !existingLicenseIds.includes(l.id)) || [];

  return (
    <div className="flex flex-col gap-3 p-3 border rounded-md bg-muted/20">
      <p className="text-xs font-semibold uppercase text-muted-foreground">Link New License</p>
      <div className="flex gap-2">
        <Select value={selectedLicenseId} onValueChange={setSelectedLicenseId}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Select license..." />
          </SelectTrigger>
          <SelectContent>
            {availableLicenses.map((l) => (
              <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input 
          placeholder="Seasons (e.g. 1-4)" 
          className="w-[120px]"
          value={seasonRange}
          onChange={(e) => setSeasonRange(e.target.value)}
        />
        <Button 
          size="sm" 
          disabled={!selectedLicenseId}
          onClick={() => {
            onLink(selectedLicenseId, seasonRange);
            setSelectedLicenseId("");
            setSeasonRange("");
          }}
        >
          Link
        </Button>
      </div>
    </div>
  );
}
