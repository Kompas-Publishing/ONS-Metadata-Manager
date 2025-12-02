import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Film, ChevronRight, Calendar, Tv, Download, Edit, Eye } from "lucide-react";
import { Link, useLocation } from "wouter";
import { format } from "date-fns";
import type { MetadataFile } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";

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
  seasons: { [key: number]: MetadataFile[] };
}

export default function Browse() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSeries, setSelectedSeries] = useState<string | null>(null);
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  
  const canWrite = user?.canWrite === 1;
  const canRead = user?.canRead === 1;

  const { data: files, isLoading } = useQuery<MetadataFile[]>({
    queryKey: ["/api/metadata"],
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
          seasons: {},
        };
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

  const filteredSeries = Object.values(seriesGroups).filter((series) =>
    series.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedSeriesData = selectedSeries ? seriesGroups[selectedSeries] : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-foreground">Browse Series</h1>
        <p className="text-muted-foreground mt-2">
          Browse and filter your metadata files by series and season
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search series..."
          className="pl-10"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          data-testid="input-search-series"
        />
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredSeries.map((series) => (
                <Card
                  key={series.title}
                  className="p-6 hover-elevate cursor-pointer"
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
                    <Badge variant="secondary" className="mt-2">{series.category}</Badge>
                  </div>
                </Card>
              ))}
            </div>
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
                  </div>
                </div>
                <div className="space-y-2">
                  {episodes
                    .sort((a, b) => (a.episode || 0) - (b.episode || 0))
                    .map((episode) => (
                      <div
                        key={episode.id}
                        className={`p-4 border rounded-lg hover-elevate ${episode.draft === 1 ? '!bg-orange-100/80 !border-orange-400' : ''}`}
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
                                {episode.draft === 1 && (
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
                            {(canRead || canWrite) && (
                              <Link href={`/view/${episode.id}`}>
                                <Button size="sm" variant="outline" data-testid={`button-view-episode-${episode.id}`} title="View Episode">
                                  <Eye className="w-4 h-4" />
                                </Button>
                              </Link>
                            )}
                            {canWrite && (
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
