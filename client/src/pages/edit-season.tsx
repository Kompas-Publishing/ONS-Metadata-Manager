import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { MetadataFile } from "@shared/schema";

// Matches the export XLSX column structure
const COLUMNS = [
  { key: "channel", label: "Channel", width: "w-20", type: "text" },
  { key: "id", label: "ID", width: "w-36", type: "readonly" },
  { key: "title", label: "Title", width: "w-40", type: "readonly" },
  { key: "description", label: "Description", width: "w-64", type: "text" },
  { key: "genre", label: "Genre", width: "w-40", type: "tags" },
  { key: "programRating", label: "Rating", width: "w-20", type: "select", options: ["AL", "6", "9", "12", "16", "18"] },
  { key: "productionCountry", label: "Country", width: "w-20", type: "text" },
  { key: "yearOfProduction", label: "Year", width: "w-20", type: "number" },
  { key: "catchUp", label: "CatchUp", width: "w-16", type: "bool" },
  { key: "season", label: "S", width: "w-12", type: "readonly" },
  { key: "episodeCount", label: "Eps", width: "w-12", type: "readonly" },
  { key: "episodeTitle", label: "Episode Title", width: "w-48", type: "text" },
  { key: "episode", label: "Ep#", width: "w-14", type: "readonly" },
  { key: "duration", label: "Duration", width: "w-24", type: "text" },
  { key: "segmented", label: "Seg", width: "w-14", type: "bool" },
  { key: "breakTimes", label: "Break Times", width: "w-36", type: "tags" },
  { key: "subtitles", label: "Subs", width: "w-14", type: "bool" },
  { key: "endCredits", label: "End Credits", width: "w-24", type: "text" },
  { key: "contentType", label: "Type", width: "w-28", type: "select", options: ["Long Form", "Short Form", "program", "commercial", "Promo", "Filler"] },
  { key: "seasonType", label: "Season Type", width: "w-24", type: "select", options: ["Winter", "Summer", "Autumn", "Spring"] },
  { key: "draft", label: "Draft", width: "w-14", type: "bool" },
  { key: "subsStatus", label: "Subs Status", width: "w-28", type: "select", options: ["Incomplete", "Complete"] },
  { key: "metadataTimesStatus", label: "Meta Status", width: "w-28", type: "select", options: ["Incomplete", "Complete"] },
  { key: "actors", label: "Actors", width: "w-48", type: "tags" },
  { key: "tags", label: "Tags", width: "w-36", type: "tags" },
] as const;

type ColDef = (typeof COLUMNS)[number];

function initFromFile(ep: MetadataFile): Record<string, any> {
  return {
    id: ep.id,
    channel: ep.channel || "ONS",
    title: ep.title || "",
    description: ep.description || "",
    genre: ep.genre || [],
    programRating: ep.programRating || "",
    productionCountry: ep.productionCountry || "",
    yearOfProduction: ep.yearOfProduction || "",
    catchUp: ep.catchUp ?? 0,
    season: ep.season || 0,
    episodeCount: ep.episodeCount || 0,
    episodeTitle: ep.episodeTitle || "",
    episode: ep.episode || 0,
    duration: ep.duration || "",
    segmented: ep.segmented ?? 0,
    breakTimes: ep.breakTimes || [],
    subtitles: ep.subtitles ?? 0,
    endCredits: ep.endCredits || "",
    contentType: ep.contentType || "",
    seasonType: ep.seasonType || "",
    draft: ep.draft ?? 0,
    subsStatus: ep.subsStatus || "Incomplete",
    metadataTimesStatus: ep.metadataTimesStatus || "Incomplete",
    actors: ep.actors || [],
    tags: ep.tags || [],
  };
}

