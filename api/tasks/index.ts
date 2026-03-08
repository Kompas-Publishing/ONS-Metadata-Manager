import type { VercelResponse } from "@vercel/node";
import { storage } from "../_server/storage.js";
import { apiHandler, requirePermission, type AuthenticatedRequest } from "../_lib/apiHandler.js";

export default apiHandler(
  requirePermission("tasks", "read")(async (req: AuthenticatedRequest, res: VercelResponse) => {
    if (req.method === "GET") {
      try {
        const { status } = req.query;
        // requirePermission sets req.userPermissions
        const tasks = await storage.listTasks(req.userPermissions!, typeof status === "string" ? status : undefined);
        return res.json(tasks);
      } catch (error) {
        console.error("Error fetching tasks:", error);
        return res.status(500).json({ message: "Failed to fetch tasks" });
      }
    }

    if (req.method === "POST") {
      // Direct POST to /api/tasks can be single creation
      try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ message: "Unauthorized" });

        const task = await storage.createTask({
          ...req.body,
          createdBy: userId,
        });
        return res.json(task);
      } catch (error) {
        console.error("Error creating task:", error);
        return res.status(500).json({ message: "Failed to create task" });
      }
    }

    return res.status(405).json({ message: "Method not allowed" });
  })
);
