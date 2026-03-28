import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowLeft, Save, Loader2, Plus } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { MetadataFile } from "@shared/schema";

// Column definitions — tooltip shows help text on hover
const COLUMNS: { key: string; label: string; width: string; type: "text" | "bool" | "readonly" | "tags"; tooltip?: string }[] = [
  { key: "channel", label: "Channel", width: "w-24", type: "text", tooltip: "Broadcasting channel (e.g. ONS)" },
  { key: "id", label: "ID", width: "w-32", type: "readonly", tooltip: "Auto-generated file ID" },
  { key: "title", label: "Title", width: "w-44", type: "text", tooltip: "Series title (Clipnaam)" },
  { key: "description", label: "Description", width: "w-64", type: "text", tooltip: "Episode description (nl)" },
  { key: "genre", label: "Genre", width: "w-40", type: "tags", tooltip: "Pipe-separated: Action|Drama|Comedy" },
  { key: "programRating", label: "Rating", width: "w-20", type: "text", tooltip: "AL, 6, 9, 12, 16, 18" },
  { key: "productionCountry", label: "Country", width: "w-24", type: "text", tooltip: "Production country code (e.g. NL, DE, US)" },
  { key: "seriesTitle", label: "Series", width: "w-40", type: "text", tooltip: "Series title (if different from Title)" },
  { key: "yearOfProduction", label: "Year", width: "w-20", type: "text", tooltip: "Year of production (e.g. 2024)" },
  { key: "catchUp", label: "CU", width: "w-12", type: "bool", tooltip: "CatchUp availability" },
  { key: "season", label: "S", width: "w-14", type: "text", tooltip: "Season number" },
  { key: "episodeTitle", label: "Episode Title", width: "w-48", type: "text", tooltip: "Episode-specific title" },
  { key: "episode", label: "Ep#", width: "w-14", type: "text", tooltip: "Episode number" },
  { key: "episodeDescription", label: "Ep Description", width: "w-64", type: "text", tooltip: "Episode-specific description" },
  { key: "duration", label: "Duration", width: "w-24", type: "text", tooltip: "Format: HH:MM:SS" },
  { key: "segmented", label: "Seg", width: "w-12", type: "bool", tooltip: "Segmented content" },
  { key: "breakTimes", label: "Break Times", width: "w-40", type: "tags", tooltip: "Comma-separated: 00:12:30, 00:25:00" },
  { key: "dateStart", label: "Start", width: "w-28", type: "text", tooltip: "Start date (YYYY-MM-DD)" },
  { key: "dateEnd", label: "End", width: "w-28", type: "text", tooltip: "End date (YYYY-MM-DD)" },
  { key: "subtitles", label: "Subs", width: "w-12", type: "bool", tooltip: "Subtitles available" },
  { key: "subtitlesId", label: "Subs ID", width: "w-28", type: "text", tooltip: "Subtitle file identifier" },
  { key: "contentType", label: "Type", width: "w-28", type: "text", tooltip: "Long Form, Short Form, program, commercial, Promo, Filler" },
  { key: "seasonType", label: "Season", width: "w-24", type: "text", tooltip: "Winter, Summer, Autumn, Spring" },
  { key: "subsStatus", label: "Subs Status", width: "w-28", type: "text", tooltip: "Incomplete or Complete" },
  { key: "tags", label: "Tags", width: "w-36", type: "tags", tooltip: "Comma-separated tags" },
];

function initFromFile(ep: MetadataFile): Record<string, any> {
  return {
    id: ep.id,
    _isNew: false,
    channel: ep.channel || "ONS",
    title: ep.title || "",
    description: ep.description || "",
    genre: ep.genre || [],
    programRating: ep.programRating || "",
    productionCountry: ep.productionCountry || "",
    seriesTitle: ep.seriesTitle || "",
    yearOfProduction: ep.yearOfProduction?.toString() || "",
    catchUp: ep.catchUp ?? 0,
    season: ep.season?.toString() || "",
    episodeTitle: ep.episodeTitle || "",
    episode: ep.episode?.toString() || "",
    episodeDescription: ep.episodeDescription || "",
    duration: ep.duration || "",
    segmented: ep.segmented ?? 0,
    breakTimes: ep.breakTimes || [],
    dateStart: ep.dateStart ? new Date(ep.dateStart).toISOString().split("T")[0] : "",
    dateEnd: ep.dateEnd ? new Date(ep.dateEnd).toISOString().split("T")[0] : "",
    subtitles: ep.subtitles ?? 0,
    subtitlesId: ep.subtitlesId || "",
    contentType: ep.contentType || "",
    seasonType: ep.seasonType || "",
    subsStatus: ep.subsStatus || "Incomplete",
    tags: ep.tags || [],
  };
}

