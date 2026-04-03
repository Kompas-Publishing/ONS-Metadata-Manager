import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { MetadataForm } from "@/components/metadata-form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DetailSkeleton } from "@/components/skeleton-loader";
import { Download, ChevronLeft, Plus, Trash2, CheckSquare, CheckCircle2, Clock, CalendarIcon } from "lucide-react";
import type { MetadataFile, Task } from "@shared/schema";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function ViewFile() {
  const [, params] = useRoute("/view/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAuthenticated, isLoading: authLoading, canReadMetadata, canWriteMetadata } = useAuth();
  const [newTaskDesc, setNewTaskDesc] = useState("");

  useEffect(() => {
    document.title = `View File ${params?.id || ''} | ONS Broadcast Portal`;
  }, [params?.id]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/login";
      }, 500);
    }
  }, [isAuthenticated, authLoading, toast]);

  useEffect(() => {
    if (!authLoading && !canReadMetadata && !canWriteMetadata) {
      toast({
        title: "Permission Denied",
        description: "You don't have permission to view files.",
        variant: "destructive",
      });
      setLocation("/");
    }
  }, [authLoading, canReadMetadata, canWriteMetadata, toast, setLocation]);

  const { data: file, isLoading } = useQuery<MetadataFile>({
    queryKey: ["/api/metadata", params?.id],
    enabled: !!params?.id && (canReadMetadata || canWriteMetadata),
  });

  const { data: tasks, isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: ["/api/metadata", params?.id, "tasks"],
    enabled: !!params?.id && (canReadMetadata || canWriteMetadata),
  });

  const [newTaskDeadline, setNewTaskDeadline] = useState<Date | undefined>(undefined);
  const [newTaskAssignee, setNewTaskAssignee] = useState<string>("");

  const { data: usersData } = useQuery<{ users: { id: string; email: string; firstName: string | null; lastName: string | null }[] }>({
    queryKey: ["/api/admin/users"],
    enabled: canWriteMetadata,
  });

  const addTaskMutation = useMutation({
    mutationFn: async (data: { description: string; deadline?: Date; assignedTo?: string }) => {
      const res = await apiRequest("POST", "/api/tasks", {
        metadataFileId: params?.id,
        description: data.description,
        status: "pending",
        deadline: data.deadline,
        assignedTo: data.assignedTo || undefined,
      });
      return res.json();
    },
    onMutate: async (newTask) => {
      await queryClient.cancelQueries({ queryKey: ["/api/metadata", params?.id, "tasks"] });
      const previousTasks = queryClient.getQueryData<Task[]>(["/api/metadata", params?.id, "tasks"]);
      
      if (previousTasks) {
        queryClient.setQueryData<Task[]>(["/api/metadata", params?.id, "tasks"], [
          ...previousTasks,
          { 
            id: Math.random(), // Temporary ID
            metadataFileId: params?.id as string,
            description: newTask.description,
            status: "pending",
            deadline: newTask.deadline?.toISOString() || null,
            assignedTo: newTask.assignedTo || null,
            priority: "medium",
            createdBy: "me",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          } as Task
        ]);
      }
      return { previousTasks };
    },
    onError: (err, newTask, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(["/api/metadata", params?.id, "tasks"], context.previousTasks);
      }
      toast({ title: "Error", description: "Failed to add task", variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/metadata", params?.id, "tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      setNewTaskDesc("");
      setNewTaskDeadline(undefined);
      setNewTaskAssignee("");
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Task added" });
    },
  });

  const toggleTaskMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      await apiRequest("PATCH", `/api/tasks/${id}`, { status });
    },
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/metadata", params?.id, "tasks"] });
      const previousTasks = queryClient.getQueryData<Task[]>(["/api/metadata", params?.id, "tasks"]);
      
      if (previousTasks) {
        queryClient.setQueryData<Task[]>(
          ["/api/metadata", params?.id, "tasks"],
          previousTasks.map(t => t.id === id ? { ...t, status } : t)
        );
      }
      return { previousTasks };
    },
    onError: (err, variables, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(["/api/metadata", params?.id, "tasks"], context.previousTasks);
      }
      toast({ title: "Error", description: "Failed to update task", variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/metadata", params?.id, "tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/tasks/${id}`);
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["/api/metadata", params?.id, "tasks"] });
      const previousTasks = queryClient.getQueryData<Task[]>(["/api/metadata", params?.id, "tasks"]);
      
      if (previousTasks) {
        queryClient.setQueryData<Task[]>(
          ["/api/metadata", params?.id, "tasks"],
          previousTasks.filter(t => t.id !== id)
        );
      }
      return { previousTasks };
    },
    onError: (err, id, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(["/api/metadata", params?.id, "tasks"], context.previousTasks);
      }
      toast({ title: "Error", description: "Failed to delete task", variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/metadata", params?.id, "tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Task deleted" });
    },
  });

  const handleDownload = async (format: "json" | "xml" | "xlsx") => {
    try {
      const response = await fetch(`/api/metadata/${params?.id}/download?format=${format}`);
      if (!response.ok) throw new Error("Download failed");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      try {
        const a = document.createElement('a');
        a.href = url;
        a.download = `${params?.id}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } finally {
        window.URL.revokeObjectURL(url);
      }
      
      toast({
        title: "Success",
        description: `File downloaded as ${format.toUpperCase()}`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to download file",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto">
        <DetailSkeleton />
      </div>
    );
  }

  if (!file) {
    return (
      <div className="max-w-4xl mx-auto">
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">File not found</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">
            {file.seriesTitle || file.title}
            {file.season && ` S${file.season}`}
            {file.episode && ` E${file.episode}`}
          </h1>
          <p className="text-muted-foreground mt-2">
            File ID: <span className="font-mono">{file.id}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={() => handleDownload("xml")}
            data-testid="button-download-xml"
          >
            <Download className="w-4 h-4 mr-2" />
            Download XML
          </Button>
          <Button
            variant="outline"
            onClick={() => handleDownload("xlsx")}
            data-testid="button-download-xlsx"
          >
            <Download className="w-4 h-4 mr-2" />
            Download XLSX
          </Button>
          {canWriteMetadata && (
            <Button
              onClick={() => setLocation(`/edit/${file.id}`)}
              data-testid="button-edit"
            >
              Edit File
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => setLocation("/all-files")}
            data-testid="button-back"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back to Files
          </Button>
        </div>
      </div>

      <Card className="p-6">
        <MetadataForm
          defaultValues={{
            title: file.title,
            season: file.season || undefined,
            episode: file.episode || undefined,
            duration: file.duration ?? "",
            breakTime: file.breakTime ?? "",
            breakTimes: file.breakTimes || [],
            endCredits: file.endCredits ?? "",
            description: file.description || "",
            actors: file.actors || [],
            genre: file.genre || [],
            tags: file.tags || [],
            seasonType: (file.seasonType as "Winter" | "Summer" | "Autumn" | "Spring") || undefined,
            contentType: file.contentType || "",
            category: (file.category as "Series" | "Movie" | "Documentary") || undefined,
            channel: file.channel ?? "ONS",
            programRating: (file.programRating as "AL" | "6" | "9" | "12" | "16" | "18") || undefined,
            productionCountry: file.productionCountry ?? "",
            seriesTitle: file.seriesTitle ?? "",
            yearOfProduction: file.yearOfProduction || undefined,
            catchUp: file.catchUp ?? undefined,
            episodeCount: file.episodeCount || undefined,
            episodeTitle: file.episodeTitle ?? "",
            episodeDescription: file.episodeDescription ?? "",
            segmented: file.segmented ?? undefined,
            dateStart: file.dateStart ? new Date(file.dateStart) : undefined,
            dateEnd: file.dateEnd ? new Date(file.dateEnd) : undefined,
            subtitles: file.subtitles ?? undefined,
            subtitlesId: file.subtitlesId ?? "",
            audioId: file.audioId ?? "",
            googleDriveLink: file.googleDriveLink ?? "",
            originalFilename: file.originalFilename ?? "",
          }}
          onSubmit={() => {}}
          isPending={false}
          submitLabel="Save"
          readOnly={true}
        />
      </Card>

      {/* Task management */}
      <Card className="p-6">
        <CardHeader className="px-0 pt-0">
          <CardTitle className="flex items-center gap-2">
            <CheckSquare className="w-5 h-5" />
            Tasks
          </CardTitle>
          <CardDescription>Track tasks associated with this file</CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-0 space-y-4">
          {tasksLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <div className="space-y-2">
              {(tasks ?? []).map((task) => {
                const isDone = task.status === "completed";
                return (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 rounded-md border px-3 py-2"
                  >
                    <Checkbox
                      checked={isDone}
                      onCheckedChange={(checked) =>
                        toggleTaskMutation.mutate({
                          id: task.id,
                          status: checked ? "completed" : "pending",
                        })
                      }
                    />
                    <span className={cn("flex-1 text-sm", isDone && "line-through text-muted-foreground")}>
                      {task.description}
                    </span>
                    <Badge variant={isDone ? "secondary" : "outline"} className="shrink-0">
                      {isDone ? (
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                      ) : (
                        <Clock className="w-3 h-3 mr-1" />
                      )}
                      {isDone ? "Done" : "Pending"}
                    </Badge>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="shrink-0 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Task</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteTaskMutation.mutate(task.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                );
              })}
              {tasks?.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No tasks yet</p>
              )}
            </div>
          )}

          <div className="space-y-2 pt-2">
            <div className="flex gap-2">
              <Input
                placeholder="Add a task…"
                value={newTaskDesc}
                onChange={(e) => setNewTaskDesc(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newTaskDesc.trim()) {
                    addTaskMutation.mutate({ description: newTaskDesc.trim(), deadline: newTaskDeadline, assignedTo: newTaskAssignee || undefined });
                  }
                }}
              />
              <Button
                onClick={() => {
                  if (newTaskDesc.trim()) addTaskMutation.mutate({ description: newTaskDesc.trim(), deadline: newTaskDeadline, assignedTo: newTaskAssignee || undefined });
                }}
                disabled={!newTaskDesc.trim() || addTaskMutation.isPending}
              >
                <Plus className="w-4 h-4 mr-1" />
                Add
              </Button>
            </div>
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("gap-1.5 text-xs h-8", !newTaskDeadline && "text-muted-foreground")}>
                    <CalendarIcon className="w-3.5 h-3.5" />
                    {newTaskDeadline ? format(newTaskDeadline, "dd MMM yyyy") : "Deadline"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={newTaskDeadline} onSelect={setNewTaskDeadline} initialFocus />
                </PopoverContent>
              </Popover>
              <Select value={newTaskAssignee} onValueChange={setNewTaskAssignee}>
                <SelectTrigger className="h-8 text-xs w-[180px]">
                  <SelectValue placeholder="Assign to..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {usersData?.users?.map(u => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {newTaskDeadline && (
                <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setNewTaskDeadline(undefined)}>Clear date</Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
