import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { 
  Loader2, 
  Search, 
  Filter, 
  CheckCircle2, 
  Clock, 
  ExternalLink,
  Plus,
  Trash2,
  Layers,
  Database,
  CheckSquare,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import type { Task, MetadataFile, MultiBatchCreate } from "@shared/schema";
import { multiBatchCreateSchema } from "@shared/schema";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExistingContentSelector } from "@/components/existing-content-selector";
import { BatchCreateForm } from "@/components/batch-create-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";

const PREDEFINED_DESCRIPTIONS = [
  "heeft meta nodig",
  "heeft subs nodig",
  "heeft QC nodig",
  "is klaar voor export",
] as const;

type TaskWithFile = Task & { metadataFile: MetadataFile };

export default function Tasks() {
  const { canReadTasks, canWriteTasks, canReadMetadata, canWriteMetadata } = useAuth();

  useEffect(() => {
    document.title = "Task List | ONS Broadcast Portal";
  }, []);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [descFilter, setDescFilter] = useState<string>("all");
  
  // Dialog state
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [activeAddTab, setActiveAddTab] = useState<"existing" | "new">("existing");
  const [selectedExistingIds, setSelectedExistingIds] = useState<string[]>([]);
  const [taskDescription, setTaskDescription] = useState("");
  const [taskDeadline, setTaskDeadline] = useState<Date | undefined>(undefined);

  const { data: tasks, isLoading } = useQuery<TaskWithFile[]>({
    queryKey: ["/api/tasks"],
    enabled: canReadTasks || canWriteTasks,
  });

  // Grouping logic
  const groupedTasks = useMemo(() => {
    if (!tasks) return {};
    
    const filtered = tasks.filter((t) => {
      const matchesSearch = 
        t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.metadataFile.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.metadataFileId.includes(searchTerm);
      
      const matchesStatus = statusFilter === "all" || t.status === statusFilter;
      const matchesDesc = descFilter === "all" || t.description === descFilter;

      return matchesSearch && matchesStatus && matchesDesc;
    });

    const groups: Record<string, Record<number, TaskWithFile[]>> = {};
    
    filtered.forEach(task => {
      const title = task.metadataFile.title || "Uncategorized";
      const season = task.metadataFile.season || 0;
      
      if (!groups[title]) groups[title] = {};
      if (!groups[title][season]) groups[title][season] = [];
      
      groups[title][season].push(task);
    });
    
    return groups;
  }, [tasks, searchTerm, statusFilter, descFilter]);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (key: string) => {
    setOpenGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Form for New Assets tab
  const batchForm = useForm<MultiBatchCreate & { taskDescription: string }>({
    resolver: zodResolver(multiBatchCreateSchema.extend({
      taskDescription: z.string().optional()
    })),
    defaultValues: {
      batches: [
        {
          title: "",
          category: "Series",
          seasons: [{ season: 1, episodeCount: 1, startEpisode: 1 }],
          channel: "ONS",
          draft: 1,
        },
      ],
      taskDescription: "heeft meta nodig"
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: batchForm.control,
    name: "batches",
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      await apiRequest("PATCH", `/api/tasks/${id}`, { status });
    },
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/tasks"] });
      const previousTasks = queryClient.getQueryData<TaskWithFile[]>(["/api/tasks"]);
      if (previousTasks) {
        queryClient.setQueryData<TaskWithFile[]>(["/api/tasks"], 
          previousTasks.map(t => t.id === id ? { ...t, status: status as any } : t)
        );
      }
      return { previousTasks };
    },
    onError: (err, variables, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(["/api/tasks"], context.previousTasks);
      }
      toast({
        title: "Error",
        description: "Failed to update task status",
        variant: "destructive",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/tasks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({ title: "Success", description: "Task deleted" });
    },
  });

  const bulkAddMutation = useMutation({
    mutationFn: async (data: { metadataFileIds: string[], description: string, deadline?: Date }) => {
      await apiRequest("POST", "/api/tasks/bulk", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      setIsAddDialogOpen(false);
      setSelectedExistingIds([]);
      setTaskDescription("");
      setTaskDeadline(undefined);
      toast({ title: "Success", description: "Tasks assigned successfully." });
    },
  });

  const createBatchWithTaskMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", "/api/metadata/multi-batch", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/metadata"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      setIsAddDialogOpen(false);
      batchForm.reset();
      toast({ title: "Success", description: "Batch created with tasks." });
    },
  });

  const handleBulkAdd = () => {
    if (activeAddTab === "existing") {
      if (selectedExistingIds.length === 0) {
        toast({ title: "Error", description: "Select at least one file", variant: "destructive" });
        return;
      }
      if (!taskDescription.trim()) {
        toast({ title: "Error", description: "Enter a task description", variant: "destructive" });
        return;
      }
      bulkAddMutation.mutate({
        metadataFileIds: selectedExistingIds,
        description: taskDescription,
        deadline: taskDeadline
      });
    } else {
      batchForm.handleSubmit((data) => {
        createBatchWithTaskMutation.mutate(data);
      })();
    }
  };

  const filteredTasks = useMemo(() => {
    if (!tasks) return [];
    
    return tasks.filter((t) => {
      const matchesSearch = 
        t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.metadataFile.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.metadataFileId.includes(searchTerm);
      
      const matchesStatus = statusFilter === "all" || t.status === statusFilter;
      const matchesDesc = descFilter === "all" || t.description === descFilter;

      return matchesSearch && matchesStatus && matchesDesc;
    });
  }, [tasks, searchTerm, statusFilter, descFilter]);

  const uniqueDescriptions = useMemo(() => {
    if (!tasks) return [];
    const descs = new Set(tasks.map(t => t.description));
    return Array.from(descs).sort();
  }, [tasks]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Task List</h1>
          <p className="text-muted-foreground mt-1">
            Manage and track tasks assigned to metadata files
          </p>
        </div>

        {canWriteTasks && (
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" /> Add Tasks
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle>Assign Tasks</DialogTitle>
                <DialogDescription>
                  Select existing metadata or create new assets with tasks attached.
                </DialogDescription>
              </DialogHeader>

              <Tabs value={activeAddTab} onValueChange={(v: any) => setActiveAddTab(v)} className="flex-1 overflow-hidden flex flex-col">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="existing" className="gap-2">
                    <Database className="w-4 h-4" /> Existing Content
                  </TabsTrigger>
                  <TabsTrigger value="new" className="gap-2">
                    <Layers className="w-4 h-4" /> Create New Assets
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="existing" className="flex-1 overflow-hidden flex flex-col space-y-4 px-1">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Task Description</Label>
                      <Select value={taskDescription} onValueChange={setTaskDescription}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a task description" />
                        </SelectTrigger>
                        <SelectContent>
                          {PREDEFINED_DESCRIPTIONS.map((desc) => (
                            <SelectItem key={desc} value={desc}>
                              {desc}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Deadline (Optional)</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !taskDeadline && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {taskDeadline ? format(taskDeadline, "PPP") : <span>Set deadline</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={taskDeadline}
                            onSelect={setTaskDeadline}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <Label className="mb-2 block">Select Files</Label>
                    <ExistingContentSelector
                      selectedIds={selectedExistingIds}
                      onSelect={setSelectedExistingIds}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="new" className="flex-1 overflow-y-auto space-y-6 px-1">
                  <Form {...batchForm}>
                    <div className="space-y-6">
                      <FormField
                        control={batchForm.control}
                        name="taskDescription"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Task for these assets</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select a task description" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {PREDEFINED_DESCRIPTIONS.map((desc) => (
                                  <SelectItem key={desc} value={desc}>
                                    {desc}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />

                      <div className="space-y-4">
                        {fields.map((field, index) => (
                          <BatchCreateForm
                            key={field.id}
                            index={index}
                            form={batchForm}
                            onRemove={() => remove(index)}
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
                            breakTimes: [],
                            actors: [],
                            genre: [],
                          })}
                        >
                          <Plus className="w-4 h-4 mr-2" /> Add Another Batch
                        </Button>
                      </div>
                    </div>
                  </Form>
                </TabsContent>
              </Tabs>

              <DialogFooter className="pt-4 border-t">
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                <Button 
                  onClick={handleBulkAdd} 
                  disabled={bulkAddMutation.isPending || createBatchWithTaskMutation.isPending}
                >
                  {(bulkAddMutation.isPending || createBatchWithTaskMutation.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {activeAddTab === "existing" ? `Assign to ${selectedExistingIds.length} Files` : "Create & Assign Tasks"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search description or title..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>

            <Select value={descFilter} onValueChange={setDescFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by task type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Task Types</SelectItem>
                {uniqueDescriptions.map(d => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        {Object.keys(groupedTasks).length > 0 ? (
          Object.entries(groupedTasks)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([title, seasons]) => {
              const totalPending = Object.values(seasons).flat().filter(t => t.status === 'pending').length;
              const isGroupOpen = openGroups[title] ?? true;

              return (
                <div key={title} className="space-y-3">
                  <div 
                    className="flex items-center justify-between p-3 bg-muted/40 rounded-lg cursor-pointer hover:bg-muted/60 transition-colors"
                    onClick={() => toggleGroup(title)}
                  >
                    <div className="flex items-center gap-3">
                      {isGroupOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      <h2 className="text-xl font-bold tracking-tight">{title}</h2>
                      {totalPending > 0 && (
                        <Badge variant="destructive" className="animate-pulse">
                          {totalPending} pending
                        </Badge>
                      )}
                    </div>
                  </div>

                  {isGroupOpen && (
                    <div className="pl-4 space-y-6 border-l-2 border-muted ml-2 pt-2">
                      {Object.entries(seasons)
                        .sort(([a], [b]) => parseInt(a) - parseInt(b))
                        .map(([season, seasonTasks]) => (
                          <div key={`${title}-${season}`} className="space-y-3">
                            <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                              <CheckSquare className="w-3.5 h-3.5" />
                              {season === "0" ? "Single Item / Unknown" : `Season ${season}`}
                            </h3>
                            <div className="grid grid-cols-1 gap-3">
                              {seasonTasks.map((task) => (
                                <Card key={task.id} className={cn(
                                  "transition-all",
                                  task.status === "completed" ? "bg-muted/40 opacity-80" : "bg-card hover:shadow-md"
                                )}>
                                  <CardContent className="p-4 flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-4 min-w-0">
                                      <Checkbox 
                                        checked={task.status === "completed"}
                                        onCheckedChange={(checked) => {
                                          toggleMutation.mutate({ 
                                            id: task.id, 
                                            status: checked ? "completed" : "pending" 
                                          });
                                        }}
                                        className="h-5 w-5"
                                        disabled={!canWriteTasks}
                                      />
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                          <span className={cn(
                                            "font-semibold text-lg leading-none",
                                            task.status === "completed" && "line-through text-muted-foreground"
                                          )}>
                                            {task.description}
                                          </span>
                                          {task.deadline && (
                                            <Badge variant="outline" className={cn(
                                              "text-[10px] font-mono",
                                              new Date(task.deadline) < new Date() && task.status !== 'completed' ? "border-destructive text-destructive bg-destructive/5" : ""
                                            )}>
                                              Due: {format(new Date(task.deadline), "dd-MM-yyyy")}
                                            </Badge>
                                          )}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                                          <span className="flex items-center gap-1">
                                            ID: <span className="font-mono text-[10px]">{task.metadataFileId}</span>
                                          </span>
                                          {task.metadataFile.episode && (
                                            <span className="font-medium text-foreground">Episode {task.metadataFile.episode}</span>
                                          )}
                                          {task.metadataFile.episodeTitle && (
                                            <span className="italic">"{task.metadataFile.episodeTitle}"</span>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                      {canReadMetadata && (
                                        <Button variant="ghost" size="icon" asChild title="View File">
                                          <Link href={`/view/${task.metadataFileId}`}>
                                            <ExternalLink className="w-4 h-4" />
                                          </Link>
                                        </Button>
                                      )}
                                      {canWriteTasks && (
                                        <Button 
                                          variant="ghost" 
                                          size="icon" 
                                          className="text-destructive hover:bg-destructive/10"
                                          title="Delete Task"
                                          onClick={() => {
                                            if(confirm("Delete this task?")) deleteMutation.mutate(task.id);
                                          }}
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </Button>
                                      )}
                                    </div>
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              );
            })
        ) : (
          <div className="text-center py-20 border-2 border-dashed rounded-lg bg-muted/20">
            <CheckCircle2 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground">No tasks found</h3>
            <p className="text-sm text-muted-foreground">
              Click "Add Tasks" to assign work to programs.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
