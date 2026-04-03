import type { VercelResponse } from "@vercel/node";
import { storage } from "../../shared/storage.js";
import { apiHandler, requirePermission, type AuthenticatedRequest } from "../_lib/apiHandler.js";
import { insertTaskSchema } from "../../shared/schema.js";

export default apiHandler(async (req: AuthenticatedRequest, res: VercelResponse) => {
  if (req.method === "GET") {
    return requirePermission("tasks", "read")(async (req: AuthenticatedRequest, res: VercelResponse) => {
      try {
        const { status, assignedTo } = req.query;
        // requirePermission sets req.userPermissions
        const tasks = await storage.listTasks(
          req.userPermissions!,
          typeof status === "string" ? status : undefined,
          typeof assignedTo === "string" ? assignedTo : undefined
        );
        return res.json(tasks);
      } catch (error) {
        console.error("Error fetching tasks:", error);
        return res.status(500).json({ message: "Failed to fetch tasks" });
      }
    })(req, res);
  }

  if (req.method === "POST") {
    return requirePermission("tasks", "write")(async (req: AuthenticatedRequest, res: VercelResponse) => {
      // Direct POST to /api/tasks can be single creation
      try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ message: "Unauthorized" });

        // Clean up data for validation
        const taskData = { ...req.body };
        if (taskData.assignedTo === "unassigned" || taskData.assignedTo === "") {
          taskData.assignedTo = null;
        }

        const validated = insertTaskSchema.safeParse(taskData);
        if (!validated.success) {
          return res.status(400).json({ 
            message: "Invalid task data", 
            errors: validated.error.errors 
          });
        }

        const task = await storage.createTask({
          ...validated.data,
          createdBy: userId,
        });
        return res.json(task);
      } catch (error) {
        console.error("Error creating task:", error);
        return res.status(500).json({ message: "Failed to create task" });
      }
    })(req, res);
  }

  return res.status(405).json({ message: "Method not allowed" });
});
