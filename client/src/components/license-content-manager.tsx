import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { multiBatchCreateSchema, type MultiBatchCreate } from "@shared/schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExistingContentSelector } from "./existing-content-selector";
import { BatchCreateForm } from "./batch-create-form";
import { Loader2, Plus, Layers, Database } from "lucide-react";
import { Form } from "@/components/ui/form";

interface LicenseContentManagerProps {
  licenseId: string;
}

export function LicenseContentManager({ licenseId }: LicenseContentManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"existing" | "new">("existing");
  const [selectedExistingIds, setSelectedExistingIds] = useState<string[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  const createBatchMutation = useMutation({
    mutationFn: async (data: MultiBatchCreate) => {
      await apiRequest("POST", "/api/metadata/multi-batch", data);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Batch content created and linked successfully." });
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
        // Ensure all batches have the licenseId
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