function CellInput({ col, value, onChange }: { col: ColDef; value: any; onChange: (v: any) => void }) {
  const base = "h-7 text-xs rounded-none border-0 border-b border-transparent focus:border-primary focus:ring-0 bg-transparent px-2";

  if (col.type === "readonly") {
    return <span className="text-xs text-muted-foreground px-2 py-1 truncate block">{value}</span>;
  }
  if (col.type === "bool") {
    return (
      <div className="flex items-center justify-center h-7">
        <Checkbox checked={value === 1} onCheckedChange={(c) => onChange(c ? 1 : 0)} className="h-3.5 w-3.5" />
      </div>
    );
  }
  if (col.type === "select") {
    return (
      <Select value={value || ""} onValueChange={onChange}>
        <SelectTrigger className={`${base} h-7 text-xs`}>
          <SelectValue placeholder="-" />
        </SelectTrigger>
        <SelectContent>
          {(col as any).options.map((opt: string) => (
            <SelectItem key={opt} value={opt} className="text-xs">{opt}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  if (col.type === "number") {
    return (
      <Input
        type="number"
        value={value || ""}
        onChange={(e) => onChange(e.target.value ? parseInt(e.target.value) : "")}
        className={base}
      />
    );
  }
  if (col.type === "tags") {
    const arr = Array.isArray(value) ? value : [];
    return (
      <Input
        value={arr.join(", ")}
        onChange={(e) => onChange(e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean))}
        className={base}
        placeholder="comma, separated"
      />
    );
  }
  return (
    <Input
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      className={base}
    />
  );
}

export default function EditSeason() {
  const [, params] = useRoute("/edit-season/:title/:season");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const title = params?.title ? decodeURIComponent(params.title) : "";
  const seasonNum = params?.season ? parseInt(params.season) : 0;

  // Read file IDs from query string if provided (precise mode)
  const urlIds = new URLSearchParams(window.location.search).get("ids")?.split(",").filter(Boolean) || [];

  useEffect(() => {
    document.title = `Edit ${title} S${seasonNum} | ONS Broadcast Portal`;
  }, [title, seasonNum]);

  const [rows, setRows] = useState<Record<string, any>[]>([]);

  // Fetch all metadata, then filter by IDs if provided
  const { data: allFiles, isLoading: allLoading } = useQuery<MetadataFile[]>({
    queryKey: ["/api/metadata"],
    enabled: urlIds.length > 0,
  });

  // Fallback: fetch by title/season if no IDs provided
  const { data: seasonData, isLoading: seasonLoading } = useQuery<MetadataFile[]>({
    queryKey: ['/api/metadata/season', title, seasonNum],
    enabled: urlIds.length === 0 && !!title && seasonNum != null,
  });

  const isLoading = urlIds.length > 0 ? allLoading : seasonLoading;

  useEffect(() => {
    if (urlIds.length > 0 && allFiles) {
      const idSet = new Set(urlIds);
      const filtered = allFiles.filter(f => idSet.has(f.id));
      setRows(filtered.map(initFromFile));
    } else if (seasonData) {
      setRows(seasonData.map(initFromFile));
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

  const handleSave = () => {
    const editableKeys = COLUMNS.filter(c => c.type !== "readonly").map(c => c.key);
    const updates = rows.map((row) => {
      const data: Record<string, any> = {};
      editableKeys.forEach((key) => {
        const val = row[key];
        if (key === "catchUp" || key === "subtitles" || key === "segmented" || key === "draft") {
          data[key] = val ? 1 : 0;
        } else if (key === "yearOfProduction") {
          data[key] = val || null;
        } else {
          data[key] = val === "" ? null : val;
        }
      });
      return { id: row.id, data };
    });
    updateMutation.mutate(updates);
  };

  const updateCell = useCallback((rowIdx: number, key: string, value: any) => {
    setRows((prev) => {
      const next = [...prev];
      next[rowIdx] = { ...next[rowIdx], [key]: value };
      return next;
    });
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-1/3" />
        <Card className="p-6"><Skeleton className="h-96 w-full" /></Card>
      </div>
    );
  }

  if (!seasonData || seasonData.length === 0) {
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
        <Button onClick={handleSave} disabled={updateMutation.isPending} size="sm" className="gap-2">
          {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save All
        </Button>
      </div>

      {/* Spreadsheet grid */}
      <div className="border rounded-lg overflow-hidden bg-background">
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-200px)]">
          <table className="text-xs border-collapse" style={{ minWidth: "2400px" }}>
            <thead className="sticky top-0 z-20">
              <tr className="bg-muted">
                <th className="sticky left-0 z-30 bg-muted px-2 py-2 text-left font-semibold text-xs uppercase tracking-wider border-b border-r w-10">#</th>
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    className={`px-1 py-2 text-left font-semibold text-xs uppercase tracking-wider border-b border-r ${col.width}`}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIdx) => (
                <tr key={row.id} className="border-b hover:bg-muted/30 transition-colors group">
                  <td className="sticky left-0 z-10 bg-background group-hover:bg-muted/30 px-2 py-0 text-center border-r">
                    <Badge variant="outline" className="font-mono text-xs h-5">{row.episode}</Badge>
                  </td>
                  {COLUMNS.map((col) => (
                    <td key={col.key} className={`px-0 py-0 border-r ${col.width}`}>
                      <CellInput
                        col={col}
                        value={row[col.key]}
                        onChange={(v) => updateCell(rowIdx, col.key, v)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sticky save bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t px-6 py-3 flex items-center justify-between z-50">
        <p className="text-xs text-muted-foreground">
          <strong>{rows.length}</strong> episodes — <strong>{title}</strong> Season {seasonNum}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setLocation(`/browse/${encodeURIComponent(title)}`)}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending} className="gap-2">
            {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save All
          </Button>
        </div>
      </div>
    </div>
  );
}
