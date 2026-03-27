import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { enhancedBatchCreateSchema, type EnhancedBatchCreate, type MultiBatchCreate } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
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
import { CheckCircle2, Loader2, CalendarIcon, X, Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { isUnauthorizedError } from "@/lib/authUtils";
import { TagInput } from "@/components/tag-input";
import { CountrySelect } from "@/components/country-select";
import { TimeInput } from "@/components/time-input";
import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";

export default function BatchCreate() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showSuccess, setShowSuccess] = useState(false);
  const [createdCount, setCreatedCount] = useState(0);
  const { canWriteMetadata } = useAuth();

  useEffect(() => {
    document.title = "Batch Create | ONS Broadcast Portal";
  }, []);

  const form = useForm<EnhancedBatchCreate>({
    resolver: zodResolver(enhancedBatchCreateSchema),
    defaultValues: {
      title: "",
      category: "Series",
      seasons: [{ season: 1, episodeCount: 1, startEpisode: 1 }],
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
      draft: 1,
      taskDescription: "",
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "seasons",
  });

  const totalEpisodes = form.watch("seasons").reduce((sum, s) => sum + (s.episodeCount || 0), 0);

  const batchMutation = useMutation({
    mutationFn: async (data: MultiBatchCreate) => {
      return await apiRequest("POST", "/api/metadata/multi-batch", data);
    },
    onSuccess: (data) => {
      setCreatedCount(totalEpisodes);
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
          window.location.href = "/login";
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

  const onSubmit = (data: EnhancedBatchCreate) => {
    // Send as a multi-batch with a single batch
    batchMutation.mutate({ batches: [data] });
  };

  if (showSuccess) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="p-12 text-center">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold mb-2">Batch Created Successfully!</h2>
          <p className="text-muted-foreground mb-4">
            {createdCount} files have been created
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
          Create multiple metadata files with flexible season and episode definitions
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
                        <Input placeholder="e.g., The Love Boat" {...field} />
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
                          <SelectTrigger>
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
                          <SelectTrigger>
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
                          <SelectTrigger>
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
                    />
                  </FormControl>
                  <FormDescription>
                    This description will be applied to all episodes
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="taskDescription"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Automatic Task Description (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. Needs metadata, Needs subtitles"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    If provided, a task will be automatically created for every episode in this batch
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
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="border-t pt-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold">Series Information</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ season: fields.length + 1, episodeCount: 1, startEpisode: 1 })}
                >
                  <Plus className="w-4 h-4 mr-2" /> Add Season
                </Button>
              </div>

              <div className="space-y-4">
                {fields.map((field, index) => (
                  <div key={field.id} className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 border rounded-lg bg-muted/20 relative items-end">
                    <FormField
                      control={form.control}
                      name={`seasons.${index}.season`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Season</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`seasons.${index}.episodeCount`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Episodes</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`seasons.${index}.startEpisode`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Start Ep</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex justify-end pb-1">
                      {fields.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => remove(index)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6">
                <FormField
                  control={form.control}
                  name="seriesTitle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Main Series Title (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter series title"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Different from the metadata title
                      </FormDescription>
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
                          <SelectTrigger>
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

            {totalEpisodes > 0 && (
              <Card className="p-6 bg-muted/50">
                <h3 className="text-sm font-medium mb-4">Batch Preview</h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Total episodes to create: </span>
                    <span className="font-medium">{totalEpisodes} files</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">IDs: </span>
                    <span className="font-mono font-medium text-muted-foreground">Auto-generated</span>
                  </div>
                  
                  {form.watch("title") && (
                    <div>
                      <span className="text-muted-foreground">Title: </span>
                      <span className="font-medium">{form.watch("title")}</span>
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
            >
              {batchMutation.isPending ? "Creating..." : "Create Batch"}
            </Button>
          </form>
        </Form>
      </Card>
    </div>
  );
}
