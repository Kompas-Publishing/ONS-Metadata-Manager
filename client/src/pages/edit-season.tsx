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

// All editable fields for the spreadsheet
interface EpisodeEdit {
  id: string;
  episode: number | null;
  episodeTitle: string;
  description: string;
  duration: string;
  channel: string;
  contentType: string;
  programRating: string;
  productionCountry: string;
  yearOfProduction: number | undefined;
  seasonType: string;
  genre: string[];
  actors: string[];
  catchUp: number;
  subtitles: number;
  segmented: number;
  draft: number;
  subsStatus: string;
  metadataTimesStatus: string;
  breakTimes: string[];
  endCredits: string;
  tags: string[];
}

function initFromFile(ep: MetadataFile): EpisodeEdit {
  return {
    id: ep.id,
    episode: ep.episode,
    episodeTitle: ep.episodeTitle || "",
    description: ep.description || "",
    duration: ep.duration || "",
    channel: ep.channel || "ONS",
    contentType: ep.contentType || "",
    programRating: ep.programRating || "",
    productionCountry: ep.productionCountry || "",
    yearOfProduction: ep.yearOfProduction || undefined,
    seasonType: ep.seasonType || "",
    genre: ep.genre || [],
    actors: ep.actors || [],
    catchUp: ep.catchUp ?? 0,
    subtitles: ep.subtitles ?? 0,
    segmented: ep.segmented ?? 0,
    draft: ep.draft ?? 0,
    subsStatus: ep.subsStatus || "Incomplete",
    metadataTimesStatus: ep.metadataTimesStatus || "Incomplete",
    breakTimes: ep.breakTimes || [],
    endCredits: ep.endCredits || "",
    tags: ep.tags || [],
  };
}

