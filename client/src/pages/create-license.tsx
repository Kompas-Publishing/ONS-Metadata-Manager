import { useState } from "react";
import { useLocation } from "wouter";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { insertLicenseSchema, type InsertLicense, enhancedBatchCreateSchema, type EnhancedBatchCreate } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarIcon, Loader2, Database, Layers, Plus } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { LicenseContentManager } from "@/components/license-content-manager";
import { ExistingContentSelector } from "@/components/existing-content-selector";
import { BatchCreateForm } from "@/components/batch-create-form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";

import { z } from "zod";

const CURRENCIES = [
  { label: "EUR (€)", value: "EUR" },
  { label: "USD ($)", value: "USD" },
  { label: "GBP (£)", value: "GBP" },
];

const RATINGS = ["AL", "6", "9", "12", "16", "18"];

// Extended schema for the form
const createLicenseFormSchema = insertLicenseSchema.extend({
  metadataIds: z.array(z.string()).optional(),
  newBatches: z.array(enhancedBatchCreateSchema).optional(),
});

type CreateLicenseFormValues = z.infer<typeof createLicenseFormSchema>;

export default function CreateLicense() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canWriteLicenses } = useAuth();

  useEffect(() => {
    document.title = "Create License | ONS Broadcast Portal";
  }, []);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedMetadataIds, setSelectedMetadataIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<"existing" | "new">("existing");

  const form = useForm<CreateLicenseFormValues>({
    resolver: zodResolver(createLicenseFormSchema),
    defaultValues: {
      name: "",
      distributor: "",
      contentTitle: "",
      licenseFeeCurrency: "EUR",
      licenseFeeAmount: "",
      licenseFeePaid: 0,
      allowedRuns: "",
      contentRating: "",
      description: "",
      imdbLink: "",
      googleDriveLink: "",
      notes: "",
      productionYear: undefined,
      subsFromDistributor: 0,
      metadataIds: [],
      newBatches: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "newBatches",
  });

  const [createdId, setCreatedId] = useState<string | null>(null);

  const onSubmit = async (data: CreateLicenseFormValues, redirect: boolean = true) => {
    if (!canWriteLicenses) return;
    setIsSubmitting(true);
    try {
      const payload = {
        ...data,
        metadataIds: selectedMetadataIds,
      };
      
      const response = await apiRequest("POST", "/api/licenses", payload);
      const newLicense = await response.json();
      
      toast({
        title: "Success",
        description: "License created and content processed successfully.",
      });

      queryClient.invalidateQueries({ queryKey: ["/api/licenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/metadata"] });
      
      if (redirect) {
        setLocation("/licenses");
      } else {
        setCreatedId(newLicense.id);
        // Scroll to content manager if it appears
        setTimeout(() => {
          const element = document.getElementById("content-manager");
          if (element) {
            element.scrollIntoView({ behavior: "smooth" });
          }
        }, 100);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create license",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Create License</h1>
        <p className="text-muted-foreground mt-2">
          Add a new content license with detailed contract information
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit((data) => onSubmit(data, true))} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>License Information</CardTitle>
              <CardDescription>Enter the primary details of the license contract</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Internal License Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., BBC Nature Collection 2026" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="distributor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Distributor (Rechten)</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., BBC, Paramount, etc." {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="contentTitle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Content Title (Titel)</FormLabel>
                      <FormControl>
                        <Input placeholder="Title of the licensed content" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-4 rounded-md border p-4 bg-muted/20">
                  <FormLabel className="text-base">License Fee (Licentievergoeding)</FormLabel>
                  <div className="flex gap-4">
                    <FormField
                      control={form.control}
                      name="licenseFeeCurrency"
                      render={({ field }) => (
                        <FormItem className="w-1/3">
                          <Select onValueChange={field.onChange} value={field.value || "EUR"}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Currency" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {CURRENCIES.map((c) => (
                                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="licenseFeeAmount"
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.01" 
                              placeholder="0.00" 
                              {...field} 
                              value={field.value || ""} 
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="licenseFeePaid"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value === 1}
                            onCheckedChange={(checked) => field.onChange(checked ? 1 : 0)}
                          />
                        </FormControl>
                        <div className="leading-none">
                          <FormLabel>Paid (Betaald)</FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="subsFromDistributor"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value === 1}
                            onCheckedChange={(checked) => field.onChange(checked ? 1 : 0)}
                          />
                        </FormControl>
                        <div className="leading-none">
                          <FormLabel>Subtitles from Distributor (Ondertiteling inclusief)</FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="licenseStart"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>License Start (Startdatum)</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="licenseEnd"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>License End (Einddatum)</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="allowedRuns"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Allowed Runs (Aantal runs)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="e.g., 4" 
                          {...field} 
                          value={field.value || ""} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="contentRating"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Content Rating (Kijkwijzer)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || undefined}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select rating" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {RATINGS.map((r) => (
                            <SelectItem key={r} value={r}>{r}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="productionYear"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Production Year (Productiejaar)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="e.g., 2023" 
                          {...field} 
                          value={field.value || ""} 
                          onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="imdbLink"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>IMDB Link</FormLabel>
                      <FormControl>
                        <Input placeholder="https://www.imdb.com/title/..." {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="googleDriveLink"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Google Drive Link</FormLabel>
                      <FormControl>
                        <Input placeholder="https://drive.google.com/..." {...field} value={field.value || ""} />
                      </FormControl>
                      <FormDescription>
                        Link to promotional material, thumbnails, or videos
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 gap-6 mt-6">
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (Omschrijving)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Content description..." {...field} value={field.value || ""} className="min-h-[100px]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Extra Notes</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Any internal notes or comments..." {...field} value={field.value || ""} className="min-h-[80px]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {!createdId && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Plus className="w-5 h-5 text-primary" />
                  <CardTitle>Add Content to License</CardTitle>
                </div>
                <CardDescription>
                  Choose between linking existing files or creating new ones.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
                  <TabsList className="grid w-full grid-cols-2 mb-6">
                    <TabsTrigger value="existing" className="flex items-center gap-2">
                      <Database className="w-4 h-4" /> Link Existing
                    </TabsTrigger>
                    <TabsTrigger value="new" className="flex items-center gap-2">
                      <Layers className="w-4 h-4" /> Create New Assets
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="existing">
                    <ExistingContentSelector
                      selectedIds={selectedMetadataIds}
                      onSelect={setSelectedMetadataIds}
                    />
                  </TabsContent>

                  <TabsContent value="new" className="space-y-6">
                    <div className="space-y-6">
                      {fields.map((field, index) => (
                        <BatchCreateForm
                          key={field.id}
                          index={index}
                          form={form}
                          onRemove={() => remove(index)}
                        />
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full border-dashed"
                        onClick={() => append({
                          title: form.getValues("contentTitle") || "",
                          category: "Series",
                          seasons: [{ season: 1, episodeCount: 1, startEpisode: 1 }],
                          channel: "ONS",
                          draft: 1,
                        })}
                      >
                        <Plus className="w-4 h-4 mr-2" /> Add a Batch
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-end gap-4 border-t pt-6">
            <Button variant="outline" type="button" onClick={() => setLocation("/licenses")}>
              Cancel
            </Button>
            {!createdId && (
              <Button 
                type="button" 
                variant="secondary" 
                disabled={isSubmitting}
                onClick={() => form.handleSubmit((data) => onSubmit(data, false))()}
              >
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save & Add More Content
              </Button>
            )}
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create License
            </Button>
          </div>
        </form>
      </Form>

      {createdId && (
        <div id="content-manager">
          <LicenseContentManager licenseId={createdId} />
        </div>
      )}
    </div>
  );
}
