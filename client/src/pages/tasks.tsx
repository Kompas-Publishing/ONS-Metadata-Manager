import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Link } from "wouter";
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
  Trash2
} from "lucide-react";
import type { Task, MetadataFile } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
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
import { Label } from "@/components/ui/label";

type TaskWithFile = Task & { metadataFile: MetadataFile };

export default function Tasks() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [descFilter, setDescFilter] = useState<string>("all");

  const { data: tasks, isLoading } = useQuery<TaskWithFile[]>({
    queryKey: ["/api/tasks"],
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      await apiRequest("PATCH", `/api/tasks/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update task",
        variant: "destructive",
      });
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
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Task List</h1>
          <p className="text-muted-foreground mt-1">
            Manage and track tasks assigned to metadata files
          </p>
        </div>
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

      <div className="grid grid-cols-1 gap-4">
        {filteredTasks.length > 0 ? (
          filteredTasks.map((task) => (
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
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn(
                        "font-semibold text-lg leading-none",
                        task.status === "completed" && "line-through text-muted-foreground"
                      )}>
                        {task.description}
                      </span>
                      {task.status === "completed" ? (
                        <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Done
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">
                          <Clock className="w-3 h-3 mr-1" /> Pending
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {task.metadataFile.title}
                      </span>
                      <span className="flex items-center gap-1">
                        ID: <span className="font-mono">{task.metadataFileId}</span>
                      </span>
                      {task.metadataFile.season && (
                        <span>S{task.metadataFile.season} E{task.metadataFile.episode}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="ghost" size="icon" asChild>
                    <Link href={`/view/${task.metadataFileId}`}>
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      if(confirm("Delete this task?")) deleteMutation.mutate(task.id);
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="text-center py-20 border-2 border-dashed rounded-lg bg-muted/20">
            <CheckCircle2 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground">No tasks found</h3>
            <p className="text-sm text-muted-foreground">
              Try adjusting your filters or add tasks from a file's view page.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