export default function EditSeason() {
  const [, params] = useRoute("/edit-season/:title/:season");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const title = params?.title ? decodeURIComponent(params.title) : "";
  const seasonNum = params?.season ? parseInt(params.season) : 0;

  useEffect(() => {
    document.title = `Edit ${title} Season ${seasonNum} | ONS Broadcast Portal`;
  }, [title, seasonNum]);

  const [episodes, setEpisodes] = useState<EpisodeEdit[]>([]);

  const { data: seasonData, isLoading } = useQuery<MetadataFile[]>({
    queryKey: ['/api/metadata/season', title, seasonNum],
    enabled: !!title && !!seasonNum,
  });

  useEffect(() => {
    if (seasonData) {
      setEpisodes(seasonData.map(initFromFile));
    }
  }, [seasonData]);

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
    const updates = episodes.map((ep) => ({
      id: ep.id,
      data: {
        episodeTitle: ep.episodeTitle || null,
        description: ep.description || null,
        duration: ep.duration || null,
        channel: ep.channel,
        contentType: ep.contentType,
        programRating: ep.programRating || null,
        productionCountry: ep.productionCountry || null,
        yearOfProduction: ep.yearOfProduction || null,
        seasonType: ep.seasonType || null,
        genre: ep.genre,
        actors: ep.actors,
        catchUp: ep.catchUp ? 1 : 0,
        subtitles: ep.subtitles ? 1 : 0,
        segmented: ep.segmented ? 1 : 0,
        draft: ep.draft ? 1 : 0,
        subsStatus: ep.subsStatus,
        metadataTimesStatus: ep.metadataTimesStatus,
        breakTimes: ep.breakTimes,
        endCredits: ep.endCredits || null,
        tags: ep.tags,
      },
    }));
    updateMutation.mutate(updates);
  };

  const updateEp = useCallback((id: string, field: keyof EpisodeEdit, value: any) => {
    setEpisodes((prev) =>
      prev.map((ep) => (ep.id === id ? { ...ep, [field]: value } : ep))
    );
  }, []);

  // Apply a value to ALL episodes for a given field
  const applyToAll = useCallback((field: keyof EpisodeEdit, value: any) => {
    setEpisodes((prev) => prev.map((ep) => ({ ...ep, [field]: value })));
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
    <div className="space-y-4 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setLocation(`/browse/${encodeURIComponent(title)}`)}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{title}</h1>
              <p className="text-sm text-muted-foreground">Season {seasonNum} — {episodes.length} episodes</p>
            </div>
          </div>
        </div>
        <Button onClick={handleSave} disabled={updateMutation.isPending} className="gap-2">
          {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save All Changes
        </Button>
      </div>

      {/* Spreadsheet */}
      <Card className="overflow-hidden border">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-muted/60 border-b">
                <th className="sticky left-0 z-20 bg-muted/60 px-3 py-2 text-left font-semibold text-xs uppercase tracking-wider w-16 border-r">Ep</th>
                <th className="px-2 py-2 text-left font-semibold text-xs uppercase tracking-wider min-w-[200px]">Episode Title</th>
                <th className="px-2 py-2 text-left font-semibold text-xs uppercase tracking-wider min-w-[250px]">Description</th>
                <th className="px-2 py-2 text-left font-semibold text-xs uppercase tracking-wider w-24">Duration</th>
                <th className="px-2 py-2 text-left font-semibold text-xs uppercase tracking-wider w-24">Channel</th>
                <th className="px-2 py-2 text-left font-semibold text-xs uppercase tracking-wider w-28">Content Type</th>
                <th className="px-2 py-2 text-left font-semibold text-xs uppercase tracking-wider w-20">Rating</th>
                <th className="px-2 py-2 text-left font-semibold text-xs uppercase tracking-wider w-28">Country</th>
                <th className="px-2 py-2 text-left font-semibold text-xs uppercase tracking-wider w-20">Year</th>
                <th className="px-2 py-2 text-left font-semibold text-xs uppercase tracking-wider w-28">Season Type</th>
                <th className="px-2 py-2 text-left font-semibold text-xs uppercase tracking-wider w-24">End Credits</th>
                <th className="px-2 py-2 text-left font-semibold text-xs uppercase tracking-wider w-28">Subs Status</th>
                <th className="px-2 py-2 text-left font-semibold text-xs uppercase tracking-wider w-28">Meta Status</th>
                <th className="px-2 py-2 text-center font-semibold text-xs uppercase tracking-wider w-14">Draft</th>
                <th className="px-2 py-2 text-center font-semibold text-xs uppercase tracking-wider w-14">CU</th>
                <th className="px-2 py-2 text-center font-semibold text-xs uppercase tracking-wider w-14">Subs</th>
                <th className="px-2 py-2 text-center font-semibold text-xs uppercase tracking-wider w-14">Seg</th>
              </tr>
            </thead>
            <tbody>
              {episodes.map((ep) => (
                <tr key={ep.id} className="border-b hover:bg-muted/20 transition-colors">
                  {/* Sticky episode number */}
                  <td className="sticky left-0 z-10 bg-background px-3 py-1 border-r">
                    <Badge variant="outline" className="font-mono text-xs">{ep.episode}</Badge>
                  </td>
                  {/* Episode title */}
                  <td className="px-1 py-1">
                    <Input
                      value={ep.episodeTitle}
                      onChange={(e) => updateEp(ep.id, "episodeTitle", e.target.value)}
                      className="h-8 text-xs border-transparent hover:border-input focus:border-input bg-transparent"
                      placeholder="Episode title..."
                    />
                  </td>
                  {/* Description */}
                  <td className="px-1 py-1">
                    <Input
                      value={ep.description}
                      onChange={(e) => updateEp(ep.id, "description", e.target.value)}
                      className="h-8 text-xs border-transparent hover:border-input focus:border-input bg-transparent"
                      placeholder="Description..."
                    />
                  </td>
                  {/* Duration */}
                  <td className="px-1 py-1">
                    <Input
                      value={ep.duration}
                      onChange={(e) => updateEp(ep.id, "duration", e.target.value)}
                      className="h-8 text-xs font-mono border-transparent hover:border-input focus:border-input bg-transparent"
                      placeholder="00:00:00"
                    />
                  </td>
                  {/* Channel */}
                  <td className="px-1 py-1">
                    <Input
                      value={ep.channel}
                      onChange={(e) => updateEp(ep.id, "channel", e.target.value)}
                      className="h-8 text-xs border-transparent hover:border-input focus:border-input bg-transparent"
                    />
                  </td>
                  {/* Content Type */}
                  <td className="px-1 py-1">
                    <Select value={ep.contentType} onValueChange={(v) => updateEp(ep.id, "contentType", v)}>
                      <SelectTrigger className="h-8 text-xs border-transparent hover:border-input bg-transparent">
                        <SelectValue placeholder="-" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Long Form">Long Form</SelectItem>
                        <SelectItem value="Short Form">Short Form</SelectItem>
                        <SelectItem value="program">Program</SelectItem>
                        <SelectItem value="commercial">Commercial</SelectItem>
                        <SelectItem value="Promo">Promo</SelectItem>
                        <SelectItem value="Filler">Filler</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  {/* Rating */}
                  <td className="px-1 py-1">
                    <Select value={ep.programRating} onValueChange={(v) => updateEp(ep.id, "programRating", v)}>
                      <SelectTrigger className="h-8 text-xs border-transparent hover:border-input bg-transparent">
                        <SelectValue placeholder="-" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AL">AL</SelectItem>
                        <SelectItem value="6">6</SelectItem>
                        <SelectItem value="9">9</SelectItem>
                        <SelectItem value="12">12</SelectItem>
                        <SelectItem value="16">16</SelectItem>
                        <SelectItem value="18">18</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  {/* Country */}
                  <td className="px-1 py-1">
                    <Input
                      value={ep.productionCountry}
                      onChange={(e) => updateEp(ep.id, "productionCountry", e.target.value)}
                      className="h-8 text-xs border-transparent hover:border-input focus:border-input bg-transparent"
                      placeholder="NL"
                    />
                  </td>
                  {/* Year */}
                  <td className="px-1 py-1">
                    <Input
                      type="number"
                      value={ep.yearOfProduction || ""}
                      onChange={(e) => updateEp(ep.id, "yearOfProduction", e.target.value ? parseInt(e.target.value) : undefined)}
                      className="h-8 text-xs border-transparent hover:border-input focus:border-input bg-transparent"
                      placeholder="2024"
                    />
                  </td>
                  {/* Season Type */}
                  <td className="px-1 py-1">
                    <Select value={ep.seasonType} onValueChange={(v) => updateEp(ep.id, "seasonType", v)}>
                      <SelectTrigger className="h-8 text-xs border-transparent hover:border-input bg-transparent">
                        <SelectValue placeholder="-" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Winter">Winter</SelectItem>
                        <SelectItem value="Summer">Summer</SelectItem>
                        <SelectItem value="Autumn">Autumn</SelectItem>
                        <SelectItem value="Spring">Spring</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  {/* End Credits */}
                  <td className="px-1 py-1">
                    <Input
                      value={ep.endCredits}
                      onChange={(e) => updateEp(ep.id, "endCredits", e.target.value)}
                      className="h-8 text-xs font-mono border-transparent hover:border-input focus:border-input bg-transparent"
                      placeholder="00:00:00"
                    />
                  </td>
                  {/* Subs Status */}
                  <td className="px-1 py-1">
                    <Select value={ep.subsStatus} onValueChange={(v) => updateEp(ep.id, "subsStatus", v)}>
                      <SelectTrigger className="h-8 text-xs border-transparent hover:border-input bg-transparent">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Incomplete">Incomplete</SelectItem>
                        <SelectItem value="Complete">Complete</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  {/* Meta Status */}
                  <td className="px-1 py-1">
                    <Select value={ep.metadataTimesStatus} onValueChange={(v) => updateEp(ep.id, "metadataTimesStatus", v)}>
                      <SelectTrigger className="h-8 text-xs border-transparent hover:border-input bg-transparent">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Incomplete">Incomplete</SelectItem>
                        <SelectItem value="Complete">Complete</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  {/* Draft */}
                  <td className="px-1 py-1 text-center">
                    <Checkbox checked={ep.draft === 1} onCheckedChange={(c) => updateEp(ep.id, "draft", c ? 1 : 0)} className="h-4 w-4" />
                  </td>
                  {/* Catch Up */}
                  <td className="px-1 py-1 text-center">
                    <Checkbox checked={ep.catchUp === 1} onCheckedChange={(c) => updateEp(ep.id, "catchUp", c ? 1 : 0)} className="h-4 w-4" />
                  </td>
                  {/* Subtitles */}
                  <td className="px-1 py-1 text-center">
                    <Checkbox checked={ep.subtitles === 1} onCheckedChange={(c) => updateEp(ep.id, "subtitles", c ? 1 : 0)} className="h-4 w-4" />
                  </td>
                  {/* Segmented */}
                  <td className="px-1 py-1 text-center">
                    <Checkbox checked={ep.segmented === 1} onCheckedChange={(c) => updateEp(ep.id, "segmented", c ? 1 : 0)} className="h-4 w-4" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Sticky save bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t p-4 flex items-center justify-between z-50">
        <p className="text-sm text-muted-foreground">
          Editing <strong>{episodes.length}</strong> episodes in <strong>{title}</strong> Season {seasonNum}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setLocation(`/browse/${encodeURIComponent(title)}`)}>Cancel</Button>
          <Button onClick={handleSave} disabled={updateMutation.isPending} className="gap-2">
            {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save All
          </Button>
        </div>
      </div>
    </div>
  );
}
