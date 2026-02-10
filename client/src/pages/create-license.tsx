import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { insertLicenseSchema, type InsertLicense } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { z } from "zod";

const formSchema = insertLicenseSchema.extend({
  generateDrafts: z.boolean().default(false),
  seriesTitle: z.string().optional(),
  seasonStart: z.coerce.number().int().positive().optional(),
  seasonEnd: z.coerce.number().int().positive().optional(),
  episodesPerSeason: z.coerce.number().int().positive().optional(),
}).superRefine((data, ctx) => {
  if (data.generateDrafts) {
    if (!data.seriesTitle) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Series Title is required",
        path: ["seriesTitle"],
      });
    }
    if (!data.seasonStart) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Start Season is required",
        path: ["seasonStart"],
      });
    }
    if (!data.seasonEnd) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "End Season is required",
        path: ["seasonEnd"],
      });
    }
    if (!data.episodesPerSeason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Episodes per Season is required",
        path: ["episodesPerSeason"],
      });
    }
  }
});

type FormValues = z.infer<typeof formSchema>;

export default function CreateLicense() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      distributor: "",
      notes: "",
      generateDrafts: false,
    },
  });

  const generateDrafts = form.watch("generateDrafts");

  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true);
    try {
      // 1. Create License
      const licenseRes = await apiRequest("POST", "/api/licenses", {
        name: data.name,
        distributor: data.distributor,
        contractDate: data.contractDate,
        notes: data.notes,
      });
      
      const license = await licenseRes.json();

      // 2. Generate Drafts if requested
      if (data.generateDrafts) {
        await apiRequest("POST", "/api/licenses/batch-generate", {
          licenseId: license.id,
          seriesTitle: data.seriesTitle,
          seasonStart: data.seasonStart,
          seasonEnd: data.seasonEnd,
          episodesPerSeason: data.episodesPerSeason,
        });
      }

      toast({
        title: "Success",
        description: data.generateDrafts 
          ? "License created and drafts generated." 
          : "License created successfully.",
      });

      queryClient.invalidateQueries({ queryKey: ["/api/licenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/metadata"] });
      
      setLocation("/licenses");
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
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Create License</h1>
        <p className="text-muted-foreground mt-2">
          Add a new content license and optionally generate metadata drafts
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>License Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Content Total 2026" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="distributor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Distributor</FormLabel>
                      <FormControl>
                        <Input placeholder="Distributor Name" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="contractDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contract Date</FormLabel>
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
              </div>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Any additional notes..." {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Card className="bg-muted/50 border-dashed">
                <CardHeader className="pb-4">
                  <div className="flex items-center space-x-2">
                    <FormField
                      control={form.control}
                      name="generateDrafts"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel className="text-base">
                              Generate Draft Metadata
                            </FormLabel>
                            <FormDescription>
                              Automatically create empty draft files for series, seasons, and episodes linked to this license.
                            </FormDescription>
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>
                </CardHeader>
                
                {generateDrafts && (
                  <CardContent className="space-y-4 pt-0">
                    <FormField
                      control={form.control}
                      name="seriesTitle"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Series Title *</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., The Office" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="grid grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="seasonStart"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Start Season *</FormLabel>
                            <FormControl>
                              <Input type="number" min={1} {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="seasonEnd"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>End Season *</FormLabel>
                            <FormControl>
                              <Input type="number" min={1} {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="episodesPerSeason"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Ep per Season *</FormLabel>
                            <FormControl>
                              <Input type="number" min={1} {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                )}
              </Card>

              <div className="flex justify-end gap-4">
                <Button variant="outline" type="button" onClick={() => setLocation("/licenses")}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Create License
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
