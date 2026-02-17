import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import {
  insertMetadataFileSchema,
  type InsertMetadataFile,
  type License,
} from "@shared/schema";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, X, Check, ChevronsUpDown, FileKey, ExternalLink } from "lucide-react";
import { SiGoogledrive } from "react-icons/si";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { TagInput } from "@/components/tag-input";
import { CountrySelect } from "@/components/country-select";
import { TimeInput } from "@/components/time-input";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

// Predefined seasonal/event tags
const PREDEFINED_TAGS = [
  "Christmas",
  "Sinterklaas",
  "Easter",
  "New Year",
  "Halloween",
  "Valentine's Day",
  "Music Festival",
] as const;

interface MetadataFormProps {
  defaultValues?: Partial<InsertMetadataFile>;
  onSubmit: (data: InsertMetadataFile) => void;
  onSaveDraft?: (data: InsertMetadataFile) => void;
  isPending: boolean;
  submitLabel: string;
  generatedId?: string;
  readOnly?: boolean;
}

export function MetadataForm({
  defaultValues,
  onSubmit,
  onSaveDraft,
  isPending,
  submitLabel,
  generatedId,
  readOnly = false,
}: MetadataFormProps) {
  const [actorInput, setActorInput] = useState("");
  const [breakTimeInput, setBreakTimeInput] = useState("");
  const [customTagInput, setCustomTagInput] = useState("");

  const { data: licenses } = useQuery<License[]>({
    queryKey: ["/api/licenses"],
  });

  // Compute breakTimes initialization properly
  const initialBreakTimes =
    defaultValues?.breakTimes ||
    (defaultValues?.breakTime ? [defaultValues.breakTime] : []);

  const form = useForm<InsertMetadataFile>({
    resolver: zodResolver(insertMetadataFileSchema),
    defaultValues: {
      title: "",
      season: undefined,
      episode: undefined,
      duration: "",
      breakTime: "",
      breakTimes: initialBreakTimes,
      endCredits: "",
      description: "",
      actors: [],
      genre: [],
      tags: [],
      seasonType: undefined,
      contentType: undefined,
      category: undefined,
      channel: "ONS",
      programRating: undefined,
      dateStart: undefined,
      dateEnd: undefined,
      seriesTitle: "",
      episodeTitle: "",
      episodeDescription: "",
      productionCountry: "",
      yearOfProduction: undefined,
      audioId: undefined,
      originalFilename: "",
      subtitlesId: "",
      googleDriveLink: "",
      catchUp: undefined,
      segmented: undefined,
      subtitles: undefined,
      draft: 0,
      licenseId: undefined,
      ...defaultValues,
    },
  });

  const actors = form.watch("actors") || [];
  const breakTimes = form.watch("breakTimes") || [];

  const addActor = () => {
    if (actorInput.trim()) {
      form.setValue("actors", [...actors, actorInput.trim()]);
      setActorInput("");
    }
  };

  const removeActor = (index: number) => {
    form.setValue(
      "actors",
      actors.filter((_, i) => i !== index),
    );
  };

  const addBreakTime = () => {
    if (
      breakTimeInput.trim() &&
      /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/.test(breakTimeInput.trim())
    ) {
      form.setValue("breakTimes", [...breakTimes, breakTimeInput.trim()]);
      setBreakTimeInput("");
    }
  };

  const removeBreakTime = (index: number) => {
    form.setValue(
      "breakTimes",
      breakTimes.filter((_, i) => i !== index),
    );
  };

  const handleSubmit = (data: InsertMetadataFile) => {
    const convertedData = {
      ...data,
      licenseId: data.licenseId === "none" ? null : data.licenseId,
      breakTime:
        data.breakTimes && data.breakTimes.length > 0 ? data.breakTimes[0] : "",
      breakTimes: data.breakTimes || [],
      catchUp: data.catchUp ? 1 : 0,
      segmented: data.segmented ? 1 : 0,
      subtitles: data.subtitles ? 1 : 0,
    };
    onSubmit(convertedData);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
        <div className="space-y-8">
          <fieldset disabled={readOnly} className="contents">
            {generatedId && (
              <div className="p-6 border rounded-lg bg-card">
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Generated ID
                </p>
                <p
                  className="text-2xl font-mono font-semibold text-foreground"
                  data-testid="generated-id"
                >
                  {generatedId}
                </p>
              </div>
            )}

            <div className="border-t pt-8">
              <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
                <FileKey className="w-5 h-5 text-muted-foreground" />
                Contract & License
              </h3>
              <div className="grid grid-cols-1 gap-6 max-w-md">
                <FormField
                  control={form.control}
                  name="licenseId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>License Association</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || undefined}
                        disabled={readOnly}
                      >
                        <FormControl>
                          <SelectTrigger>
                            {readOnly && field.value ? (
                              <span>{licenses?.find(l => l.id === field.value)?.name || "Linked License"}</span>
                            ) : (
                              <SelectValue placeholder="Select a license (optional)" />
                            )}
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none" onClick={() => field.onChange(null)}>None</SelectItem>
                          {licenses?.map((license) => (
                            <SelectItem key={license.id} value={license.id}>
                              {license.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Link this file to a content license/contract
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </fieldset>

          <div className="border-t pt-8">
            <h3 className="text-xl font-semibold mb-6">Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <fieldset disabled={readOnly} className="contents">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter title"
                          {...field}
                          data-testid="input-title"
                        />
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
                      <FormLabel>Category</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={readOnly}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-category">
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
                      <FormLabel>Duration (HH:MM:SS) *</FormLabel>
                      <FormControl>
                        <TimeInput
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="01:30:00"
                          data-testid="input-duration"
                          disabled={readOnly}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="breakTimes"
                  render={() => (
                    <FormItem>
                      <FormLabel>Break Times (HH:MM:SS)</FormLabel>
                      <div className="space-y-3">
                        {!readOnly && (
                          <div className="flex gap-2">
                            <TimeInput
                              value={breakTimeInput}
                              onChange={setBreakTimeInput}
                              placeholder="00:05:00"
                              data-testid="input-break-time"
                            />
                            <Button
                              type="button"
                              onClick={addBreakTime}
                              data-testid="button-add-break-time"
                            >
                              Add
                            </Button>
                          </div>
                        )}
                        {breakTimes.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {breakTimes.map((time, index) => (
                              <Badge
                                key={index}
                                variant="secondary"
                                className="gap-1 font-mono"
                                data-testid={`badge-break-time-${index}`}
                              >
                                {time}
                                {!readOnly && (
                                  <button
                                    type="button"
                                    onClick={() => removeBreakTime(index)}
                                    className="ml-1 hover:text-destructive"
                                    data-testid={`button-remove-break-time-${index}`}
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                )}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
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
                          data-testid="input-end-credits"
                          disabled={readOnly}
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
                      <FormLabel>Season</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={readOnly}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-season-type">
                            <SelectValue placeholder="Select season" />
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
                      <FormLabel>Content Type *</FormLabel>
                      <Select
                        onValueChange={(value) =>
                          field.onChange(value ?? undefined)
                        }
                        value={field.value ?? undefined}
                        disabled={readOnly}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-content-type">
                            <SelectValue placeholder="Select content type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="program">Program</SelectItem>
                          <SelectItem value="commercial">Commercial</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </fieldset>

              <FormField
                control={form.control}
                name="googleDriveLink"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Google Drive Link</FormLabel>
                    <div className="flex gap-2">
                      <FormControl>
                        <Input
                          placeholder="https://drive.google.com/..."
                          {...field}
                          value={field.value || ""}
                          data-testid="input-google-drive-link"
                          readOnly={readOnly}
                          className={cn(readOnly && "bg-muted font-mono text-xs")}
                        />
                      </FormControl>
                      {field.value && (
                        <Button
                          type="button"
                          variant="outline"
                          className="shrink-0 border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                          onClick={() => window.open(field.value, '_blank', 'noopener,noreferrer')}
                        >
                          <SiGoogledrive className="w-4 h-4 mr-2 text-[#4285F4]" />
                          Open Assets
                        </Button>
                      )}
                    </div>
                    <FormDescription>
                      Link to promotional material, thumbnails, or videos
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <fieldset disabled={readOnly} className="contents">
                <FormField
                  control={form.control}
                  name="tags"
                  render={({ field }) => {
                    const selectedTags = field.value || [];
                    const toggleTag = (tag: string) => {
                      const newTags = selectedTags.includes(tag)
                        ? selectedTags.filter((t) => t !== tag)
                        : [...selectedTags, tag];
                      field.onChange(newTags);
                    };

                    const addCustomTag = () => {
                      if (customTagInput.trim() && !selectedTags.includes(customTagInput.trim())) {
                        field.onChange([...selectedTags, customTagInput.trim()]);
                        setCustomTagInput("");
                      }
                    };

                    return (
                      <FormItem className="flex flex-col">
                        <FormLabel>Tags</FormLabel>
                        {readOnly ? (
                          <div
                            className={cn(
                              "flex h-9 w-full items-center justify-between rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground",
                            )}
                            data-testid="button-tags-select"
                          >
                            {selectedTags.length > 0
                              ? `${selectedTags.length} tag${selectedTags.length > 1 ? "s" : ""} selected`
                              : "No tags selected"}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </div>
                        ) : (
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  className={cn(
                                    "justify-between font-normal",
                                    !selectedTags.length &&
                                    "text-muted-foreground",
                                  )}
                                  data-testid="button-tags-select"
                                >
                                  {selectedTags.length > 0
                                    ? `${selectedTags.length} tag${selectedTags.length > 1 ? "s" : ""} selected`
                                    : "Select tags..."}
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-full p-0" align="start">
                              <div className="p-3 border-b">
                                <div className="text-sm font-medium mb-2">Add Custom Tag</div>
                                <div className="flex gap-2">
                                  <Input
                                    placeholder="e.g., talk-show"
                                    value={customTagInput}
                                    onChange={(e) => setCustomTagInput(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        e.preventDefault();
                                        addCustomTag();
                                      }
                                    }}
                                    data-testid="input-custom-tag"
                                  />
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={addCustomTag}
                                    data-testid="button-add-custom-tag"
                                  >
                                    Add
                                  </Button>
                                </div>
                              </div>
                              <Command>
                                <CommandInput placeholder="Search predefined tags..." />
                                <CommandList>
                                  <CommandEmpty>No predefined tags found.</CommandEmpty>
                                  <CommandGroup heading="Predefined Tags">
                                    {PREDEFINED_TAGS.map((tag) => (
                                      <CommandItem
                                        key={tag}
                                        value={tag}
                                        onSelect={() => toggleTag(tag)}
                                        data-testid={`option-tag-${tag.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}
                                      >
                                        <Check
                                          className={cn(
                                            "mr-2 h-4 w-4",
                                            selectedTags.includes(tag)
                                              ? "opacity-100"
                                              : "opacity-0",
                                          )}
                                        />
                                        {tag}
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        )}
                        {selectedTags.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {selectedTags.map((tag) => (
                              <Badge
                                key={tag}
                                variant="secondary"
                                className="gap-1"
                                data-testid={`badge-tag-${tag.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}
                              >
                                {tag}
                                {!readOnly && (
                                  <button
                                    type="button"
                                    onClick={() => toggleTag(tag)}
                                    className="ml-1 rounded-full hover:bg-muted"
                                    data-testid={`button-remove-tag-${tag.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                )}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {!readOnly && (
                          <FormDescription>
                            Select predefined tags or add custom ones
                          </FormDescription>
                        )}
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
              </fieldset>
            </div>
          </div>

          <fieldset disabled={readOnly} className="contents">
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter description..."
                      className="min-h-32"
                      {...field}
                      data-testid="input-description"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="actors"
              render={() => (
                <FormItem>
                  <FormLabel>Actors</FormLabel>
                  <div className="space-y-3">
                    {!readOnly && (
                      <div className="flex gap-2">
                        <Input
                          placeholder="Add actor name"
                          value={actorInput}
                          onChange={(e) => setActorInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addActor();
                            }
                          }}
                          data-testid="input-actor"
                        />
                        <Button
                          type="button"
                          onClick={addActor}
                          data-testid="button-add-actor"
                        >
                          Add
                        </Button>
                      </div>
                    )}
                    {actors.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {actors.map((actor, index) => (
                          <Badge
                            key={index}
                            variant="secondary"
                            className="gap-1"
                            data-testid={`badge-actor-${index}`}
                          >
                            {actor}
                            {!readOnly && (
                              <button
                                type="button"
                                onClick={() => removeActor(index)}
                                className="ml-1 hover:text-destructive"
                                data-testid={`button-remove-actor-${index}`}
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
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
                      value={field.value || []}
                      onChange={field.onChange}
                      type="genre"
                      placeholder="Add genre..."
                      disabled={readOnly}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="border-t pt-8">
              <h3 className="text-xl font-semibold mb-6">
                Broadcast Information
              </h3>
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
                          data-testid="input-channel"
                        />
                      </FormControl>
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
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={readOnly}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-program-rating">
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
                                !field.value && "text-muted-foreground",
                              )}
                              data-testid="input-date-start"
                              disabled={readOnly}
                            >
                              {field.value ? (
                                format(field.value, "PPP")
                              ) : (
                                <span>Pick a date</span>
                              )}
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
                                !field.value && "text-muted-foreground",
                              )}
                              data-testid="input-date-end"
                              disabled={readOnly}
                            >
                              {field.value ? (
                                format(field.value, "PPP")
                              ) : (
                                <span>Pick a date</span>
                              )}
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

            <div className="border-t pt-8">
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
                          data-testid="input-series-title"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="episodeTitle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Episode Title</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter episode title"
                          {...field}
                          data-testid="input-episode-title"
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
                      <FormLabel>Season Number</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="e.g., 1"
                          {...field}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value
                                ? parseInt(e.target.value)
                                : undefined,
                            )
                          }
                          value={field.value || ""}
                          data-testid="input-season"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="episode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Episode Number</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="e.g., 1"
                          {...field}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value
                                ? parseInt(e.target.value)
                                : undefined,
                            )
                          }
                          value={field.value || ""}
                          data-testid="input-episode"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="episodeDescription"
                render={({ field }) => (
                  <FormItem className="mt-6">
                    <FormLabel>Episode Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter episode description..."
                        className="min-h-32"
                        {...field}
                        data-testid="input-episode-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="border-t pt-8">
              <h3 className="text-xl font-semibold mb-6">
                Production Information
              </h3>
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
                          disabled={readOnly}
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
                          onChange={(e) =>
                            field.onChange(
                              e.target.value
                                ? parseInt(e.target.value)
                                : undefined,
                            )
                          }
                          value={field.value || ""}
                          data-testid="input-year-of-production"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="border-t pt-8">
              <h3 className="text-xl font-semibold mb-6">
                Features & Localization
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="originalFilename"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Original Filename</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter original filename"
                          {...field}
                          data-testid="input-original-filename"
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
                          placeholder="Only use if you want to override the audio track"
                          {...field}
                          value={field.value ?? ""}
                          data-testid="input-audio-id"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="subtitlesId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subtitles ID</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter subtitles ID"
                          {...field}
                          data-testid="input-subtitles-id"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="border-t pt-8">
              <h3 className="text-xl font-semibold mb-6">Flags</h3>
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="catchUp"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value === 1}
                          onCheckedChange={(checked) =>
                            field.onChange(checked ? 1 : 0)
                          }
                          data-testid="checkbox-catch-up"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Catch-Up</FormLabel>
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
                          onCheckedChange={(checked) =>
                            field.onChange(checked ? 1 : 0)
                          }
                          data-testid="checkbox-segmented"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Segmented</FormLabel>
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
                          onCheckedChange={(checked) =>
                            field.onChange(checked ? 1 : 0)
                          }
                          data-testid="checkbox-subtitles"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Subtitles</FormLabel>
                      </div>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {!readOnly && (
              <div className="mt-8 flex gap-4">
                <Button
                  type="submit"
                  disabled={isPending}
                  data-testid="button-submit"
                >
                  {isPending ? "Saving..." : submitLabel}
                </Button>
                {onSaveDraft && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isPending}
                    onClick={() => {
                      const values = form.getValues();
                      onSaveDraft(values);
                    }}
                    data-testid="button-save-draft"
                  >
                    {isPending ? "Saving..." : "Save Draft"}
                  </Button>
                )}
              </div>
            )}
          </fieldset>
        </div>
      </form>
    </Form>
  );
}
