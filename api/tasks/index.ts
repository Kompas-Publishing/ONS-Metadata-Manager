import type { VercelResponse } from "@vercel/node";
import { storage } from "../_server/storage.js";
import { apiHandler, type AuthenticatedRequest } from "../_lib/apiHandler.js";
import { getUserPermissions } from "../_server/permissions.js";
import { z } from "zod";

export default apiHandler(async (req: AuthenticatedRequest, res: VercelResponse) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const permissions = await getUserPermissions(userId);
  if (!permissions) return res.status(403).json({ message: "Unauthorized" });

  if (req.method === "GET") {
    try {
      const { status } = req.query;
      const tasks = await storage.listTasks(permissions, typeof status === "string" ? status : undefined);
      return res.json(tasks);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      return res.status(500).json({ message: "Failed to fetch tasks" });
    }
  }

  if (req.method === "POST") {
    try {
      // Check for bulk creation
      const bulkSchema = z.object({
        metadataFileIds: z.array(z.string()).min(1),
        description: z.string().min(1),
      });

      const validation = bulkSchema.safeParse(req.body);
      if (validation.success) {
        const tasks = await storage.bulkCreateTasks({
          ...validation.data,
          createdBy: userId,
        });
        return res.json(tasks);
      }

      // Fallback to single creation if needed (optional based on your UI needs)
      return res.status(400).json({ message: "Invalid request body for task creation" });
    } catch (error) {
      console.error("Error creating tasks:", error);
      return res.status(500).json({ message: "Failed to create tasks" });
    }
  }

  return res.status(405).json({ message: "Method not allowed" });
});
