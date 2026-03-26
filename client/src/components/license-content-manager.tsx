import { useState, useMemo } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { multiBatchCreateSchema, type MultiBatchCreate, type MetadataFile } from "@shared/schema";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExistingContentSelector } from "./existing-content-selector";
import { BatchCreateForm } from "./batch-create-form";
import { Loader2, Plus, Layers, Database, Trash2, ExternalLink } from "lucide-react";
import { Form } from "@/components/ui/form";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";

interface LicenseContentManagerProps {
  licenseId: string;
}

export function LicenseContentManager({ licenseId }: LicenseContentManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"existing" | "new">("existing");
  const [selectedExistingIds, setSelectedExistingIds] = useState<string[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: linkedFiles, isLoading: isLoadingLinked } = useQuery<MetadataFile[]>({
    queryKey: [`/api/metadata?licenseId=${licenseId}`],
    enabled: !!licenseId,
  });

  const groupedLinked = useMemo(() => {
    if (!linkedFiles) return {};
    const grouped: Record<string, Record<string, MetadataFile[]>> = {};
    linkedFiles.forEach(file => {
      const series = file.seriesTitle || file.title || "Unknown Series";
      const season = file.season?.toString() || "No Season";
      if (!grouped[series]) grouped[series] = {};
      if (!grouped[series][season]) grouped[series][season] = [];
      grouped[series][season].push(file);
    });
    // Sort episodes
    Object.values(grouped).forEach(seasons => {
      Object.values(seasons).forEach(episodes => {
        episodes.sort((a, b) => (a.episode || 0) - (b.episode || 0));
      });
    });
    return grouped;
  }, [linkedFiles]);

  const form = useForm<MultiBatchCreate>({
    resolver: zodResolver(multiBatchCreateSchema),
    defaultValues: {
      batches: [
        {
          title: "",
          category: "Series",
          seasons: [{ season: 1, episodeCount: 1, startEpisode: 1 }],
          channel: "ONS",
          draft: 1,
          licenseId: licenseId,
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "batches",
  });

  const linkMutation = useMutation({
    mutationFn: async (metadataIds: string[]) => {
      await apiRequest("PATCH", "/api/licenses/link-metadata", { licenseId, metadataIds });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Content linked to license successfully." });
      queryClient.invalidateQueries({ queryKey: [`/api/metadata?licenseId=${licenseId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/metadata"] });
      setIsOpen(false);
      setSelectedExistingIds([]);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to link metadata",
        variant: "destructive",
      });
    },
  });

  const unlinkMutation = useMutation({
    mutationFn: async (metadataIds: string[]) => {
      await apiRequest("PATCH", "/api/licenses/link-metadata", { licenseIdToRemove: licenseId, metadataIds });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Content unlinked from license." });
      queryClient.invalidateQueries({ queryKey: [`/api/metadata?licenseId=${licenseId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/metadata"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to unlink metadata",
        variant: "destructive",
      });
    },
  });

  const createBatchMutation = useMutation({
    mutationFn: async (data: MultiBatchCreate) => {
      await apiRequest("POST", "/api/metadata/multi-batch", data);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Batch content created and linked successfully." });
      queryClient.invalidateQueries({ queryKey: [`/api/metadata?licenseId=${licenseId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/metadata"] });
      setIsOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create batch content",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    if (activeTab === "existing") {
      if (selectedExistingIds.length === 0) {
        toast({ title: "No selection", description: "Please select at least one item.", variant: "destructive" });
        return;
      }
      linkMutation.mutate(selectedExistingIds);
    } else {
      form.handleSubmit((data) => {
        const dataWithLicense = {
          batches: data.batches.map(b => ({ ...b, licenseId }))
        };
        createBatchMutation.mutate(dataWithLicense);
      })();
    }
  };

  return (
    <div className="mt-8 border-t pt-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold">License Content</h2>
          <p className="text-sm text-muted-foreground">Manage metadata files associated with this license</p>
        </div>
        <Button onClick={() => setIsOpen(true)} type="button">
          <Plus className="w-4 h-4 mr-2" /> Add Content
        </Button>
      </div>

      <div className="space-y-4">
        {isLoadingLinked ? (
          <div className="flex justify-center p-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : !linkedFiles || linkedFiles.length === 0 ? (
          <Card className="border-dashed flex flex-col items-center justify-center p-8 text-muted-foreground">
            <p>No content linked to this license yet.</p>
          </Card>
        ) : (
          <Accordion type="multiple" className="w-full space-y-2">
            {Object.entries(groupedLinked).map(([series, seasons]) => (
              <AccordionItem key={series} value={series} className="border rounded-md px-4 bg-card">
                <div className="flex items-center justify-between">
                  <AccordionTrigger className="hover:no-underline py-4">
                    <div className="flex items-center gap-3 text-left">
                      <span className="font-semibold">{series}</span>
                      <Badge variant="secondary">{Object.values(seasons).flat().length} items</Badge>
                    </div>
                  </AccordionTrigger>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 px-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Unlink all ${Object.values(seasons).flat().length} items from this series?`)) {
                        unlinkMutation.mutate(Object.values(seasons).flat().map(f => f.id));
                      }
                    }}
                  >
                    <Trash2 className="w-4 h-4 mr-1" /> Unlink Series
                  </Button>
                </div>
                <AccordionContent className="pb-4">
                  <div className="space-y-4 pl-4 border-l-2 ml-2">
                    {Object.entries(seasons).map(([season, episodes]) => (
                      <div key={season} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-medium">Season {season}</h4>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive h-7 px-2 text-xs"
                            onClick={() => {
                              if (confirm(`Unlink all ${episodes.length} items from Season ${season}?`)) {
                                unlinkMutation.mutate(episodes.map(f => f.id));
                              }
                            }}
                          >
                            Unlink Season
                          </Button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                          {episodes.map(file => (
                            <div key={file.id} className="group flex items-center justify-between p-2 rounded bg-muted/50 text-xs border border-transparent hover:border-primary/20">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="font-mono text-[10px] text-muted-foreground w-12 flex-shrink-0">{file.id}</span>
                                <span className="truncate" title={file.episodeTitle || file.title}>
                                  Ep {file.episode}: {file.episodeTitle || file.title}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <a href={`/view/${file.id}`} target="_blank" rel="noopener noreferrer" className="p-1 hover:text-primary">
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                                <button
                                  onClick={() => unlinkMutation.mutate([file.id])}
                                  className="p-1 hover:text-destructive"
                                  title="Unlink file"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Add Content to License</DialogTitle>
            <DialogDescription>
              Select existing metadata files or create new ones to associate with this license.
            </DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="existing" className="flex items-center gap-2">
                <Database className="w-4 h-4" /> Add Existing
              </TabsTrigger>
              <TabsTrigger value="new" className="flex items-center gap-2">
                <Layers className="w-4 h-4" /> Create New
              </TabsTrigger>
            </TabsList>

            <TabsContent value="existing" className="flex-1 overflow-hidden pt-4">
              <ExistingContentSelector
                selectedIds={selectedExistingIds}
                onSelect={setSelectedExistingIds}
                licenseId={licenseId}
              />
            </TabsContent>

            <TabsContent value="new" className="flex-1 overflow-y-auto pt-4 space-y-6 px-1">
              <Form {...form}>
                <div className="space-y-6">
                  {fields.map((field, index) => (
                    <BatchCreateForm
                      key={field.id}
                      index={index}
                      form={form}
                      onRemove={fields.length > 1 ? () => remove(index) : undefined}
                      licenseId={licenseId}
                    />
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full border-dashed"
                    onClick={() => append({
                      title: "",
                      category: "Series",
                      seasons: [{ season: 1, episodeCount: 1, startEpisode: 1 }],
                      channel: "ONS",
                      draft: 1,
                      licenseId: licenseId,
                      breakTimes: [],
                      actors: [],
                      genre: [],
                    })}
                  >
                    <Plus className="w-4 h-4 mr-2" /> Add Another Batch
                  </Button>
                </div>
              </Form>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={linkMutation.isPending || createBatchMutation.isPending}>
              {(linkMutation.isPending || createBatchMutation.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {activeTab === "existing" ? `Add ${selectedExistingIds.length} Selected Items` : "Create & Add Batch"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
