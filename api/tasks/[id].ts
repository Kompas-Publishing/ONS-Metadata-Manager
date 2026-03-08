import type { VercelResponse } from "@vercel/node";
import { storage } from "../_server/storage.js";
import { apiHandler, requirePermission, type AuthenticatedRequest } from "../_lib/apiHandler.js";
import { z } from "zod";

const updateTaskSchema = z.object({
  status: z["enum"](["pending", "completed"]).optional(),
  description: z.string().optional(),
});

export default apiHandler(async (req: AuthenticatedRequest, res: VercelResponse) => {
  const taskId = parseInt(req.query.id as string);
  if (isNaN(taskId)) return res.status(400).json({ message: "Invalid task ID" });

  if (req.method === "PATCH") {
    return requirePermission("tasks", "write")(async (req, res) => {
      try {
        const validation = updateTaskSchema.partial().safeParse(req.body);
        if (!validation.success) {
          return res.status(400).json({
            message: "Validation failed",
            errors: validation.error.errors,
          });
        }

        const updated = await storage.updateTask(taskId, validation.data);
        if (!updated) return res.status(404).json({ message: "Task not found" });
        return res.json(updated);
      } catch (error) {
        console.error("Error updating task:", error);
        return res.status(500).json({ message: "Failed to update task" });
      }
    })(req, res);
  }

  if (req.method === "DELETE") {
    return requirePermission("tasks", "write")(async (req, res) => {
      try {
        const success = await storage.deleteTask(taskId);
        if (!success) return res.status(404).json({ message: "Task not found" });
        return res.json({ message: "Task deleted successfully" });
      } catch (error) {
        console.error("Error deleting task:", error);
        return res.status(500).json({ message: "Failed to delete task" });
      }
    })(req, res);
  }

  return res.status(405).json({ message: "Method not allowed" });
});
