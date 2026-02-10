import type { VercelRequest, VercelResponse } from "@vercel/node";
import { apiHandler, requirePermission, type AuthenticatedRequest } from "../../_lib/apiHandler";
import { storage } from "../../_server/storage";

export default apiHandler(
  requirePermission("write")(async (req: AuthenticatedRequest, res: VercelResponse) => {
    const { id } = req.query;
    const taskId = parseInt(id as string);

    if (isNaN(taskId)) {
      return res.status(400).json({ message: "Invalid task ID" });
    }

    if (req.method === "PUT") {
      const { status } = req.body;
      if (!status) {
        return res.status(400).json({ message: "Status is required" });
      }

      const updatedTask = await storage.updateTaskStatus(taskId, status);
      if (updatedTask) {
        return res.json(updatedTask);
      }
      return res.status(404).json({ message: "Task not found" });
    }

    if (req.method === "DELETE") {
      const success = await storage.deleteTask(taskId);
      if (success) {
        return res.status(204).end();
      }
      return res.status(404).json({ message: "Task not found" });
    }

    res.setHeader("Allow", ["PUT", "DELETE"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  })
);
