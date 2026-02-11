import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { MetadataFile } from "@shared/schema";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface ExistingContentSelectorProps {
  onSelect: (selectedIds: string[]) => void;
  selectedIds: string[];
  licenseId?: string;
}

interface GroupedMetadata {
  [seriesTitle: string]: {
    [season: string]: MetadataFile[];
  };
}

export function ExistingContentSelector({
  onSelect,
  selectedIds,
  licenseId,
}: ExistingContentSelectorProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: files, isLoading } = useQuery<MetadataFile[]>({
    queryKey: ["/api/metadata"],
  });

  const { data: alreadyLinkedFiles } = useQuery<MetadataFile[]>({
    queryKey: [`/api/metadata?licenseId=${licenseId}`],
    enabled: !!licenseId,
  });

  const alreadyLinkedIds = useMemo(() => 
    new Set((alreadyLinkedFiles || []).map(f => f.id)),
    [alreadyLinkedFiles]
  );

  const groupedMetadata = useMemo(() => {
    if (!files) return {};
    
    const grouped: GroupedMetadata = {};
    files.forEach((file) => {
      const seriesTitle = file.seriesTitle || file.title || "Unknown Series";
      const season = file.season?.toString() || "No Season";
      
      if (!grouped[seriesTitle]) {
        grouped[seriesTitle] = {};
      }
      if (!grouped[seriesTitle][season]) {
        grouped[seriesTitle][season] = [];
      }
      grouped[seriesTitle][season].push(file);
    });

    // Sort episodes within seasons
    Object.values(grouped).forEach((seasons) => {
      Object.values(seasons).forEach((episodes) => {
        episodes.sort((a, b) => (a.episode || 0) - (b.episode || 0));
      });
    });

    return grouped;
  }, [files]);

  const filteredSeries = useMemo(() => {
    const titles = Object.keys(groupedMetadata);
    if (!searchTerm) return titles.sort();
    
    return titles
      .filter((title) => title.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort();
  }, [groupedMetadata, searchTerm]);

  const handleToggleFile = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelect(selectedIds.filter((i) => i !== id));
    } else {
      onSelect([...selectedIds, id]);
    }
  };

  const handleToggleSeason = (seriesTitle: string, season: string, checked: boolean) => {
    const seasonFileIds = groupedMetadata[seriesTitle][season].map((f) => f.id);
    if (checked) {
      onSelect(Array.from(new Set([...selectedIds, ...seasonFileIds])));
    } else {
      onSelect(selectedIds.filter((id) => !seasonFileIds.includes(id)));
    }
  };

  const handleToggleSeries = (seriesTitle: string, checked: boolean) => {
    const seriesFileIds: string[] = [];
    Object.values(groupedMetadata[seriesTitle]).forEach((seasonFiles) => {
      seasonFiles.forEach((f) => seriesFileIds.push(f.id));
    });

    if (checked) {
      onSelect(Array.from(new Set([...selectedIds, ...seriesFileIds])));
    } else {
      onSelect(selectedIds.filter((id) => !seriesFileIds.includes(id)));
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search series..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      <ScrollArea className="h-[400px] border rounded-md p-4">
        <Accordion type="multiple" className="w-full">
          {filteredSeries.map((seriesTitle) => {
            const seriesFiles: string[] = [];
            Object.values(groupedMetadata[seriesTitle]).forEach(s => s.forEach(f => seriesFiles.push(f.id)));
            const isSeriesAllSelected = seriesFiles.every(id => selectedIds.includes(id));
            const isSeriesSomeSelected = seriesFiles.some(id => selectedIds.includes(id)) && !isSeriesAllSelected;

            return (
              <AccordionItem key={seriesTitle} value={seriesTitle} className="border-none">
                <div className="flex items-center gap-2 py-2">
                  <Checkbox
                    id={`series-${seriesTitle}`}
                    checked={isSeriesAllSelected}
                    onCheckedChange={(checked) => handleToggleSeries(seriesTitle, !!checked)}
                    className={isSeriesSomeSelected ? "opacity-50" : ""}
                  />
                  <AccordionTrigger className="py-0 hover:no-underline flex-1">
                    <span className="text-sm font-medium">{seriesTitle}</span>
                  </AccordionTrigger>
                </div>
                <AccordionContent className="pl-6 pt-1">
                  <Accordion type="multiple" className="w-full">
                    {Object.keys(groupedMetadata[seriesTitle]).sort().map((season) => {
                      const seasonFiles = groupedMetadata[seriesTitle][season];
                      const seasonFileIds = seasonFiles.map(f => f.id);
                      const isSeasonAllSelected = seasonFileIds.every(id => selectedIds.includes(id));
                      const isSeasonSomeSelected = seasonFileIds.some(id => selectedIds.includes(id)) && !isSeasonAllSelected;

                      return (
                        <AccordionItem key={season} value={season} className="border-none">
                          <div className="flex items-center gap-2 py-1">
                            <Checkbox
                              id={`season-${seriesTitle}-${season}`}
                              checked={isSeasonAllSelected}
                              onCheckedChange={(checked) => handleToggleSeason(seriesTitle, season, !!checked)}
                              className={isSeasonSomeSelected ? "opacity-50" : ""}
                            />
                            <AccordionTrigger className="py-0 hover:no-underline flex-1">
                              <span className="text-sm">Season {season}</span>
                            </AccordionTrigger>
                          </div>
                          <AccordionContent className="pl-6 pt-2 grid grid-cols-2 md:grid-cols-3 gap-2">
                            {seasonFiles.map((file) => {
                              const isLinked = alreadyLinkedIds.has(file.id);
                              return (
                                <div key={file.id} className="flex items-center gap-2">
                                  <Checkbox
                                    id={`file-${file.id}`}
                                    checked={selectedIds.includes(file.id) || isLinked}
                                    disabled={isLinked}
                                    onCheckedChange={() => handleToggleFile(file.id)}
                                  />
                                  <label
                                    htmlFor={`file-${file.id}`}
                                    className={cn(
                                      "text-xs cursor-pointer truncate",
                                      isLinked && "text-muted-foreground italic"
                                    )}
                                    title={`${file.title} - Ep ${file.episode}${isLinked ? " (Already linked)" : ""}`}
                                  >
                                    Ep {file.episode}: {file.episodeTitle || file.title}
                                    {isLinked && " (Linked)"}
                                  </label>
                                </div>
                              );
                            })}
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </ScrollArea>
      
      <div className="text-sm text-muted-foreground">
        {selectedIds.length} items selected
      </div>
    </div>
  );
}
