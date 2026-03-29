import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { insertLicenseSchema, type InsertLicense, type License } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarIcon, Loader2, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { LicenseContentManager } from "@/components/license-content-manager";
import { useAuth } from "@/hooks/use-auth";

const CURRENCIES = [
  { label: "EUR (€)", value: "EUR" },
  { label: "USD ($)", value: "USD" },
  { label: "GBP (£)", value: "GBP" },
];

const RATINGS = ["AL", "6", "9", "12", "16", "18"];

export default function EditLicense() {
  const [match, params] = useRoute("/licenses/:id/edit");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canWriteLicenses, canReadLicenses } = useAuth();
  const id = params?.id;

  useEffect(() => {
    document.title = "Edit License | ONS Broadcast Portal";
  }, []);

  const { data: license, isLoading, isError, error: queryError } = useQuery<License>({
    queryKey: [`/api/licenses/${id}`],
    enabled: !!id && (canReadLicenses || canWriteLicenses),
  });

  useEffect(() => {
    if (!isLoading && !canWriteLicenses) {
      toast({
        title: "Permission Denied",
        description: "You don't have permission to edit licenses.",
        variant: "destructive",
      });
      setLocation(id ? `/licenses/${id}` : "/licenses");
    }
  }, [canWriteLicenses, isLoading, id, setLocation, toast]);

  const form = useForm<InsertLicense>({
    resolver: zodResolver(insertLicenseSchema),
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
      season: "",
    },
  });

  useEffect(() => {
    if (license) {
      try {
        form.reset({
          name: license.name || "",
          distributor: license.distributor || "",
          contentTitle: license.contentTitle || "",
          licenseFeeCurrency: license.licenseFeeCurrency || "EUR",
          licenseFeeAmount: license.licenseFeeAmount || "",
          licenseFeePaid: license.licenseFeePaid || 0,
          licenseStart: license.licenseStart ? new Date(license.licenseStart) : undefined,
          licenseEnd: license.licenseEnd ? new Date(license.licenseEnd) : undefined,
          allowedRuns: license.allowedRuns || "",
          contentRating: license.contentRating || "",
          description: license.description || "",
          imdbLink: license.imdbLink || "",
          googleDriveLink: license.googleDriveLink || "",
          notes: license.notes || "",
          productionYear: license.productionYear || undefined,
          subsFromDistributor: license.subsFromDistributor || 0,
          season: license.season || "",
        });
      } catch {
        // Form reset failed silently
      }
    }
  }, [license, form.reset]);

  const updateMutation = useMutation({
    mutationFn: async (data: InsertLicense) => {
      await apiRequest("PATCH", `/api/licenses/${id}`, data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "License updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/licenses/${id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/licenses"] });
      setLocation(`/licenses/${id}`);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update license",
        variant: "destructive",
      });
    },
  });

  if (!id) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4">
        <h2 className="text-2xl font-bold">Invalid License ID</h2>
        <Button onClick={() => setLocation("/licenses")}>Back to Licenses</Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError || !license) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4">
        <h2 className="text-2xl font-bold">Error loading license</h2>
        <Button onClick={() => setLocation("/licenses")}>Back to Licenses</Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation(`/licenses/${id}`)}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Edit License</h1>
          <p className="text-muted-foreground mt-1">Update license and contract information</p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => updateMutation.mutate(data))} className="space-y-6">
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
                  name="season"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Season</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. 1 or 1, 2, 4" {...field} value={field.value || ""} />
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

              <div className="flex justify-end gap-4 border-t pt-6">
                <Button variant="outline" type="button" onClick={() => setLocation(`/licenses/${id}`)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Save Changes
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {id && <LicenseContentManager licenseId={id} />}
    </div>
  );
}
