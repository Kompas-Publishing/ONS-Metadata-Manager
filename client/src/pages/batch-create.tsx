import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { batchCreateSchema, type BatchCreate } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CheckCircle2, Loader2, CalendarIcon, X } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { isUnauthorizedError } from "@/lib/authUtils";
import { TagInput } from "@/components/tag-input";
import { CountrySelect } from "@/components/country-select";
import { TimeInput } from "@/components/time-input";

function parseFormattedId(formattedId: string): number {
  return parseInt(formattedId.replace(/-/g, ''), 10);
}

function formatMetadataId(num: number): string {
  const segment3 = String(num % 1000).padStart(3, '0');
  const segment2 = String(Math.floor(num / 1000) % 1000).padStart(3, '0');
  const segment1 = String(Math.floor(num / 1000000) % 1000).padStart(3, '0');
  return `${segment1}-${segment2}-${segment3}`;
}

export default function BatchCreate() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showSuccess, setShowSuccess] = useState(false);

  const { data: nextId } = useQuery<string>({
    queryKey: ["/api/metadata/next-id"],
  });

  const form = useForm<BatchCreate>({
    resolver: zodResolver(batchCreateSchema),
    defaultValues: {
      title: "",
      season: 1,
      startEpisode: 1,
      episodeCount: 1,
      category: "Series",
      channel: "ONS",
      seriesTitle: "",
      description: "",
      genre: [],
      actors: [],
      programRating: undefined,
      productionCountry: "",
      yearOfProduction: undefined,
      audioId: "",
      duration: "",
      breakTime: "",
      endCredits: "",
      catchUp: undefined,
      dateStart: undefined,
      dateEnd: undefined,
      subtitles: undefined,
      segmented: undefined,
      contentType: undefined,
      seasonType: undefined,
    },
  });

  const episodeCount = form.watch("episodeCount");
  const startEpisode = form.watch("startEpisode");

  const batchMutation = useMutation({
    mutationFn: async (data: BatchCreate) => {
      return await apiRequest("POST", "/api/metadata/batch", data);
    },
    onSuccess: () => {
      setShowSuccess(true);
      queryClient.invalidateQueries({ queryKey: ["/api/metadata"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      setTimeout(() => {
        setLocation("/");
      }, 2000);
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: error.message || "Failed to create batch files",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: BatchCreate) => {
    const convertedData = {
      ...data,
      catchUp: data.catchUp ? 1 : 0,
      segmented: data.segmented ? 1 : 0,
      subtitles: data.subtitles ? 1 : 0,
      draft: 1, // Batch created files are always drafts
    };
    batchMutation.mutate(convertedData);
  };

  if (showSuccess) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="p-12 text-center">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold mb-2">Batch Created Successfully!</h2>
          <p className="text-muted-foreground mb-4">
            {episodeCount} files have been created
          </p>
          <p className="text-sm text-muted-foreground">Redirecting to dashboard...</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-foreground">Batch Create Files</h1>
        <p className="text-muted-foreground mt-2">
          Create multiple metadata files with auto-incrementing episode numbers
        </p>
      </div>

      <Card className="p-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <div className="border-t pt-6">
              <h3 className="text-xl font-semibold mb-6">Basic Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Series Title *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., The Love Boat" {...field} data-testid="input-batch-title" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-batch-category">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Series">Series</SelectItem>
                          <SelectItem value="Movie">Movie</SelectItem>
                          <SelectItem value="Documentary">Documentary</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="duration"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Duration (HH:MM:SS)</FormLabel>
                      <FormControl>
                        <TimeInput
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="01:30:00"
                          data-testid="input-batch-duration"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="breakTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Break Time (HH:MM:SS)</FormLabel>
                      <FormControl>
                        <TimeInput
                          value={field.value || undefined}
                          onChange={field.onChange}
                          placeholder="00:05:00"
                          data-testid="input-batch-break-time"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="endCredits"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Credits (HH:MM:SS)</FormLabel>
                      <FormControl>
                        <TimeInput
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="00:02:00"
                          data-testid="input-batch-end-credits"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="seasonType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Season Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-batch-season-type">
                            <SelectValue placeholder="Select season type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Winter">Winter</SelectItem>
                          <SelectItem value="Summer">Summer</SelectItem>
                          <SelectItem value="Autumn">Autumn</SelectItem>
                          <SelectItem value="Spring">Spring</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="contentType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Content Type</FormLabel>
                      <Select 
                        onValueChange={(value) => field.onChange(value ?? undefined)} 
                        value={field.value ?? undefined}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-content-type">
                            <SelectValue placeholder="Select content type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Short Form">Short Form</SelectItem>
                          <SelectItem value="Long Form">Long Form</SelectItem>
                          <SelectItem value="Ad">Ad</SelectItem>
                          <SelectItem value="Campaign">Campaign</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Series Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Main description for the series"
                      className="min-h-24"
                      {...field}
                      data-testid="input-batch-description"
                    />
                  </FormControl>
                  <FormDescription>
                    This description will be applied to all episodes
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="actors"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Actors</FormLabel>
                    <FormControl>
                      <TagInput
                        type="tags"
                        value={field.value || []}
                        onChange={field.onChange}
                        placeholder="Add actors..."
                        data-testid="input-batch-actors"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="genre"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Genre</FormLabel>
                    <FormControl>
                      <TagInput
                        type="genre"
                        value={field.value || []}
                        onChange={field.onChange}
                        placeholder="Add genres..."
                        data-testid="input-batch-genre"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="border-t pt-6">
              <h3 className="text-xl font-semibold mb-6">Series Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="seriesTitle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Series Title</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter series title"
                          {...field}
                          data-testid="input-batch-series-title"
                        />
                      </FormControl>
                      <FormDescription>
                        Different from the main title
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="season"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Season Number *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="e.g., 1"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                          data-testid="input-batch-season"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="startEpisode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Episode *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="e.g., 1"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                          data-testid="input-start-episode"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="episodeCount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Number of Episodes *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="e.g., 45"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                          data-testid="input-episode-count"
                        />
                      </FormControl>
                      <FormDescription>How many files to create (max 100)</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="border-t pt-6 mt-6">
              <h3 className="text-lg font-semibold mb-4">Broadcast Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="channel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Channel</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter channel"
                          {...field}
                          data-testid="input-batch-channel"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="audioId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Audio ID</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter audio ID"
                          {...field}
                          data-testid="input-batch-audio-id"
                        />
                      </FormControl>
                      <FormDescription>
                        Defaults to file ID if not specified
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="programRating"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Program Rating</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-batch-program-rating">
                            <SelectValue placeholder="Select rating" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="AL">AL</SelectItem>
                          <SelectItem value="6">6</SelectItem>
                          <SelectItem value="9">9</SelectItem>
                          <SelectItem value="12">12</SelectItem>
                          <SelectItem value="16">16</SelectItem>
                          <SelectItem value="18">18</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dateStart"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date Start</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                              data-testid="input-batch-date-start"
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
                  name="dateEnd"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date End</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                              data-testid="input-batch-date-end"
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
            </div>

            <div className="border-t pt-6 mt-6">
              <h3 className="text-lg font-semibold mb-4">Production Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="productionCountry"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Production Country</FormLabel>
                      <FormControl>
                        <CountrySelect
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Select country..."
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="yearOfProduction"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Year of Production</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="e.g., 2024"
                          {...field}
                          onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                          value={field.value || ""}
                          data-testid="input-batch-year-of-production"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="border-t pt-6 mt-6">
              <h3 className="text-lg font-semibold mb-4">Technical Settings</h3>
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="catchUp"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value === 1}
                          onCheckedChange={(checked) => field.onChange(checked ? 1 : 0)}
                          data-testid="checkbox-batch-catch-up"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Catch-Up</FormLabel>
                        <FormDescription>
                          Enable catch-up availability for all episodes
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="subtitles"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value === 1}
                          onCheckedChange={(checked) => field.onChange(checked ? 1 : 0)}
                          data-testid="checkbox-batch-subtitles"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Subtitles</FormLabel>
                        <FormDescription>
                          Enable subtitles for all episodes
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="segmented"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value === 1}
                          onCheckedChange={(checked) => field.onChange(checked ? 1 : 0)}
                          data-testid="checkbox-batch-segmented"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Segmented</FormLabel>
                        <FormDescription>
                          Mark all episodes as segmented
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {nextId && episodeCount > 0 && (
              <Card className="p-6 bg-muted/50">
                <h3 className="text-sm font-medium mb-4">Batch Preview</h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Episodes to create: </span>
                    <span className="font-medium">{episodeCount} files</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Episode range: </span>
                    <span className="font-medium">{startEpisode} - {startEpisode + episodeCount - 1}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">ID range: </span>
                    <span className="font-mono font-medium">{nextId} - {formatMetadataId(parseFormattedId(nextId) + episodeCount - 1)}</span>
                  </div>
                  
                  {form.watch("channel") && (
                    <div>
                      <span className="text-muted-foreground">Channel: </span>
                      <span className="font-medium">{form.watch("channel")}</span>
                    </div>
                  )}
                  
                  {form.watch("seriesTitle") && (
                    <div>
                      <span className="text-muted-foreground">Series Title: </span>
                      <span className="font-medium">{form.watch("seriesTitle")}</span>
                    </div>
                  )}
                  
                  {form.watch("programRating") && (
                    <div>
                      <span className="text-muted-foreground">Program Rating: </span>
                      <span className="font-medium">{form.watch("programRating")}</span>
                    </div>
                  )}
                  
                  {form.watch("productionCountry") && (
                    <div>
                      <span className="text-muted-foreground">Production Country: </span>
                      <span className="font-medium">{form.watch("productionCountry")}</span>
                    </div>
                  )}
                  
                  {form.watch("yearOfProduction") && (
                    <div>
                      <span className="text-muted-foreground">Year of Production: </span>
                      <span className="font-medium">{form.watch("yearOfProduction")}</span>
                    </div>
                  )}
                  
                  {form.watch("dateStart") && (
                    <div>
                      <span className="text-muted-foreground">Date Start: </span>
                      <span className="font-medium">{format(form.watch("dateStart")!, "PPP")}</span>
                    </div>
                  )}
                  
                  {form.watch("dateEnd") && (
                    <div>
                      <span className="text-muted-foreground">Date End: </span>
                      <span className="font-medium">{format(form.watch("dateEnd")!, "PPP")}</span>
                    </div>
                  )}
                  
                  {form.watch("catchUp") === 1 && (
                    <div>
                      <span className="text-muted-foreground">Catch-Up: </span>
                      <span className="font-medium">Enabled</span>
                    </div>
                  )}
                  
                  {form.watch("subtitles") === 1 && (
                    <div>
                      <span className="text-muted-foreground">Subtitles: </span>
                      <span className="font-medium">Enabled</span>
                    </div>
                  )}
                  
                  {form.watch("segmented") === 1 && (
                    <div>
                      <span className="text-muted-foreground">Segmented: </span>
                      <span className="font-medium">Enabled</span>
                    </div>
                  )}
                </div>
              </Card>
            )}

            {batchMutation.isPending && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating batch files...
                </div>
                <Progress value={undefined} className="w-full" />
              </div>
            )}

            <Button
              type="submit"
              disabled={batchMutation.isPending}
              data-testid="button-create-batch"
            >
              {batchMutation.isPending ? "Creating..." : "Create Batch"}
            </Button>
          </form>
        </Form>
      </Card>
    </div>
  );
}
