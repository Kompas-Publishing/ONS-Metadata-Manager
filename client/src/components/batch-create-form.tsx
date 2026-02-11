import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { enhancedBatchCreateSchema, type EnhancedBatchCreate } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Plus, Trash2, X } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { TagInput } from "@/components/tag-input";
import { CountrySelect } from "@/components/country-select";
import { TimeInput } from "@/components/time-input";
import { Card, CardContent } from "@/components/ui/card";

interface BatchCreateFormProps {
  index: number;
  onRemove?: () => void;
  form: any; // We'll pass the parent form or use useFormContext
  licenseId?: string;
}

export function BatchCreateForm({ index, onRemove, form, licenseId }: BatchCreateFormProps) {
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: `batches.${index}.seasons`,
  });

  return (
    <Card className="relative">
      {onRemove && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 z-10"
          onClick={onRemove}
          type="button"
        >
          <X className="w-4 h-4" />
        </Button>
      )}
      <CardContent className="pt-6 space-y-8">
        <div>
          <h3 className="text-lg font-semibold mb-4">Batch #{index + 1} Settings</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name={`batches.${index}.title`}
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
              name={`batches.${index}.category`}
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
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <FormLabel className="text-base font-semibold">Seasons & Episodes</FormLabel>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ season: fields.length + 1, episodeCount: 1, startEpisode: 1 })}
            >
              <Plus className="w-4 h-4 mr-2" /> Add Season
            </Button>
          </div>
          
          <div className="space-y-3">
            {fields.map((field, seasonIndex) => (
              <div key={field.id} className="flex items-end gap-4 p-4 border rounded-lg bg-muted/30">
                <FormField
                  control={form.control}
                  name={`batches.${index}.seasons.${seasonIndex}.season`}
                  render={({ field }) => (
                    <FormItem className="flex-1">
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
                  name={`batches.${index}.seasons.${seasonIndex}.episodeCount`}
                  render={({ field }) => (
                    <FormItem className="flex-1">
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
                  name={`batches.${index}.seasons.${seasonIndex}.startEpisode`}
                  render={({ field }) => (
                    <FormItem className="flex-1">
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

                {fields.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    onClick={() => remove(seasonIndex)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="border-t pt-6">
          <h3 className="text-lg font-semibold mb-6">Shared Content Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name={`batches.${index}.duration`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Duration (HH:MM:SS)</FormLabel>
                  <FormControl>
                    <TimeInput value={field.value} onChange={field.onChange} placeholder="01:30:00" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name={`batches.${index}.breakTime`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Break Time (HH:MM:SS)</FormLabel>
                  <FormControl>
                    <TimeInput value={field.value || ""} onChange={field.onChange} placeholder="00:05:00" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name={`batches.${index}.endCredits`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>End Credits (HH:MM:SS)</FormLabel>
                  <FormControl>
                    <TimeInput value={field.value} onChange={field.onChange} placeholder="00:02:00" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name={`batches.${index}.seasonType`}
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
              name={`batches.${index}.contentType`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Content Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
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
          name={`batches.${index}.description`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Series Description</FormLabel>
              <FormControl>
                <Textarea placeholder="Main description for the series" className="min-h-24" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name={`batches.${index}.actors`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Actors</FormLabel>
                <FormControl>
                  <TagInput type="tags" value={field.value || []} onChange={field.onChange} placeholder="Add actors..." />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name={`batches.${index}.genre`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Genre</FormLabel>
                <FormControl>
                  <TagInput type="genre" value={field.value || []} onChange={field.onChange} placeholder="Add genres..." />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="border-t pt-6">
          <h3 className="text-lg font-semibold mb-6">Broadcast & Production</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name={`batches.${index}.channel`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Channel</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter channel" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name={`batches.${index}.programRating`}
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
              name={`batches.${index}.productionCountry`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Production Country</FormLabel>
                  <FormControl>
                    <CountrySelect value={field.value} onChange={field.onChange} placeholder="Select country..." />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name={`batches.${index}.yearOfProduction`}
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

        <div className="border-t pt-6">
          <h3 className="text-lg font-semibold mb-4">Flags</h3>
          <div className="flex flex-wrap gap-6">
            <FormField
              control={form.control}
              name={`batches.${index}.catchUp`}
              render={({ field }) => (
                <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox checked={field.value === 1} onCheckedChange={(checked) => field.onChange(checked ? 1 : 0)} />
                  </FormControl>
                  <FormLabel>Catch-Up</FormLabel>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name={`batches.${index}.subtitles`}
              render={({ field }) => (
                <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox checked={field.value === 1} onCheckedChange={(checked) => field.onChange(checked ? 1 : 0)} />
                  </FormControl>
                  <FormLabel>Subtitles</FormLabel>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name={`batches.${index}.segmented`}
              render={({ field }) => (
                <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox checked={field.value === 1} onCheckedChange={(checked) => field.onChange(checked ? 1 : 0)} />
                  </FormControl>
                  <FormLabel>Segmented</FormLabel>
                </FormItem>
              )}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
