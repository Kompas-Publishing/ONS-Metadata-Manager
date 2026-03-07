import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Search, Film, ChevronRight, Calendar, Tv, Download, Edit, Eye, 
  LayoutGrid, List, ArrowUpDown, Trash2, AlertCircle, Upload, Loader2
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { format } from "date-fns";
import type { MetadataFile } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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

const handleDownload = (url: string) => {
  const link = document.createElement('a');
  link.href = url;
  link.click();
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
  const [selectedSeries, setSelectedSeries] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = useState<"newest" | "name" | "category" | "seasons" | "episodes">("newest");
  const [, setLocation] = useLocation();
  const { canWriteMetadata, canReadMetadata } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const importXlsxMutation = useMutation({
    mutationFn: async (files: FileList) => {
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append("files", files[i]);
      }
      const res = await fetch("/api/metadata/import-xlsx", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to import XLSX");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/metadata"] });
      toast({
        title: "Import successful",
        description: data.message,
      });
      if (data.errors && data.errors.length > 0) {
        data.errors.slice(0, 3).forEach((err: string) => {
          toast({
            title: "Import Warning",
            description: err,
            variant: "destructive",
          });
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Import failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleImportClick = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = ".xlsx";
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        importXlsxMutation.mutate(files);
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
        setSelectedSeries(null);
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

  const seriesGroups: { [key: string]: SeriesGroup } = {};
  
  if (files) {
    files.forEach((file) => {
      if (!file.title) return;
      
      if (!seriesGroups[file.title]) {
        seriesGroups[file.title] = {
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
      if (fileDate > seriesGroups[file.title].lastAddedAt) {
        seriesGroups[file.title].lastAddedAt = fileDate;
      }
      
      const seasonNum = file.season || 0;
      if (!seriesGroups[file.title].seasons[seasonNum]) {
        seriesGroups[file.title].seasons[seasonNum] = [];
        seriesGroups[file.title].seasonCount++;
      }
      
      seriesGroups[file.title].seasons[seasonNum].push(file);
      seriesGroups[file.title].episodeCount++;
    });
  }

  const filteredSeries = useMemo(() => {
    return Object.values(seriesGroups)
      .filter((series) =>
        series.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .sort((a, b) => {
        if (sortBy === "newest") {
          return b.lastAddedAt.getTime() - a.lastAddedAt.getTime();
        }
        if (sortBy === "name") {
          return a.title.localeCompare(b.title);
        }
        if (sortBy === "category") {
          return a.category.localeCompare(b.category);
        }
        if (sortBy === "seasons") {
          return b.seasonCount - a.seasonCount;
        }
        if (sortBy === "episodes") {
          return b.episodeCount - a.episodeCount;
        }
        return 0;
      });
  }, [seriesGroups, searchQuery, sortBy]);

  const selectedSeriesData = selectedSeries ? seriesGroups[selectedSeries] : null;

  const SortIcon = ({ column }: { column: typeof sortBy }) => {
    if (sortBy !== column) return <ArrowUpDown className="ml-2 h-4 w-4" />;
    return <ArrowUpDown className="ml-2 h-4 w-4 text-primary" />;
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-foreground">Browse Series</h1>
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
                disabled={importXlsxMutation.isPending}
                data-testid="button-import-xlsx"
              >
                {importXlsxMutation.isPending ? (
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
                    onClick={() => setSelectedSeries(series.title)}
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
                        <Badge variant="secondary">{series.category}</Badge>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
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
                        onClick={() => setSelectedSeries(series.title)}
                      >
                        <TableCell className="font-medium">{series.title}</TableCell>
                        <TableCell><Badge variant="outline">{series.category}</Badge></TableCell>
                        <TableCell>{series.seasonCount}</TableCell>
                        <TableCell>{series.episodeCount}</TableCell>
                        <TableCell className="text-muted-foreground">{format(series.lastAddedAt, "dd-MM-yyyy")}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setSelectedSeries(series.title); }}>
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
            onClick={() => setSelectedSeries(null)}
            data-testid="button-back-to-series"
          >
            Back to All Series
          </Button>

          <div>
            <h2 className="text-2xl font-semibold mb-2">{selectedSeriesData?.title}</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary">{selectedSeriesData?.category}</Badge>
              <Badge variant="outline">
                {selectedSeriesData?.seasonCount} {selectedSeriesData?.seasonCount === 1 ? "Season" : "Seasons"}
              </Badge>
              <div className="flex gap-2 ml-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownload(`/api/metadata/download/series/${encodeURIComponent(selectedSeriesData?.title || '')}/xml`)}
                  data-testid="button-download-series-xml"
                  className="gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download Series (XML)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownload(`/api/metadata/download/series/${encodeURIComponent(selectedSeriesData?.title || '')}/xlsx`)}
                  data-testid="button-download-series-xlsx"
                  className="gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download Series (XLSX)
                </Button>
                {canWriteMetadata && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete Series
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
                )}
              </div>
            </div>
          </div>

          {selectedSeriesData && Object.entries(selectedSeriesData.seasons)
            .sort(([a], [b]) => parseInt(a) - parseInt(b))
            .map(([seasonNum, episodes]) => (
              <Card key={seasonNum} className="p-6">
                <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
                  <h3 className="text-xl font-semibold">
                    Season {seasonNum === "0" ? "Unknown" : seasonNum}
                  </h3>
                  <div className="flex gap-2 flex-wrap">
                    {canWriteMetadata && (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLocation(`/edit-season/${encodeURIComponent(selectedSeriesData?.title || '')}/${seasonNum}`);
                        }}
                        data-testid={`button-edit-season-${seasonNum}`}
                        className="gap-2"
                      >
                        <Edit className="w-4 h-4" />
                        Edit All Episodes
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(`/api/metadata/download/season/${encodeURIComponent(selectedSeriesData?.title || '')}/${seasonNum}/xml`)}
                      data-testid={`button-download-season-${seasonNum}-xml`}
                      className="gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Download (XML)
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(`/api/metadata/download/season/${encodeURIComponent(selectedSeriesData?.title || '')}/${seasonNum}/xlsx`)}
                      data-testid={`button-download-season-${seasonNum}-xlsx`}
                      className="gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Download (XLSX)
                    </Button>
                    {canWriteMetadata && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                          className="gap-2"
                        >
                          <Link href={`/edit-season/${encodeURIComponent(selectedSeriesData?.title || '')}/${seasonNum}`}>
                            <Edit className="w-4 h-4" />
                            Batch Editor
                          </Link>
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="w-4 h-4" />
                              Delete Season
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
                      </>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  {episodes
                    .sort((a, b) => (a.episode || 0) - (b.episode || 0))
                    .map((episode) => (
                      <div
                        key={episode.id}
                        className={`p-4 border rounded-lg hover-elevate ${(episode.draft === 1 || episode.draft === '1' || episode.draft === true) ? '!bg-orange-100/80 !border-orange-400' : ''}`}
                        data-testid={`episode-${episode.id}`}
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-4 flex-1 min-w-0">
                            <span className="font-mono text-sm text-muted-foreground min-w-[80px] flex-shrink-0">
                              {episode.id}
                            </span>
                            {episode.episode && (
                              <span className="text-sm font-medium text-muted-foreground min-w-[60px] flex-shrink-0">
                                Ep {episode.episode}
                              </span>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-foreground font-medium">{episode.title}</span>
                                {episode.duration && (
                                  <span className="text-sm text-muted-foreground flex-shrink-0">
                                    {episode.duration}
                                  </span>
                                )}
                              </div>
                              {episode.episodeTitle && (
                                <p className="text-sm text-muted-foreground mt-1" data-testid={`episode-title-${episode.id}`}>
                                  {episode.episodeTitle}
                                </p>
                              )}
                              <div className="flex items-center gap-2 mt-2 flex-wrap">
                                {(episode.draft === 1 || episode.draft === '1' || episode.draft === true) && (
                                  <Badge variant="outline" className="border-orange-500 text-orange-700 bg-orange-50" data-testid={`episode-draft-${episode.id}`}>
                                    Draft
                                  </Badge>
                                )}
                                {episode.channel && (
                                  <Badge variant="outline" className="gap-1" data-testid={`episode-channel-${episode.id}`}>
                                    <Tv className="w-3 h-3" />
                                    {episode.channel}
                                  </Badge>
                                )}
                                {episode.programRating && (
                                  <Badge variant="secondary" data-testid={`episode-rating-${episode.id}`}>
                                    {episode.programRating}
                                  </Badge>
                                )}
                                {episode.dateStart && episode.dateEnd && (
                                  <Badge variant="outline" className="gap-1" data-testid={`episode-availability-${episode.id}`}>
                                    <Calendar className="w-3 h-3" />
                                    {format(new Date(episode.dateStart), "MMM d")} - {format(new Date(episode.dateEnd), "MMM d, yyyy")}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {canReadMetadata && (
                              <Link href={`/view/${episode.id}`}>
                                <Button size="sm" variant="outline" data-testid={`button-view-episode-${episode.id}`} title="View Episode">
                                  <Eye className="w-4 h-4" />
                                </Button>
                              </Link>
                            )}
                            {canWriteMetadata && (
                              <Link href={`/edit/${episode.id}`}>
                                <Button size="sm" variant="outline" data-testid={`button-edit-episode-${episode.id}`} title="Edit Episode">
                                  <Edit className="w-4 h-4" />
                                </Button>
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </Card>
            ))}
        </div>
      )}
    </div>
  );
}
