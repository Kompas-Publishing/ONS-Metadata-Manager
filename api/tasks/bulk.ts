import type { VercelResponse } from "@vercel/node";
import { storage } from "../_server/storage.js";
import { apiHandler, requirePermission, type AuthenticatedRequest } from "../_lib/apiHandler.js";
import { z } from "zod";

export default apiHandler(
  requirePermission("tasks", "write")(async (req: AuthenticatedRequest, res: VercelResponse) => {
    if (req.method !== "POST") {
      return res.status(405).json({ message: "Method not allowed" });
    }

    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const bulkSchema = z.object({
        metadataFileIds: z.array(z.string()).min(1),
        description: z.string().min(1),
        deadline: z.coerce.date().optional(),
      });

      const validation = bulkSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          message: "Validation failed",
          errors: validation.error.errors,
        });
      }

      const tasks = await storage.bulkCreateTasks({
        ...validation.data,
        createdBy: userId,
      });
      return res.json(tasks);
    } catch (error) {
      console.error("Error creating bulk tasks:", error);
      return res.status(500).json({ message: "Failed to create tasks" });
    }
  })
);
