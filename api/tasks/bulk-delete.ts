import type { VercelResponse } from "@vercel/node";
import { storage } from "../../shared/storage.js";
import { apiHandler, requirePermission, type AuthenticatedRequest } from "../_lib/apiHandler.js";
import { z } from "zod";

export default apiHandler(
  requirePermission("tasks", "write")(async (req: AuthenticatedRequest, res: VercelResponse) => {
    if (req.method !== "POST") {
      return res.status(405).json({ message: "Method not allowed" });
    }

    try {
      const schema = z.object({
        ids: z.array(z.number()).min(1),
      });

      const validation = schema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          message: "Validation failed",
          errors: validation.error.errors,
        });
      }

      const success = await storage.bulkDeleteTasks(validation.data.ids);
      if (!success) {
        return res.status(404).json({ message: "No tasks found to delete" });
      }

      return res.json({ message: "Tasks deleted successfully" });
    } catch (error) {
      console.error("Error bulk deleting tasks:", error);
      return res.status(500).json({ message: "Failed to delete tasks" });
    }
  })
);
