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
  Link2, Info, ShieldCheck
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { format } from "date-fns";
import type { MetadataFile, Series, License, Task } from "@shared/schema";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

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

  const [openSeasons, setOpenSeasons] = useState<Record<number, boolean>>({});

  const toggleSeason = (season: number) => {
    setOpenSeasons((prev) => ({
      ...prev,
      [season]: !prev[season],
    }));
  };

  const { data: seriesDetails, isLoading: isSeriesDetailsLoading } = useQuery<Series & { 
    licenses: (License & { seasonRange: string | null })[],
    tasks: (Task & { metadataFile: MetadataFile })[]
  }>({
    queryKey: [`/api/series/by-title/${encodeURIComponent(selectedSeries || "")}`],
    enabled: !!selectedSeries,
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
                        {series.category && series.category !== "Unknown" && (
                          <Badge variant="secondary">{series.category}</Badge>
                        )}
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
                          Official Website <ExternalLink className="w-3 h-3" />
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
                    <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4" /> Associated Licenses
                    </h4>
                    <div className="space-y-2">
                      {seriesDetails?.licenses && seriesDetails.licenses.length > 0 ? (
                        seriesDetails.licenses.map((license) => (
                          <div key={license.id} className="flex flex-col border-l-2 border-primary/20 pl-3 py-1">
                            <Link href={`/licenses/${license.id}`} className="text-sm font-medium hover:underline flex items-center gap-1.5">
                              {license.name}
                              <ExternalLink className="w-3 h-3 text-muted-foreground" />
                            </Link>
                            <span className="text-xs text-muted-foreground">
                              {license.seasonRange ? `Seasons: ${license.seasonRange}` : "All Seasons"}
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground italic">No licenses linked to this series</p>
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
                        <Badge key={task.id} variant="outline" className="bg-orange-50 border-orange-200 text-orange-800 text-[10px] py-0.5">
                          {task.metadataFile?.episode ? `E${task.metadataFile.episode}: ` : ""}{task.description}
                        </Badge>
                      ))}
                      {seriesDetails.tasks.length > 5 && (
                        <Badge variant="outline" className="text-[10px] py-0.5">
                          +{seriesDetails.tasks.length - 5} more
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </div>

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
                      disabled={importXlsxMutation.isPending}
                    >
                      {importXlsxMutation.isPending ? (
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
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="p-0 h-8 w-8">
                          {openSeasons[parseInt(seasonNum)] ?? true ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                      <h3 className="text-xl font-semibold">
                        Season {seasonNum === "0" ? "Unknown" : seasonNum}
                      </h3>
                      <Badge variant="outline" className="ml-2">
                        {episodes.length} {episodes.length === 1 ? "Episode" : "Episodes"}
                      </Badge>
                    </div>
                    <div className="flex gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
                      {canWriteMetadata && (
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                          className="gap-2 h-8"
                        >
                          <Link href={`/edit-season/${encodeURIComponent(selectedSeriesData?.title || '')}/${seasonNum}`}>
                            <Edit className="w-3.5 h-3.5" />
                            Batch Editor
                          </Link>
                        </Button>
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
                                className={(episode.draft === 1 || episode.draft === '1' || episode.draft === true) ? 'bg-orange-50/50 hover:bg-orange-100/50' : ''}
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
                                    {(episode.draft === 1 || episode.draft === '1' || episode.draft === true) && (
                                      <span className="text-[10px] text-orange-600 font-semibold uppercase">Draft</span>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                  {episode.duration || "-"}
                                </TableCell>
                                <TableCell>
                                  <Badge 
                                    variant="outline" 
                                    className={`text-[10px] font-normal px-1.5 py-0 ${
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
                                    className={`text-[10px] font-normal px-1.5 py-0 ${
                                      episode.metadataTimesStatus === 'Complete' 
                                        ? 'bg-green-50 text-green-700 border-green-200' 
                                        : 'bg-orange-50 text-orange-700 border-orange-200'
                                    }`}
                                  >
                                    {episode.metadataTimesStatus === 'Complete' ? 'Times OK' : 'Times Incl.'}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  {seriesDetails?.tasks?.some(t => t.metadataFileId === episode.id) ? (
                                    <div className="flex items-center justify-center">
                                      <AlertCircle className="w-4 h-4 text-orange-500" />
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-center opacity-20">
                                      <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
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
    </div>
  );
}