function newEmptyRow(): Record<string, any> {
  return {
    id: "",
    _isNew: true,
    channel: "ONS",
    title: "",
    description: "",
    genre: [],
    programRating: "",
    productionCountry: "",
    seriesTitle: "",
    yearOfProduction: "",
    catchUp: 0,
    season: "",
    episodeTitle: "",
    episode: "",
    episodeDescription: "",
    duration: "",
    segmented: 0,
    breakTimes: [],
    dateStart: "",
    dateEnd: "",
    subtitles: 0,
    subtitlesId: "",
    contentType: "",
    seasonType: "",
    subsStatus: "Incomplete",
    tags: [],
  };
}

export default function EditSeason() {
  const [, params] = useRoute("/edit-season/:title/:season");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const title = params?.title ? decodeURIComponent(params.title) : "";
  const seasonNum = params?.season ? parseInt(params.season) : 0;
  const urlIds = new URLSearchParams(window.location.search).get("ids")?.split(",").filter(Boolean) || [];

  useEffect(() => {
    document.title = `Edit ${title} S${seasonNum} | ONS Broadcast Portal`;
  }, [title, seasonNum]);

  const [rows, setRows] = useState<Record<string, any>[]>([]);

  const { data: allFiles, isLoading: allLoading } = useQuery<MetadataFile[]>({
    queryKey: ["/api/metadata"],
    enabled: urlIds.length > 0,
  });

  const { data: seasonData, isLoading: seasonLoading } = useQuery<MetadataFile[]>({
    queryKey: ['/api/metadata/season', title, seasonNum],
    enabled: urlIds.length === 0 && !!title && seasonNum != null,
  });

  const isLoading = urlIds.length > 0 ? allLoading : seasonLoading;

  const sortByEpisode = (rows: Record<string, any>[]) =>
    [...rows].sort((a, b) => (parseInt(a.episode) || 0) - (parseInt(b.episode) || 0));

  useEffect(() => {
    if (urlIds.length > 0 && allFiles) {
      const idSet = new Set(urlIds);
      setRows(sortByEpisode(allFiles.filter(f => idSet.has(f.id)).map(initFromFile)));
    } else if (seasonData) {
      setRows(sortByEpisode(seasonData.map(initFromFile)));
    }
  }, [allFiles, seasonData]);

  const updateMutation = useMutation({
    mutationFn: async (updates: Array<{ id: string; data: any }>) => {
      const response = await apiRequest('PATCH', '/api/metadata/bulk-update', { updates });
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/metadata'] });
      queryClient.invalidateQueries({ queryKey: ['/api/metadata/season', title, seasonNum] });
      toast({ title: "Saved", description: `Updated ${data.count} episodes` });
    },
    onError: (error: Error) => {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/metadata', data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/metadata'] });
    },
  });

  const handleSave = async () => {
    const editableKeys = COLUMNS.filter(c => c.type !== "readonly").map(c => c.key);

    // Separate existing rows from new rows
    const existingUpdates = rows.filter(r => !r._isNew).map((row) => {
      const data: Record<string, any> = {};
      editableKeys.forEach((key) => {
        const val = row[key];
        if (key === "catchUp" || key === "subtitles" || key === "segmented") {
          data[key] = val ? 1 : 0;
        } else if (key === "yearOfProduction" || key === "season" || key === "episode") {
          data[key] = val ? parseInt(val) : null;
        } else if (key === "dateStart" || key === "dateEnd") {
          data[key] = val ? new Date(val).toISOString() : null;
        } else {
          data[key] = val === "" ? null : val;
        }
      });
      return { id: row.id, data };
    });

    // Create new rows
    const newRows = rows.filter(r => r._isNew && r.title);
    for (const row of newRows) {
      const data: Record<string, any> = {};
      editableKeys.forEach((key) => {
        const val = row[key];
        if (key === "catchUp" || key === "subtitles" || key === "segmented") {
          data[key] = val ? 1 : 0;
        } else if (key === "yearOfProduction" || key === "season" || key === "episode") {
          data[key] = val ? parseInt(val) : null;
        } else if (key === "dateStart" || key === "dateEnd") {
          data[key] = val ? new Date(val).toISOString() : null;
        } else {
          data[key] = val === "" ? null : val;
        }
      });
      await createMutation.mutateAsync(data);
    }

    if (existingUpdates.length > 0) {
      updateMutation.mutate(existingUpdates);
    } else if (newRows.length > 0) {
      toast({ title: "Created", description: `${newRows.length} new episodes created` });
    }
  };

  const updateCell = useCallback((rowIdx: number, key: string, value: any) => {
    setRows((prev) => {
      const next = [...prev];
      next[rowIdx] = { ...next[rowIdx], [key]: value };
      return next;
    });
  }, []);

  const addRow = async () => {
    const lastRow = rows[rows.length - 1];
    const row = newEmptyRow();
    // Pre-fill from context
    row.title = lastRow?.title || title;
    row.seriesTitle = lastRow?.seriesTitle || title;
    row.season = lastRow?.season || seasonNum.toString();
    row.channel = lastRow?.channel || "ONS";
    row.episode = lastRow?.episode ? (parseInt(lastRow.episode) + 1).toString() : "";
    // Auto-generate an ID
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch("/api/metadata/next-id", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const id = await res.json();
        row.id = id;
      }
    } catch { /* ignore — will be generated server-side on save */ }
    setRows((prev) => [...prev, row]);
  };

  const noData = urlIds.length > 0
    ? (!allFiles || allFiles.filter(f => new Set(urlIds).has(f.id)).length === 0)
    : (!seasonData || seasonData.length === 0);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-1/3" />
        <Card className="p-6"><Skeleton className="h-96 w-full" /></Card>
      </div>
    );
  }

  if (noData && rows.length === 0) {
    return (
      <Card className="p-12 text-center">
        <p className="text-muted-foreground mb-4">No episodes found for this season</p>
        <Button onClick={() => setLocation(`/browse/${encodeURIComponent(title)}`)}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Series
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-3 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation(`/browse/${encodeURIComponent(title)}`)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">{title}</h1>
            <p className="text-xs text-muted-foreground">Season {seasonNum} — {rows.length} episodes</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={updateMutation.isPending || createMutation.isPending} size="sm" className="gap-2">
          {(updateMutation.isPending || createMutation.isPending) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save All
        </Button>
      </div>

      {/* Spreadsheet grid */}
      <div className="border rounded-lg overflow-hidden bg-background">
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-200px)]">
          <table className="text-xs border-collapse" style={{ minWidth: "2800px" }}>
            <thead className="sticky top-0 z-20">
              <tr className="bg-muted">
                <th className="sticky left-0 z-30 bg-muted px-2 py-2 text-left font-semibold text-xs uppercase tracking-wider border-b border-r w-10">#</th>
                {COLUMNS.map((col) => (
                  <th key={col.key} className={`px-1 py-2 text-left font-semibold text-xs uppercase tracking-wider border-b border-r ${col.width}`}>
                    {col.tooltip ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help border-b border-dotted border-muted-foreground/40">{col.label}</span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs max-w-[200px]">
                          {col.tooltip}
                        </TooltipContent>
                      </Tooltip>
                    ) : col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIdx) => (
                <tr key={row.id || `new-${rowIdx}`} className="border-b hover:bg-muted/30 transition-colors group">
                  <td className="sticky left-0 z-10 bg-background group-hover:bg-muted/30 px-2 py-0 text-center border-r">
                    {row._isNew ? (
                      <Badge className="bg-green-100 text-green-700 border-none text-xs h-5">NEW</Badge>
                    ) : (
                      <Badge variant="outline" className="font-mono text-xs h-5">{row.episode || "—"}</Badge>
                    )}
                  </td>
                  {COLUMNS.map((col) => (
                    <td key={col.key} className={`px-0 py-0 border-r ${col.width}`}>
                      {col.type === "readonly" && !row._isNew ? (
                        <span className="text-xs text-muted-foreground px-2 py-1 truncate block">{row[col.key]}</span>
                      ) : col.type === "bool" ? (
                        <div className="flex items-center justify-center h-7">
                          <Checkbox
                            checked={row[col.key] === 1}
                            onCheckedChange={(c) => updateCell(rowIdx, col.key, c ? 1 : 0)}
                            className="h-3.5 w-3.5"
                          />
                        </div>
                      ) : col.type === "tags" ? (
                        <input
                          className="w-full h-7 text-xs bg-transparent px-2 border-0 border-b border-transparent focus:border-primary focus:outline-none resize-x"
                          value={Array.isArray(row[col.key]) ? row[col.key].join(", ") : row[col.key] || ""}
                          onChange={(e) => updateCell(rowIdx, col.key, e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean))}
                          placeholder="comma, separated"
                        />
                      ) : (
                        <input
                          className="w-full h-7 text-xs bg-transparent px-2 border-0 border-b border-transparent focus:border-primary focus:outline-none"
                          style={{ minWidth: "60px", resize: "horizontal", overflow: "hidden" }}
                          value={row[col.key] || ""}
                          onChange={(e) => updateCell(rowIdx, col.key, e.target.value)}
                        />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Add row button */}
        <div className="border-t p-2 bg-muted/20">
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground hover:text-foreground" onClick={addRow}>
            <Plus className="w-3.5 h-3.5" />
            Add episode
          </Button>
        </div>
      </div>

      {/* Sticky save bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t px-6 py-3 flex items-center justify-between z-50">
        <p className="text-xs text-muted-foreground">
          <strong>{rows.filter(r => !r._isNew).length}</strong> episodes
          {rows.filter(r => r._isNew).length > 0 && <> + <strong>{rows.filter(r => r._isNew).length}</strong> new</>}
          {" — "}<strong>{title}</strong> Season {seasonNum}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setLocation(`/browse/${encodeURIComponent(title)}`)}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending || createMutation.isPending} className="gap-2">
            {(updateMutation.isPending || createMutation.isPending) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save All
          </Button>
        </div>
      </div>
    </div>
  );
}
