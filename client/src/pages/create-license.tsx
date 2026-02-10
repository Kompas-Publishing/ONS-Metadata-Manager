import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { insertLicenseSchema, type InsertLicense } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export default function CreateLicense() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<InsertLicense>({
    resolver: zodResolver(insertLicenseSchema),
    defaultValues: {
      name: "",
      distributor: "",
      contentTitle: "",
      licenseFee: "",
      allowedRuns: "",
      contentRating: "",
      description: "",
      imdbLink: "",
      notes: "",
    },
  });

  const onSubmit = async (data: InsertLicense) => {
    setIsSubmitting(true);
    try {
      await apiRequest("POST", "/api/licenses", data);
      
      toast({
        title: "Success",
        description: "License created successfully.",
      });

      queryClient.invalidateQueries({ queryKey: ["/api/licenses"] });
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
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Create License</h1>
        <p className="text-muted-foreground mt-2">
          Add a new content license with detailed contract information
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                      <FormLabel>Rechten (Distributor)</FormLabel>
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
                      <FormLabel>Titel (Content Title)</FormLabel>
                      <FormControl>
                        <Input placeholder="Title of the licensed content" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="licenseFee"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Licentievergoeding (Fee)</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., € 500,00 or betaald" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="licenseStart"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Startdatum (License Start)</FormLabel>
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
                      <FormLabel>Einddatum (License End)</FormLabel>
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
                      <FormLabel>Aantal runs (Allowed Runs)</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., max 4 uitz." {...field} value={field.value || ""} />
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
                      <FormLabel>Kijkwijzer (Content Rating)</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., AL, 6, 12" {...field} value={field.value || ""} />
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
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Omschrijving (Description)</FormLabel>
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