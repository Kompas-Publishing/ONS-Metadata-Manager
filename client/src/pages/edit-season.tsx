import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Save } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CountrySelect } from "@/components/country-select";
import { TagInput } from "@/components/tag-input";
import type { MetadataFile } from "@shared/schema";

interface EpisodeEdit {
  id: string;
  episode: number | null;
  title: string;
  channel?: string;
  seasonType?: string;
  contentType?: string;
  genre?: string[];
  programRating?: string;
  productionCountry?: string;
  yearOfProduction?: number;
  catchUp?: number;
  subtitles?: number;
  segmented?: number;
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
      setEpisodes(
        seasonData.map((ep) => ({
          id: ep.id,
          episode: ep.episode,
          title: ep.title,
          channel: ep.channel || "",
          seasonType: ep.seasonType || "",
          contentType: ep.contentType || "",
          genre: ep.genre || [],
          programRating: ep.programRating || "",
          productionCountry: ep.productionCountry || "",
          yearOfProduction: ep.yearOfProduction || undefined,
          catchUp: ep.catchUp ?? 0,
          subtitles: ep.subtitles ?? 0,
          segmented: ep.segmented ?? 0,
        }))
      );
    }
  }, [seasonData]);

  const updateMutation = useMutation({
    mutationFn: async (updates: Array<{ id: string; data: any }>) => {
      const normalized = updates.map(u => ({
        id: u.id,
        data: {
          channel: u.data.channel,
          seasonType: u.data.seasonType,
          contentType: u.data.contentType,
          genre: u.data.genre,
          programRating: u.data.programRating,
          productionCountry: u.data.productionCountry,
          yearOfProduction: u.data.yearOfProduction,
          catchUp: u.data.catchUp ? 1 : 0,
          segmented: u.data.segmented ? 1 : 0,
          subtitles: u.data.subtitles ? 1 : 0,
        }
      }));

      const response = await apiRequest('PATCH', '/api/metadata/bulk-update', {
        updates: normalized,
      });
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/metadata'] });
      queryClient.invalidateQueries({ queryKey: ['/api/metadata/season', title, seasonNum] });
      toast({
        title: "Success",
        description: `Updated ${data.count} episodes successfully`,
      });
      setLocation("/browse");
    },
    onError: (error: Error) => {
      toast({
        title: "Error updating episodes",
        description: error.message || "Failed to update episodes",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    const updates = episodes.map((ep) => ({
      id: ep.id,
      data: {
        channel: ep.channel,
        seasonType: ep.seasonType as "Winter" | "Summer" | "Autumn" | "Spring" | undefined,
        contentType: ep.contentType,
        genre: ep.genre,
        programRating: ep.programRating as "AL" | "6" | "9" | "12" | "16" | "18" | undefined,
        productionCountry: ep.productionCountry,
        yearOfProduction: ep.yearOfProduction,
        catchUp: ep.catchUp,
        subtitles: ep.subtitles,
        segmented: ep.segmented,
      },
    }));

    updateMutation.mutate(updates);
  };

  const updateEpisode = (id: string, field: keyof EpisodeEdit, value: any) => {
    setEpisodes((prev) =>
      prev.map((ep) => (ep.id === id ? { ...ep, [field]: value } : ep))
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-1/3" />
        <Card className="p-6">
          <Skeleton className="h-96 w-full" />
        </Card>
      </div>
    );
  }

  if (!seasonData || seasonData.length === 0) {
    return (
      <Card className="p-12 text-center">
        <p className="text-muted-foreground mb-4">No episodes found for this season</p>
        <Button onClick={() => setLocation("/browse")} data-testid="button-back-to-browse">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Browse
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">
            Edit Season {seasonNum}
          </h1>
          <p className="text-muted-foreground mt-2">
            {title} - Editing {episodes.length} episodes
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setLocation("/browse")}
            data-testid="button-cancel"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            data-testid="button-save-all"
          >
            <Save className="w-4 h-4 mr-2" />
            {updateMutation.isPending ? "Saving..." : "Save All Changes"}
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10">
              <TableRow>
                <TableHead className="w-20">Episode</TableHead>
                <TableHead className="w-32">Channel</TableHead>
                <TableHead className="w-32">Season Type</TableHead>
                <TableHead className="w-40">Content Type</TableHead>
                <TableHead className="w-32">Rating</TableHead>
                <TableHead className="w-48">Country</TableHead>
                <TableHead className="w-32">Year</TableHead>
                <TableHead className="w-24">Catch Up</TableHead>
                <TableHead className="w-24">Subtitles</TableHead>
                <TableHead className="w-24">Segmented</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {episodes.map((ep, index) => (
                <TableRow key={ep.id} data-testid={`row-episode-${ep.episode}`}>
                  <TableCell className="font-medium">
                    <Badge variant="outline">{ep.episode}</Badge>
                  </TableCell>
                  <TableCell>
                    <Input
                      value={ep.channel || ""}
                      onChange={(e) => updateEpisode(ep.id, "channel", e.target.value)}
                      placeholder="Channel"
                      className="min-h-8"
                      data-testid={`input-channel-${index}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={ep.seasonType}
                      onValueChange={(value) => updateEpisode(ep.id, "seasonType", value)}
                    >
                      <SelectTrigger className="min-h-8" data-testid={`select-season-type-${index}`}>
                        <SelectValue placeholder="Season" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Winter">Winter</SelectItem>
                        <SelectItem value="Summer">Summer</SelectItem>
                        <SelectItem value="Autumn">Autumn</SelectItem>
                        <SelectItem value="Spring">Spring</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={ep.contentType}
                      onValueChange={(value) => updateEpisode(ep.id, "contentType", value)}
                    >
                      <SelectTrigger className="min-h-8" data-testid={`select-content-type-${index}`}>
                        <SelectValue placeholder="Content Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="program">Program</SelectItem>
                        <SelectItem value="commercial">Commercial</SelectItem>
                        {/* <SelectItem value="Short Form">Short Form</SelectItem>
                        <SelectItem value="Long form format">
                          Long Form
                        </SelectItem>
                        <SelectItem value="Promo">Promo</SelectItem>
                        <SelectItem value="Campaign">Campaign</SelectItem>
                        <SelectItem value="Commercial">Commercial</SelectItem>
                        <SelectItem value="Filler">Filler</SelectItem>
                        <SelectItem value="OSD">OSD</SelectItem>
                        <SelectItem value="Ad">Ad</SelectItem>
                        <SelectItem value="bumper">bumper</SelectItem>
                        <SelectItem value="Ident">Ident</SelectItem> */}
                        </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={ep.programRating}
                      onValueChange={(value) => updateEpisode(ep.id, "programRating", value)}
                    >
                      <SelectTrigger className="min-h-8" data-testid={`select-program-rating-${index}`}>
                        <SelectValue placeholder="Rating" />
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
                  </TableCell>
                  <TableCell>
                    <CountrySelect
                      value={ep.productionCountry || ""}
                      onChange={(value) => updateEpisode(ep.id, "productionCountry", value)}
                      placeholder="Country"
                      data-testid={`select-production-country-${index}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={ep.yearOfProduction || ""}
                      onChange={(e) =>
                        updateEpisode(
                          ep.id,
                          "yearOfProduction",
                          e.target.value ? parseInt(e.target.value) : undefined
                        )
                      }
                      placeholder="Year"
                      className="min-h-8"
                      data-testid={`input-year-${index}`}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center">
                      <Checkbox
                        checked={ep.catchUp === 1}
                        onCheckedChange={(checked) =>
                          updateEpisode(ep.id, "catchUp", checked ? 1 : 0)
                        }
                        data-testid={`checkbox-catchup-${index}`}
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center">
                      <Checkbox
                        checked={ep.subtitles === 1}
                        onCheckedChange={(checked) =>
                          updateEpisode(ep.id, "subtitles", checked ? 1 : 0)
                        }
                        data-testid={`checkbox-subtitles-${index}`}
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center">
                      <Checkbox
                        checked={ep.segmented === 1}
                        onCheckedChange={(checked) =>
                          updateEpisode(ep.id, "segmented", checked ? 1 : 0)
                        }
                        data-testid={`checkbox-segmented-${index}`}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => setLocation("/browse")}
          data-testid="button-cancel-bottom"
        >
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={updateMutation.isPending}
          data-testid="button-save-all-bottom"
        >
          <Save className="w-4 h-4 mr-2" />
          {updateMutation.isPending ? "Saving..." : "Save All Changes"}
        </Button>
      </div>
    </div>
  );
}
