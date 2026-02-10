import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { ProgramTask } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";

interface TaskManagerProps {
  metadataFileId?: string;
  seriesTitle?: string;
  season?: number;
}

export function TaskManager({ metadataFileId, seriesTitle, season }: TaskManagerProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canWrite = user?.canWrite === 1;

  const queryKey = ["tasks", { metadataFileId, seriesTitle, season }];

  const { data: tasks = [], isLoading } = useQuery<ProgramTask[]>({
    queryKey,
    queryFn: async () => {
      let url = "/api/tasks?";
      if (metadataFileId) url += `metadataFileId=${metadataFileId}`;
      else if (seriesTitle && season) url += `seriesTitle=${seriesTitle}&season=${season}`;
      else return [];

      const res = await apiRequest("GET", url);
      return res.json();
    },
    enabled: !!metadataFileId || (!!seriesTitle && !!season),
  });

  const [newTask, setNewTask] = useState("");

  const mutationOptions = {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setNewTask("");
    },
  };

  const addTaskMutation = useMutation({
    mutationFn: (description: string) =>
      apiRequest("POST", "/api/tasks", {
        description,
        metadataFileId,
        seriesTitle,
        season,
      }),
    ...mutationOptions,
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiRequest("PUT", `/api/tasks/${id}`, { status }),
    ...mutationOptions,
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/tasks/${id}`),
    ...mutationOptions,
  });

  const handleAddTask = () => {
    if (newTask.trim()) {
      addTaskMutation.mutate(newTask.trim());
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tasks</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && <p>Loading tasks...</p>}
        <div className="space-y-2">
          {tasks.map((task) => (
            <div key={task.id} className="flex items-center gap-2">
              <Checkbox
                id={`task-${task.id}`}
                checked={task.status === "completed"}
                onCheckedChange={(checked) =>
                  updateTaskMutation.mutate({
                    id: task.id,
                    status: checked ? "completed" : "pending",
                  })
                }
                disabled={!canWrite}
              />
              <label
                htmlFor={`task-${task.id}`}
                className={`flex-1 ${task.status === "completed" ? "line-through text-muted-foreground" : ""}`}
              >
                {task.description}
              </label>
              {canWrite && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteTaskMutation.mutate(task.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
        {canWrite && (
          <div className="flex items-center gap-2 pt-4 border-t">
            <Input
              placeholder="Add a new task..."
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
            />
            <Button onClick={handleAddTask} disabled={addTaskMutation.isPending}>
              <Plus className="w-4 h-4 mr-2" />
              Add Task
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
